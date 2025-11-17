require("dotenv").config();
const axios = require("axios");
const { Telegraf } = require("telegraf");
const { feeds, filters, settings } = require("./database");
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
    `👋 欢迎使用 Telegram RSS Bot\n\n` +
    `📖 RSS 源管理\n` +
    `/add <url> - 添加订阅源\n` +
    `/rm <id> - 删除订阅源\n` +
    `/rename <id> <新名称> - 重命名订阅源\n` +
    `/ls - 查看所有订阅源\n` +
    `/check - 手动检查更新\n\n` +
    `📥 导入 & 导出\n` +
    `/export - 导出订阅列表为 JSON 文件\n` +
    `/import - 回复备份文件以导入订阅\n\n` +
    `🔍 过滤管理\n` +
    `/f <订阅源ID> <include|exclude> <关键词> - 添加过滤\n` +
    `/rf <过滤规则ID> - 删除过滤\n` +
    `/lf [订阅源ID] - 查看过滤规则\n\n` +
    `⚙️ 设置\n` +
    `/interval <分钟> - 设置检查间隔\n` +
    `/retention <天数> - 设置数据保留天数\n` +
    `/retention_count <数量> - 设置每个源保留的文章数\n` +
    `/cleanup - 手动按天数清理\n` +
    `/cleanup_by_count - 手动按数量清理\n` +
    `/help - 显示帮助`;

  ctx.reply(message);
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
    const info = feeds.updateTitle.run(newTitle, feedId);
    console.log(`[DEBUG /rename] DB update info for feed ${feedId}:`, info);
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
  console.log("[DEBUG /ls] Feeds fetched from DB:", allFeeds);

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

// 错误处理
bot.catch((err, ctx) => {
  console.error("Bot error:", err);
  ctx.reply("❌ 发生错误，请稍后重试");
});

module.exports = { bot, rssChecker };
