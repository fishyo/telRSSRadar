const Parser = require("rss-parser");
const { feeds, articles, filters, settings } = require("./database");
const { escapeMarkdown, truncate } = require("./utils");

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
  async formatArticle(article, feedTitle) {
    const title = escapeMarkdown(article.title || "无标题");
    const link = article.link || "";
    const snippet = truncate(
      article.contentSnippet || article.content || "暂无摘要",
      200
    );
    const description = escapeMarkdown(snippet);

    // 直接返回文章链接
    return `📰 *${title}*\n\n${description}\n\n🔗 [阅读原文](${link})\n📡 来源: ${escapeMarkdown(
      feedTitle
    )}`;
  }

  // 初次添加 RSS 源时拉取最新 10 条文章
  async fetchInitialArticles(feedId, feedUrl) {
    try {
      const feed = await parser.parseURL(feedUrl);
      const items = feed.items.slice(0, 10);

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

      return { success: true, title: feed.title, count: items.length };
    } catch (error) {
      throw error;
    }
  }

  // 检查单个 RSS 源的更新
  async checkFeed(feedId) {
    const feed = feeds.getById.get(feedId);
    if (!feed) return;

    try {
      const rssFeed = await parser.parseURL(feed.url);

      // 仅在标题为空时自动更新（首次添加时）
      // 如果用户已经设置了自定义标题，则不覆盖
      if (!feed.title && rssFeed.title) {
        feeds.updateTitle.run(rssFeed.title, feedId);
      }

      const newArticles = [];

      for (const item of rssFeed.items) {
        const guid = item.guid || item.link || item.title;

        // 检查文章是否已存在
        const exists = articles.exists.get(feedId, guid);
        if (exists) continue;

        // 应用过滤规则
        if (!this.matchesFilters(feedId, item)) {
          console.log(`Article filtered out: ${item.title}`);
          continue;
        }

        const publishedAt = item.pubDate
          ? Math.floor(new Date(item.pubDate).getTime() / 1000)
          : Math.floor(Date.now() / 1000);

        // 保存到数据库
        articles.add.run(feedId, guid, item.title, item.link, publishedAt);

        newArticles.push({
          title: item.title,
          link: item.link,
          contentSnippet: item.contentSnippet || item.content,
          pubDate: item.pubDate,
        });
      }

      // 更新最后检查时间
      feeds.updateLastCheck.run(Math.floor(Date.now() / 1000), feedId);

      // 推送新文章（实时读取最新自定义标题，避免并发/缓存导致的旧标题）
      if (newArticles.length > 0) {
        const latestFeed = feeds.getById.get(feedId);
        const displayTitle =
          (latestFeed && latestFeed.title) || rssFeed.title || feed.url;

        await this.pushArticles(newArticles, displayTitle);
      }

      // 重置错误计数
      await this.errorHandler.handleSuccess(feedId);

      return { success: true, newCount: newArticles.length };
    } catch (error) {
      await this.errorHandler.handleRSSError(feedId, feed.url, error);
      return { success: false, error: error.message };
    }
  }

  // 推送文章到 Telegram
  async pushArticles(articles, feedTitle) {
    for (const article of articles) {
      try {
        const message = await this.formatArticle(article, feedTitle);

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
