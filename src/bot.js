require("dotenv").config();
const axios = require("axios");
const { Telegraf } = require("telegraf");
const logger = require("./logger");
const { feeds, filters, settings } = require("./database");
const setupFilterCommands = require("./commands/filters");
const RSSChecker = require("./rssChecker");
const ErrorHandler = require("./errorHandler");
const { escapeMarkdown, createTelegraphAccount } = require("./utils");

const bot = new Telegraf(process.env.BOT_TOKEN);
const chatId = process.env.CHAT_ID;

// 初始化 Telegraph 账号
(async () => {
  try {
    const tokenResult = settings.get.get("telegraph_token");
    if (!tokenResult) {
      console.log("Creating Telegraph account...");
      const account = await createTelegraphAccount(
        "RSSBot",
        "Telegram RSS Bot"
      );
      settings.set.run("telegraph_token", account.access_token);
      console.log("Telegraph account created:", account.short_name);
    } else {
      console.log("Telegraph token found.");
    }
  } catch (error) {
    console.error("Failed to initialize Telegraph account:", error);
  }
})();

// 初始化错误处理器和 RSS 检查器
const errorHandler = new ErrorHandler(bot, chatId);
const rssChecker = new RSSChecker(bot, chatId, errorHandler);

// /start 命令
bot.command("start", (ctx) => {
  const message =
    `👋 *欢迎使用 Telegram RSS Bot*\n\n` +
    `📚 *订阅源管理*\n` +
    `/add - 添加订阅源\n` +
    `/rm - 删除订阅源\n` +
    `/rename - 重命名订阅源\n` +
    `/ls - 查看所有订阅源\n` +
    `/info - 查看订阅源详情\n` +
    `/test - 测试订阅源连接\n\n` +
    `🔄 *更新与检查*\n` +
    `/check - 手动检查更新\n` +
    `/stats - 查看统计信息\n\n` +
    `🔧 *批量管理*\n` +
    `/checkerrors - 检查错误源\n` +
    `/batchrm - 批量删除订阅源\n\n` +
    `🤖 *AI 总结*\n` +
    `/ai - AI 设置与控制\n\n` +
    `📦 *导入导出*\n` +
    `/export - 导出订阅列表\n` +
    `/import - 导入订阅列表\n\n` +
    `🔍 *过滤管理*\n` +
    `/f - 添加过滤\n` +
    `/rf - 删除过滤\n` +
    `/lf - 查看过滤规则\n\n` +
    `⚙️ *系统设置*\n` +
    `/interval - 设置检查间隔\n` +
    `/retention - 设置保留天数\n` +
    `/cleanup - 清理旧文章\n\n` +
    `ℹ️ 使用 /help 命令名 查看详细帮助`;

  ctx.reply(message, { parse_mode: "Markdown" });
});

// /help 命令
bot.command("help", (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);

  if (args.length === 0) {
    return ctx.telegram.sendMessage(
      ctx.chat.id,
      "使用 /start 查看所有可用命令"
    );
  }

  const command = args[0].replace("/", "");
  const helpTexts = {
    add: "📝 *添加订阅源*\n\n用法: /add URL地址\n\n示例:\n/add https://example.com/feed.xml\n\n会自动获取最新10篇文章并记录，之后只推送新文章。",
    info: "📊 *查看订阅源详情*\n\n用法: /info 订阅源ID\n\n显示订阅源的详细信息，包括：\n• 标题和 URL\n• 最后检查时间\n• 文章数量\n• AI 总结状态\n• 过滤规则",
    test: "🧪 *测试订阅源*\n\n用法: /test 订阅源ID\n\n测试订阅源是否可以正常访问，并显示最新文章标题。",
    ai: "🤖 *AI 总结控制*\n\n用法:\n/ai - 查看 AI 设置\n/ai on ID - 为订阅源启用 AI\n/ai off ID - 为订阅源禁用 AI\n\n注：需要在 Web 管理面板中配置 API Key。",
    stats:
      "📊 *系统统计*\n\n用法: /stats\n\n显示系统统计信息，包括订阅源数量、文章数量、运行参数等。",
    check:
      "🔄 *检查更新*\n\n用法:\n/check - 检查所有订阅源\n/check ID - 检查指定订阅源\n\n手动触发 RSS 检查，如有新文章会立即推送。",
    checkerrors:
      "🔍 *检查错误源*\n\n用法: /checkerrors\n\n批量检查所有订阅源的连通性，找出无法访问的错误源。\n\n检查完成后会显示错误源列表，并提供批量删除命令。",
    batchrm:
      "🗑️ *批量删除订阅源*\n\n用法: /batchrm ID1 ID2 ID3 ...\n\n示例:\n/batchrm 1 5 8\n\n批量删除多个订阅源，需要输入 /confirm 确认。\n\n💡 提示: 可以先用 /checkerrors 检查错误源",
  };

  const helpText = helpTexts[command];
  if (helpText) {
    ctx.reply(helpText, { parse_mode: "Markdown" });
  } else {
    ctx.reply(
      `❓ 未找到命令 /${command} 的帮助信息\n\n使用 /start 查看所有命令`
    );
  }
});

// /stats 命令: 查看统计信息
bot.command("stats", async (ctx) => {
  try {
    const { articles } = require("./database");
    const allFeeds = feeds.getAll.all();
    const articleCount = articles.getCount.get().count;
    const checkInterval = settings.get.get("check_interval")?.value || "10";
    const retentionDays = settings.get.get("retention_days")?.value || "30";
    const retentionCount = settings.get.get("retention_count")?.value || "100";

    // 统计 AI 总结启用情况
    const aiEnabled = settings.get.get("ai_summary_enabled")?.value === "true";
    const aiEnabledFeeds = allFeeds.filter(
      (f) => f.ai_summary_enabled === 1
    ).length;

    // 统计错误源
    const errorFeeds = allFeeds.filter((f) => f.error_count > 0).length;

    let message = `📊 *系统统计信息*\n\n`;
    message += `📚 *订阅源*\n`;
    message += `   总数: ${allFeeds.length} 个\n`;
    message += `   错误: ${errorFeeds} 个\n`;
    message += `   AI 启用: ${aiEnabledFeeds} 个\n\n`;

    message += `📝 *文章*\n`;
    message += `   总数: ${articleCount} 篇\n`;
    message += `   保留: ${retentionDays} 天 / ${retentionCount} 篇每源\n\n`;

    message += `⚙️ *运行参数*\n`;
    message += `   检查间隔: ${checkInterval} 分钟\n`;
    message += `   AI 总结: ${aiEnabled ? "✅ 已启用" : "❌ 已禁用"}\n\n`;

    message += `🌐 *Web 管理面板*\n`;
    message += `   http://localhost:3000`;

    ctx.reply(message, { parse_mode: "Markdown" });
  } catch (error) {
    ctx.reply("❌ 获取统计信息失败: " + error.message);
  }
});

// /add 命令: 添加 RSS 源
bot.command("add", async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);

  if (args.length === 0) {
    return ctx.reply(
      "❌ 用法错误\n\n" +
        "正确用法: /add <RSS订阅链接>\n\n" +
        "示例: /add https://example.com/feed.xml"
    );
  }

  const url = args[0];

  // 检查 URL 格式
  try {
    new URL(url);
  } catch (error) {
    return ctx.reply("❌ 无效的 URL 格式");
  }

  // 检查是否已存在
  const existing = feeds.getByUrl.get(url);
  if (existing) {
    return ctx.reply(`❌ 该 RSS 源已存在 (ID: ${existing.id})`);
  }

  let feedId = null;
  try {
    await ctx.reply("⏳ 正在添加并获取最新文章...");

    // 添加到数据库
    const result = feeds.add.run(url, null);
    feedId = result.lastInsertRowid;

    // 拉取最新 10 条文章
    const fetchResult = await rssChecker.fetchInitialArticles(feedId, url);

    ctx.reply(
      `✅ 已成功添加 RSS 源\n\n` +
        `ID: ${feedId}\n` +
        `标题: ${fetchResult.title}\n` +
        `URL: ${url}\n` +
        `已记录 ${fetchResult.count} 篇历史文章\n\n` +
        `新文章将自动推送到此聊天`
    );
  } catch (error) {
    // 如果失败，删除数据库记录
    if (feedId) {
      feeds.remove.run(feedId);
    }
    ctx.reply(`❌ 添加失败: ${error.message}\n\n请检查 URL 是否正确`);
  }
});

// /remove, /rm 命令: 删除 RSS 源
bot.command(["remove", "rm"], async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);

  if (args.length === 0) {
    return ctx.reply(
      "❌ 用法错误\n\n" +
        "正确用法: /remove <订阅源ID>\n\n" +
        "使用 /list 查看所有订阅源及其 ID"
    );
  }

  const feedId = parseInt(args[0]);

  if (isNaN(feedId)) {
    return ctx.reply("❌ 订阅源 ID 必须是数字");
  }

  const feed = feeds.getById.get(feedId);
  if (!feed) {
    return ctx.reply(`❌ 订阅源 ID ${feedId} 不存在`);
  }

  try {
    feeds.remove.run(feedId);
    ctx.reply(
      `✅ 已删除订阅源\n\n` +
        `ID: ${feedId}\n` +
        `标题: ${feed.title || "未命名"}\n` +
        `URL: ${feed.url}`
    );
  } catch (error) {
    ctx.reply("❌ 删除失败: " + error.message);
  }
});

// /rename 命令: 重命名 RSS 源
bot.command("rename", async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);

  if (args.length < 2) {
    return ctx.reply(
      "❌ 用法错误\n\n" +
        "正确用法: /rename <订阅源ID> <新名称>\n\n" +
        "示例: /rename 1 我的科技博客\n" +
        "使用 /list 查看所有订阅源及其 ID"
    );
  }

  const feedId = parseInt(args[0]);
  const newTitle = args.slice(1).join(" ");

  if (isNaN(feedId)) {
    return ctx.reply("❌ 订阅源 ID 必须是数字");
  }

  const feed = feeds.getById.get(feedId);
  if (!feed) {
    return ctx.reply(`❌ 订阅源 ID ${feedId} 不存在`);
  }

  try {
    const info = feeds.updateTitle.run(newTitle, feedId);
    logger.debug(`/rename - DB update info for feed ${feedId}:`, info);
    ctx.reply(
      `✅ 已重命名订阅源\n\n` +
        `ID: ${feedId}\n` +
        `旧名称: ${feed.title || "未命名"}\n` +
        `新名称: ${newTitle}`
    );
  } catch (error) {
    ctx.reply("❌ 重命名失败: " + error.message);
  }
});

// /list, /ls 命令: 列出所有 RSS 源
bot.command(["list", "ls"], async (ctx) => {
  const allFeeds = feeds.getAll.all();
  logger.debug("/ls - Feeds fetched from DB:", allFeeds);

  if (allFeeds.length === 0) {
    return ctx.reply(
      "📋 还没有添加任何 RSS 订阅源\n\n使用 /add <url> 添加订阅源"
    );
  }

  let message = `📋 *RSS 订阅源列表* (${allFeeds.length})\n\n`;

  allFeeds.forEach((feed) => {
    const status = feed.error_count > 0 ? "⚠️" : "✅";
    const lastCheck = feed.last_check
      ? new Date(feed.last_check * 1000).toLocaleString("zh-CN")
      : "未检查";

    message += `${status} *#${feed.id}* ${escapeMarkdown(
      feed.title || "未命名"
    )}\n`;
    message += `   URL: ${feed.url}\n`;
    message += `   最后检查: ${lastCheck}\n`;
    if (feed.error_count > 0) {
      message += `   错误次数: ${feed.error_count}\n`;
    }
    message += `\n`;
  });

  ctx.reply(message, { parse_mode: "Markdown" });
});

// /info 命令: 查看订阅源详情
bot.command("info", async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);

  if (args.length === 0) {
    return ctx.reply(
      "❌ 用法错误\n\n" +
        "正确用法: /info <订阅源ID>\n\n" +
        "使用 /list 查看所有订阅源及其 ID"
    );
  }

  const feedId = parseInt(args[0]);

  if (isNaN(feedId)) {
    return ctx.reply("❌ 订阅源 ID 必须是数字");
  }

  const feed = feeds.getById.get(feedId);
  if (!feed) {
    return ctx.reply(`❌ 订阅源 ID ${feedId} 不存在`);
  }

  try {
    const { articles } = require("./database");
    const articleCount = articles.getByFeed.all(feedId, 999999).length;
    const feedFilters = filters.getByFeed.all(feedId);

    const lastCheck = feed.last_check
      ? new Date(feed.last_check * 1000).toLocaleString("zh-CN")
      : "未检查";

    const aiStatus = feed.ai_summary_enabled === 1 ? "✅ 已启用" : "❌ 已禁用";
    const status = feed.error_count > 0 ? "⚠️ 错误" : "✅ 正常";

    let message = `📊 *订阅源详情* #${feedId}\n\n`;
    message += `🏷️ *标题:* ${escapeMarkdown(feed.title || "未命名")}\n`;
    message += `🔗 *URL:* ${feed.url}\n`;
    message += `🚦 *状态:* ${status}\n`;
    message += `⏰ *最后检查:* ${lastCheck}\n`;
    message += `📝 *文章数:* ${articleCount} 篇\n`;
    message += `🤖 *AI 总结:* ${aiStatus}\n`;

    if (feed.error_count > 0) {
      message += `⚠️ *错误次数:* ${feed.error_count}\n`;
    }

    if (feedFilters.length > 0) {
      message += `\n🔍 *过滤规则:* ${feedFilters.length} 条\n`;
      feedFilters.forEach((filter) => {
        const type = filter.type === "include" ? "✅ 包含" : "❌ 排除";
        message += `   ${type}: ${escapeMarkdown(filter.keyword)}\n`;
      });
    } else {
      message += `\n🔍 *过滤规则:* 无\n`;
    }

    ctx.reply(message, { parse_mode: "Markdown" });
  } catch (error) {
    ctx.reply("❌ 获取详情失败: " + error.message);
  }
});

// /test 命令: 测试订阅源
bot.command("test", async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);

  if (args.length === 0) {
    return ctx.reply(
      "❌ 用法错误\n\n" +
        "正确用法: /test <订阅源ID>\n\n" +
        "使用 /list 查看所有订阅源及其 ID"
    );
  }

  const feedId = parseInt(args[0]);

  if (isNaN(feedId)) {
    return ctx.reply("❌ 订阅源 ID 必须是数字");
  }

  const feed = feeds.getById.get(feedId);
  if (!feed) {
    return ctx.reply(`❌ 订阅源 ID ${feedId} 不存在`);
  }

  try {
    await ctx.reply(`🧪 正在测试订阅源 #${feedId}...`);

    const result = await rssChecker.previewFeed(feed.url);

    let message = `✅ *测试成功*\n\n`;
    message += `🏷️ *标题:* ${escapeMarkdown(result.title)}\n`;
    message += `📝 *文章数:* ${result.articles.length} 篇\n\n`;

    if (result.articles.length > 0) {
      message += `📄 *最新文章:*\n`;
      result.articles.slice(0, 5).forEach((article, index) => {
        message += `${index + 1}. ${escapeMarkdown(article.title)}\n`;
      });
    }

    ctx.reply(message, { parse_mode: "Markdown" });
  } catch (error) {
    ctx.reply(
      `❌ 测试失败: ${error.message}\n\n请检查 URL 是否正确或网络是否可用。`
    );
  }
});

// /setinterval, /interval 命令: 设置检查间隔
bot.command(["setinterval", "interval"], async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);

  if (args.length === 0) {
    const current = settings.get.get("check_interval");
    return ctx.reply(
      `⏱️ 当前检查间隔: ${current?.value || "10"} 分钟\n\n` +
        "修改用法: /interval <分钟>\n" +
        "示例: /interval 15"
    );
  }

  const minutes = parseInt(args[0]);

  if (isNaN(minutes) || minutes < 1) {
    return ctx.reply("❌ 间隔时间必须是大于 0 的整数（分钟）");
  }

  if (minutes < 5) {
    return ctx.reply("❌ 为避免频繁请求，间隔时间不能小于 5 分钟");
  }

  try {
    settings.set.run("check_interval", minutes.toString());
    ctx.reply(
      `✅ 已更新检查间隔\n\n` +
        `新间隔: ${minutes} 分钟\n\n` +
        `✨ 将在下次检查时自动应用新间隔`
    );
  } catch (error) {
    ctx.reply("❌ 设置失败: " + error.message);
  }
});

// /setretention, /retention 命令: 设置数据保留天数
bot.command(["setretention", "retention"], async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);

  if (args.length === 0) {
    const current = settings.get.get("retention_days");
    return ctx.reply(
      `🗑️ 当前数据保留天数: ${current?.value || "30"} 天\n\n` +
        "修改用法: /retention <天数>\n" +
        "示例: /retention 60"
    );
  }

  const days = parseInt(args[0]);

  if (isNaN(days) || days < 1) {
    return ctx.reply("❌ 保留天数必须是大于 0 的整数（天）");
  }

  if (days < 7) {
    return ctx.reply("❌ 为避免误删，保留天数不能小于 7 天");
  }

  try {
    settings.set.run("retention_days", days.toString());
    ctx.reply(
      `✅ 已更新数据保留天数\n\n` +
        `新保留天数: ${days} 天\n\n` +
        `✨ 将在下次清理时自动应用新设置`
    );
  } catch (error) {
    ctx.reply("❌ 设置失败: " + error.message);
  }
});

// /retention_count 命令: 设置每个源保留的文章数量
bot.command("retention_count", async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);

  if (args.length === 0) {
    const current = settings.get.get("retention_count");
    return ctx.reply(
      `🔢 当前每个订阅源保留最新文章: ${current?.value || "100"} 篇\n\n` +
        "修改用法: /retention_count <数量>\n" +
        "示例: /retention_count 50"
    );
  }

  const count = parseInt(args[0]);

  if (isNaN(count) || count < 1) {
    return ctx.reply("❌ 数量必须是大于 0 的整数");
  }

  if (count < 10) {
    return ctx.reply("❌ 为避免误删，保留数量不能小于 10 篇");
  }

  try {
    settings.set.run("retention_count", count.toString());
    ctx.reply(
      `✅ 已更新文章保留数量\n\n` +
        `新设置: 每个源保留 ${count} 篇最新文章\n\n` +
        `✨ 您可以随时使用 /cleanup_by_count 命令手动执行清理`
    );
  } catch (error) {
    ctx.reply("❌ 设置失败: " + error.message);
  }
});

// /check 命令: 手动检查 RSS 源
bot.command("check", async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);

  // 如果有参数，检查指定订阅源
  if (args.length > 0) {
    const feedId = parseInt(args[0]);

    if (isNaN(feedId)) {
      return ctx.reply("❌ 订阅源 ID 必须是数字");
    }

    const feed = feeds.getById.get(feedId);
    if (!feed) {
      return ctx.reply(`❌ 订阅源 ID ${feedId} 不存在`);
    }

    try {
      await ctx.reply(
        `🔄 正在检查订阅源 #${feedId}: ${feed.title || feed.url}...`
      );
      await rssChecker.checkFeed(feed);
      ctx.reply(`✅ 检查完成！如有新文章会自动推送。`);
    } catch (error) {
      ctx.reply(`❌ 检查失败: ${error.message}`);
    }
    return;
  }

  // 检查所有订阅源
  const allFeeds = feeds.getAll.all();

  if (allFeeds.length === 0) {
    return ctx.reply("❌ 还没有添加任何 RSS 订阅源");
  }

  await ctx.reply(`🔄 开始检查 ${allFeeds.length} 个订阅源...`);

  try {
    await rssChecker.checkAllFeeds();
    ctx.reply("✅ 检查完成！如有新文章会自动推送。");
  } catch (error) {
    ctx.reply(`❌ 检查失败: ${error.message}`);
  }
});

// /cleanup 命令: 手动清理旧文章
bot.command("cleanup", async (ctx) => {
  await ctx.reply("🧹 开始按天数清理旧文章...");

  try {
    const result = await rssChecker.cleanupOldArticles();
    if (result.success) {
      ctx.reply(`✅ 清理完成！已删除 ${result.deletedCount} 篇旧文章。`);
    } else {
      ctx.reply(`❌ 清理失败: ${result.error}`);
    }
  } catch (error) {
    ctx.reply(`❌ 清理失败: ${error.message}`);
  }
});

// /cleanup_by_count 命令: 手动按数量清理旧文章
bot.command("cleanup_by_count", async (ctx) => {
  await ctx.reply("🔢 开始按数量清理旧文章...");

  try {
    const result = await rssChecker.cleanupByCount();
    if (result.success) {
      ctx.reply(`✅ 清理完成！已删除 ${result.deletedCount} 篇旧文章。`);
    } else {
      ctx.reply(`❌ 清理失败: ${result.error}`);
    }
  } catch (error) {
    ctx.reply(`❌ 清理失败: ${error.message}`);
  }
});

// /ai 命令: AI 总结控制
bot.command("ai", async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);

  // 无参数，显示 AI 设置
  if (args.length === 0) {
    const aiEnabled = settings.get.get("ai_summary_enabled")?.value === "true";
    const aiProvider = settings.get.get("ai_provider")?.value || "gemini";
    const minArticles = settings.get.get("ai_min_articles")?.value || "3";

    const allFeeds = feeds.getAll.all();
    const aiEnabledFeeds = allFeeds.filter((f) => f.ai_summary_enabled === 1);

    let message = `🤖 *AI 总结设置*\n\n`;
    message += `🌐 *全局状态:* ${aiEnabled ? "✅ 已启用" : "❌ 已禁用"}\n`;
    message += `🧠 *AI 提供商:* ${aiProvider}\n`;
    message += `📊 *最少文章数:* ${minArticles} 篇\n`;
    message += `📚 *已启用源:* ${aiEnabledFeeds.length} / ${allFeeds.length}\n\n`;

    if (aiEnabledFeeds.length > 0) {
      message += `🔖 *已启用 AI 的订阅源:*\n`;
      aiEnabledFeeds.forEach((feed) => {
        message += `   #${feed.id} ${escapeMarkdown(feed.title || "未命名")}\n`;
      });
      message += `\n`;
    }

    message += `💡 *用法:*\n`;
    message += `/ai on <id> \- 为订阅源启用 AI\n`;
    message += `/ai off <id> \- 为订阅源禁用 AI\n\n`;
    message += `ℹ️ 需要在 Web 管理面板中配置 API Key`;

    return ctx.reply(message, { parse_mode: "Markdown" });
  }

  // 有参数，控制 AI 开关
  const action = args[0].toLowerCase();

  if (action !== "on" && action !== "off") {
    return ctx.reply(
      "❌ 用法错误\n\n正确用法:\n/ai on <id> - 启用 AI\n/ai off <id> - 禁用 AI"
    );
  }

  if (args.length < 2) {
    return ctx.reply("❌ 请指定订阅源 ID\n\n示例: /ai on 1");
  }

  const feedId = parseInt(args[1]);

  if (isNaN(feedId)) {
    return ctx.reply("❌ 订阅源 ID 必须是数字");
  }

  const feed = feeds.getById.get(feedId);
  if (!feed) {
    return ctx.reply(`❌ 订阅源 ID ${feedId} 不存在`);
  }

  try {
    const enableAI = action === "on" ? 1 : 0;
    feeds.updateAISummary.run(enableAI, feedId);

    const status = enableAI ? "✅ 已启用" : "❌ 已禁用";
    ctx.reply(
      `${enableAI ? "✅" : "❌"} 已${enableAI ? "启用" : "禁用"} AI 总结\n\n` +
        `订阅源: #${feedId} ${feed.title || "未命名"}\n` +
        `AI 状态: ${status}\n\n` +
        `${
          enableAI
            ? "💡 下次更新时将使用 AI 生成总结"
            : "📝 下次更新时将直接推送原文"
        }`
    );
  } catch (error) {
    ctx.reply("❌ 操作失败: " + error.message);
  }
});

// 设置过滤命令
setupFilterCommands(bot);

// /export 命令: 导出订阅列表
bot.command("export", async (ctx) => {
  try {
    await ctx.reply("⏳ 正在准备导出文件...");

    const allFeeds = feeds.exportAll.all();

    // 导出的数据需要解析 filters 字段，因为它是一个 JSON 字符串
    const exportData = allFeeds.map((feed) => ({
      ...feed,
      filters: JSON.parse(feed.filters || "[]"),
    }));

    const jsonString = JSON.stringify(exportData, null, 2);
    const buffer = Buffer.from(jsonString, "utf-8");

    await ctx.replyWithDocument(
      {
        source: buffer,
        filename: "feeds_backup.json",
      },
      { caption: "📋 这是您的订阅列表备份文件。" }
    );
  } catch (error) {
    console.error("❌ 导出失败:", error);
    ctx.reply("❌ 导出失败: " + error.message);
  }
});

// /import 命令: 导入订阅列表
bot.command("import", async (ctx) => {
  if (!ctx.message.reply_to_message || !ctx.message.reply_to_message.document) {
    return ctx.reply(
      "❌ 用法错误\n\n请回复一个 `feeds_backup.json` 文件并附上 /import 命令。"
    );
  }

  const { document } = ctx.message.reply_to_message;

  if (
    document.mime_type !== "application/json" ||
    !document.file_name.endsWith(".json")
  ) {
    return ctx.reply("❌ 文件格式错误，请提供 JSON 格式的备份文件。");
  }

  try {
    await ctx.reply("⏳ 正在处理导入文件...");

    const fileLink = await ctx.telegram.getFileLink(document.file_id);
    const response = await axios.get(fileLink.href, { responseType: "json" });
    const importData = response.data;

    if (!Array.isArray(importData)) {
      return ctx.reply("❌ 导入失败：JSON 文件内容必须是一个数组。");
    }

    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const feed of importData) {
      if (!feed.url) {
        errorCount++;
        continue;
      }

      try {
        const existing = feeds.getByUrl.get(feed.url);
        if (existing) {
          skippedCount++;
          continue;
        }

        // 添加 feed
        const result = feeds.add.run(feed.url, feed.title || null);
        const feedId = result.lastInsertRowid;
        importedCount++;

        // 添加 filters
        if (Array.isArray(feed.filters)) {
          for (const filter of feed.filters) {
            if (filter.type && filter.keyword) {
              filters.add.run(feedId, filter.type, filter.keyword);
            }
          }
        }
      } catch (err) {
        console.error(`导入 ${feed.url} 时出错:`, err);
        errorCount++;
      }
    }

    ctx.reply(
      `✅ 导入完成\n\n` +
        `- 成功导入: ${importedCount} 个订阅源\n` +
        `- 跳过重复: ${skippedCount} 个订阅源\n` +
        `- 格式错误: ${errorCount} 个条目`
    );
  } catch (error) {
    console.error("❌ 导入失败:", error);
    ctx.reply("❌ 导入失败: " + error.message);
  }
});

// /checkerrors 命令: 批量检查错误源
bot.command("checkerrors", async (ctx) => {
  try {
    const allFeeds = feeds.getAll.all();

    if (allFeeds.length === 0) {
      return ctx.reply("❌ 当前没有订阅源");
    }

    await ctx.reply(
      `🔍 开始检查所有订阅源 (共 ${allFeeds.length} 个)...\n⏳ 这可能需要一些时间，请稍候`
    );

    const results = [];
    let okCount = 0;
    let errorCount = 0;

    for (const feed of allFeeds) {
      try {
        const testResult = await rssChecker.testFeed(feed.url);
        results.push({
          id: feed.id,
          title: feed.title,
          status: "ok",
          articleCount: testResult.articleCount,
        });
        okCount++;
      } catch (error) {
        results.push({
          id: feed.id,
          title: feed.title,
          status: "error",
          error: error.message,
        });
        errorCount++;
      }
    }

    // 发送结果
    let message = `✅ 检查完成!\n\n`;
    message += `📊 *统计*\n`;
    message += `- 总计: ${allFeeds.length} 个订阅源\n`;
    message += `- 正常: ${okCount} 个 ✅\n`;
    message += `- 错误: ${errorCount} 个 ❌\n\n`;

    if (errorCount > 0) {
      message += `⚠️ *错误源列表:*\n\n`;
      const errorFeeds = results.filter((r) => r.status === "error");
      errorFeeds.forEach((r) => {
        message += `#${r.id} ${r.title || "未命名"}\n`;
        message += `错误: ${r.error}\n\n`;
      });

      const errorIds = errorFeeds.map((f) => f.id).join(" ");
      message += `💡 提示: 使用以下命令批量删除错误源:\n`;
      message += `/batchrm ${errorIds}`;
    }

    ctx.reply(message, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("检查错误源失败:", error);
    ctx.reply("❌ 检查失败: " + error.message);
  }
});

// /batchrm 命令: 批量删除订阅源
bot.command("batchrm", async (ctx) => {
  try {
    const args = ctx.message.text.split(" ").slice(1);

    if (args.length === 0) {
      return ctx.reply(
        "📝 *批量删除订阅源*\n\n" +
          "用法: /batchrm ID1 ID2 ID3 ...\n\n" +
          "示例:\n" +
          "/batchrm 1 2 3\n\n" +
          "💡 提示: 可以先用 /checkerrors 检查错误源",
        { parse_mode: "Markdown" }
      );
    }

    // 解析ID列表
    const ids = [];
    for (const arg of args) {
      const id = parseInt(arg);
      if (isNaN(id)) {
        return ctx.reply(`❌ 无效的ID: ${arg}`);
      }
      ids.push(id);
    }

    if (ids.length === 0) {
      return ctx.reply("❌ 请提供要删除的订阅源ID");
    }

    // 确认删除
    const feedsList = ids
      .map((id) => {
        const feed = feeds.getById.get(id);
        return feed ? `#${id} ${feed.title || "未命名"}` : `#${id} (不存在)`;
      })
      .join("\n");

    await ctx.reply(
      `⚠️ *确认删除*\n\n` +
        `即将删除以下 ${ids.length} 个订阅源:\n\n` +
        feedsList +
        `\n\n` +
        `发送 /confirm 确认删除\n` +
        `发送任意其他内容取消`,
      { parse_mode: "Markdown" }
    );

    // 等待确认
    const confirmHandler = (confirmCtx) => {
      if (confirmCtx.chat.id !== ctx.chat.id) return;

      const text = confirmCtx.message?.text;

      if (text === "/confirm") {
        // 执行删除
        let successCount = 0;
        let failedCount = 0;
        const failedList = [];

        for (const id of ids) {
          try {
            const feed = feeds.getById.get(id);
            if (!feed) {
              failedList.push(`#${id} (不存在)`);
              failedCount++;
              continue;
            }

            feeds.remove.run(id);
            successCount++;
          } catch (error) {
            failedList.push(`#${id} (${error.message})`);
            failedCount++;
          }
        }

        let resultMsg = `✅ 批量删除完成!\n\n`;
        resultMsg += `- 成功: ${successCount} 个\n`;
        resultMsg += `- 失败: ${failedCount} 个\n`;

        if (failedCount > 0) {
          resultMsg += `\n❌ 失败列表:\n${failedList.join("\n")}`;
        }

        confirmCtx.reply(resultMsg);
        bot.off("text", confirmHandler);
      } else if (text) {
        confirmCtx.reply("❌ 已取消删除操作");
        bot.off("text", confirmHandler);
      }
    };

    bot.on("text", confirmHandler);

    // 30秒后自动取消
    setTimeout(() => {
      bot.off("text", confirmHandler);
    }, 30000);
  } catch (error) {
    console.error("批量删除失败:", error);
    ctx.reply("❌ 批量删除失败: " + error.message);
  }
});

// 错误处理
bot.catch((err, ctx) => {
  console.error("Bot error:", err);
  ctx.reply("❌ 发生错误，请稍后重试");
});

module.exports = { bot, rssChecker, errorHandler };
