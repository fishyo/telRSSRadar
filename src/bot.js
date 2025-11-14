require("dotenv").config();
const { Telegraf } = require("telegraf");
const { feeds, settings } = require("./database");
const setupFilterCommands = require("./commands/filters");
const RSSChecker = require("./rssChecker");
const ErrorHandler = require("./errorHandler");
const { escapeMarkdown } = require("./utils");

const bot = new Telegraf(process.env.BOT_TOKEN);
const chatId = process.env.CHAT_ID;

// 初始化错误处理器和 RSS 检查器
const errorHandler = new ErrorHandler(bot, chatId);
const rssChecker = new RSSChecker(bot, chatId, errorHandler);

// /start 命令
bot.command("start", (ctx) => {
  const message =
    `👋 *欢迎使用 Telegram RSS Bot*\n\n` +
    `📖 *RSS 源管理*\n` +
    `/add <url> - 添加订阅源\n` +
    `/rm <id> - 删除订阅源\n` +
    `/rename <id> <新名称> - 重命名订阅源\n` +
    `/ls - 查看所有订阅源\n` +
    `/check - 手动检查更新\n\n` +
    `🔍 *过滤管理*\n` +
    `/f <订阅源ID> <include|exclude> <关键词> - 添加过滤\n` +
    `/rf <过滤规则ID> - 删除过滤\n` +
    `/lf [订阅源ID] - 查看过滤规则\n\n` +
    `⚙️ *设置*\n` +
    `/interval <分钟> - 设置检查间隔\n` +
    `/retention <天数> - 设置数据保留天数\n` +
    `/cleanup - 手动清理旧文章\n` +
    `/help - 显示帮助`;

  ctx.reply(message, { parse_mode: "Markdown" });
});

// /help 命令
bot.command("help", (ctx) => {
  ctx.telegram.sendMessage(ctx.chat.id, "使用 /start 查看所有可用命令");
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
    feeds.updateTitle.run(newTitle, feedId);
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

// /check 命令: 手动检查所有 RSS 源
bot.command("check", async (ctx) => {
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
  await ctx.reply("🧹 开始清理旧文章...");

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

// 设置过滤命令
setupFilterCommands(bot);

// 错误处理
bot.catch((err, ctx) => {
  console.error("Bot error:", err);
  ctx.reply("❌ 发生错误，请稍后重试");
});

module.exports = { bot, rssChecker };
