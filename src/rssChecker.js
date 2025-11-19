const Parser = require("rss-parser");
const { feeds, articles, settings, filters } = require("./database");
const {
  escapeMarkdown,
  truncate,
  htmlToTelegraph,
  createTelegraphPage,
} = require("./utils");
const logger = require("./logger");
const AISummaryService = require('./aiSummary');
const { RSS } = require('./constants');

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; TelegramRSSBot/1.0)",
  },
});

class RSSChecker {
  constructor(bot, chatId, errorHandler) {
    this.bot = bot;
    this.chatId = chatId;
    this.errorHandler = errorHandler;
    this.aiSummary = new AISummaryService();
  }

  // 检查文章是否匹配过滤规则
  matchesFilters(feedId, article) {
    const feedFilters = filters.getByFeed.all(feedId);
    if (feedFilters.length === 0) return true;

    const text = `${article.title || ""} ${
      article.contentSnippet || ""
    }`.toLowerCase();

    const includeFilters = feedFilters.filter((f) => f.type === "include");
    const excludeFilters = feedFilters.filter((f) => f.type === "exclude");

    // 如果有排除过滤器，检查是否匹配
    for (const filter of excludeFilters) {
      if (text.includes(filter.keyword.toLowerCase())) {
        return false;
      }
    }

    // 如果有包含过滤器，必须至少匹配一个
    if (includeFilters.length > 0) {
      return includeFilters.some((filter) =>
        text.includes(filter.keyword.toLowerCase())
      );
    }

    return true;
  }

  // 格式化文章为 Markdown
  async formatArticle(article, feedTitle, telegraphUrl) {
    const title = escapeMarkdown(article.title || "无标题");
    const link = article.link || "";
    const snippet = truncate(
      article.contentSnippet || article.content || "暂无摘要",
      200
    );
    const description = escapeMarkdown(snippet);

    let message = `📰 *${title}*\n\n${description}\n\n`;

    if (telegraphUrl) {
      message += `📄 [Telegraph 预览](${telegraphUrl})\n`;
    }

    message += `🔗 [阅读原文](${link})\n📡 来源: ${escapeMarkdown(feedTitle)}`;

    return message;
  }

  // 初次添加 RSS 源时拉取最新 10 条文章
  // 预览 RSS 源（不保存到数据库）
  async previewFeed(feedUrl) {
    try {
      const feed = await parser.parseURL(feedUrl);
      const articles = feed.items.slice(0, RSS.PREVIEW_ARTICLE_COUNT).map(item => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate
      }));

      return {
        title: feed.title || '未命名源',
        articles
      };
    } catch (error) {
      throw new Error('无法解析 RSS 源: ' + error.message);
    }
  }

  async fetchInitialArticles(feedId, feedUrl, pushLatest = false, pushCount = 5) {
    try {
      const feed = await parser.parseURL(feedUrl);
      
      if (pushLatest) {
        // 推送模式：只推送指定数量的最新文章，不记录到数据库
        const itemsToPush = feed.items.slice(0, pushCount);
        const articlesToPush = [];
        
        for (const item of itemsToPush) {
          const publishedAt = item.pubDate
            ? Math.floor(new Date(item.pubDate).getTime() / 1000)
            : Math.floor(Date.now() / 1000);
          
          articlesToPush.push({
            guid: item.guid || item.link || item.title,
            title: item.title,
            link: item.link,
            publishedAt
          });
          
          // 记录到数据库以避免下次重复推送
          articles.add.run(
            feedId,
            item.guid || item.link || item.title,
            item.title,
            item.link,
            publishedAt
          );
        }
        
        // 立即推送文章
        if (articlesToPush.length > 0) {
          await this.pushArticles(articlesToPush, feed.title, feedId);
        }
        
        return { success: true, title: feed.title, count: articlesToPush.length, pushed: true };
      } else {
        // 记录模式：记录最新 N 篇但不推送
        const items = feed.items.slice(0, RSS.INITIAL_ARTICLE_COUNT);

        for (const item of items) {
          const publishedAt = item.pubDate
            ? Math.floor(new Date(item.pubDate).getTime() / 1000)
            : Math.floor(Date.now() / 1000);
          articles.add.run(
            feedId,
            item.guid || item.link || item.title,
            item.title,
            item.link,
            publishedAt
          );
        }

        return { success: true, title: feed.title, count: items.length, pushed: false };
      }
    } catch (error) {
      throw error;
    }
  }

  // 检查单个 RSS 源的更新
  async checkFeed(feedId) {
    const initialFeed = feeds.getById.get(feedId);
    if (!initialFeed) {
      console.error(`Feed with ID ${feedId} not found.`);
      return;
    }

    try {
      const rssFeed = await parser.parseURL(initialFeed.url);
      const liveTitle = rssFeed.title || "Untitled Feed";

      // 重新获取最新数据，以防在网络请求期间发生并发修改（例如重命名）
      const currentFeed = feeds.getById.get(feedId);
      logger.debug(`checkFeed - Feed ${feedId} (re-fetched):`, currentFeed);
      let displayTitle = currentFeed.title;

      // 如果标题从未设置过 (值为 null), 则使用实时标题自动设置一次
      if (currentFeed.title === null) {
        logger.debug(
          `checkFeed - Feed ${feedId} title is null, attempting to update.`
        );
        feeds.updateTitle.run(liveTitle, feedId);
        displayTitle = liveTitle; // 在本次运行中也使用新标题
      }

      const newArticles = [];
      for (const item of rssFeed.items) {
        const guid = item.guid || item.link || item.title;
        if (articles.exists.get(feedId, guid)) {
          continue;
        }

        if (this.matchesFilters(feedId, item)) {
          const publishedAt = item.pubDate
            ? Math.floor(new Date(item.pubDate).getTime() / 1000)
            : Math.floor(Date.now() / 1000);
          articles.add.run(feedId, guid, item.title, item.link, publishedAt);
          newArticles.push({
            title: item.title,
            link: item.link,
            contentSnippet: item.contentSnippet || item.content,
            content:
              item.content || item["content:encoded"] || item.contentSnippet, // 确保传递内容
            pubDate: item.pubDate,
          });
        }
      }

      if (newArticles.length > 0) {
        // 确保 displayTitle 是一个有效字符串，如果不是，则使用回退值
        const finalTitle = displayTitle ?? liveTitle ?? initialFeed.url;
        logger.debug(`checkFeed - Feed ${feedId} title decision:`, {
          initialDisplayTitle: displayTitle,
          liveTitle: liveTitle,
          finalTitle: finalTitle,
        });
        await this.pushArticles(newArticles, finalTitle, feedId);
      }

      feeds.updateLastCheck.run(Math.floor(Date.now() / 1000), feedId);
      await this.errorHandler.handleSuccess(feedId);

      return { success: true, newCount: newArticles.length };
    } catch (error) {
      await this.errorHandler.handleRSSError(
        initialFeed.id,
        initialFeed.url,
        error
      );
      return { success: false, error: error.message };
    }
  }

  // 推送文章到 Telegram
  async pushArticles(articles, feedTitle, feedId = null) {
    // 检查该订阅源是否启用 AI 总结
    let aiEnabled = false;
    if (feedId) {
      const feed = feeds.getById.get(feedId);
      aiEnabled = feed && feed.ai_summary_enabled === 1;
    }
    
    // 检查文章数量是否达到最小要求
    const minArticles = parseInt(settings.get.get('ai_min_articles')?.value || '3');
    const hasEnoughArticles = articles.length >= minArticles;
    
    // 尝试生成 AI 总结 (仅当该源启用且文章数量足够时)
    let summaryData = null;
    if (aiEnabled && hasEnoughArticles) {
      // 传递 skipGlobalCheck=true,因为我们已经在订阅源级别检查了
      summaryData = await this.aiSummary.summarize(articles, feedTitle, true);
    } else if (aiEnabled && !hasEnoughArticles) {
      console.log(`⏭️  跳过 AI 总结: ${feedTitle} (${articles.length} 篇 < ${minArticles} 篇最小要求)`);
    }
    
    if (summaryData) {
      try {
        const summaryMessage = this.aiSummary.formatSummaryMessage(summaryData, articles);
        await this.bot.telegram.sendMessage(this.chatId, summaryMessage, {
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        });
        console.log(`📊 已推送 AI 总结: ${feedTitle} (${articles.length} 篇文章)`);
        // AI 总结后直接返回,不再推送原文
        return;
      } catch (error) {
        console.error("Failed to push AI summary:", error);
        console.log(`⚠️  AI 总结推送失败,继续推送原文`);
      }
    }

    // 获取 token
    const tokenResult = settings.get.get("telegraph_token");
    const telegraphToken = tokenResult ? tokenResult.value : null;

    for (const article of articles) {
      try {
        let telegraphUrl = null;

        // 尝试创建 Telegraph 页面
        if (telegraphToken && article.content) {
          try {
            const nodes = htmlToTelegraph(article.content);
            if (nodes.length > 0) {
              telegraphUrl = await createTelegraphPage(
                telegraphToken,
                article.title || "无标题",
                nodes,
                feedTitle,
                article.link
              );
            }
          } catch (err) {
            console.error("Failed to create Telegraph page:", err);
          }
        }

        const message = await this.formatArticle(
          article,
          feedTitle,
          telegraphUrl
        );

        await this.bot.telegram.sendMessage(this.chatId, message, {
          parse_mode: "MarkdownV2",
          disable_web_page_preview: false,
        });

        // 避免触发 Telegram API 限流
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error("Failed to push article:", error);
      }
    }
  }

  // 清理旧文章
  async cleanupOldArticles() {
    try {
      // 获取保留天数设置
      const retentionResult = settings.get.get("retention_days");
      const retentionDays = parseInt(retentionResult?.value || "30");

      // 计算删除时间戳（当前时间减去保留天数）
      const cutoffTimestamp = Math.floor(
        Date.now() / 1000 - retentionDays * 24 * 60 * 60
      );

      // 删除旧文章
      const deletedCount = articles.deleteOlderThan.run(cutoffTimestamp);

      console.log(`🧹 已清理 ${deletedCount.changes} 篇旧文章`);

      return { success: true, deletedCount: deletedCount.changes };
    } catch (error) {
      console.error("❌ 清理旧文章失败:", error);
      return { success: false, error: error.message };
    }
  }

  // 按数量清理文章
  async cleanupByCount() {
    try {
      const retentionResult = settings.get.get("retention_count");
      const retentionCount = parseInt(retentionResult?.value || "100");

      const deletedCount = articles.deleteByCount.run(retentionCount);

      console.log(`🧹 已按数量清理 ${deletedCount.changes} 篇旧文章`);

      return { success: true, deletedCount: deletedCount.changes };
    } catch (error) {
      console.error("❌ 按数量清理旧文章失败:", error);
      return { success: false, error: error.message };
    }
  }

  // 检查所有 RSS 源
  async checkAllFeeds() {
    const allFeeds = feeds.getAll.all();
    console.log(`Checking ${allFeeds.length} feeds...`);

    for (const feed of allFeeds) {
      await this.checkFeed(feed.id);
      // 每个 feed 之间间隔 2 秒
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

module.exports = RSSChecker;
