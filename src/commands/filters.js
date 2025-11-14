const { filters, feeds } = require("../database");

function setupFilterCommands(bot) {
  // 添加过滤规则: /addfilter, /f <feed_id> <include|exclude> <keyword>
  bot.command(["addfilter", "f"], async (ctx) => {
    const args = ctx.message.text.split(" ").slice(1);

    if (args.length < 3) {
      return ctx.reply(
        "❌ 用法错误\n\n" +
          "正确用法: /f <订阅源ID> <include|exclude> <关键词>\n\n" +
          "示例:\n" +
          "/f 1 include 科技\n" +
          "/f 2 exclude 广告"
      );
    }

    const feedId = parseInt(args[0]);
    const type = args[1].toLowerCase();
    const keyword = args.slice(2).join(" ");

    if (isNaN(feedId)) {
      return ctx.reply("❌ 订阅源 ID 必须是数字");
    }

    if (!["include", "exclude"].includes(type)) {
      return ctx.reply("❌ 类型必须是 include 或 exclude");
    }

    // 检查 feed 是否存在
    const feed = feeds.getById.get(feedId);
    if (!feed) {
      return ctx.reply(`❌ 订阅源 ID ${feedId} 不存在`);
    }

    try {
      filters.add.run(feedId, type, keyword);
      const typeText = type === "include" ? "包含" : "排除";
      ctx.reply(
        `✅ 已添加过滤规则\n\n` +
          `订阅源: ${feed.title || feed.url}\n` +
          `类型: ${typeText}\n` +
          `关键词: ${keyword}`
      );
    } catch (error) {
      ctx.reply("❌ 添加过滤规则失败: " + error.message);
    }
  });

  // 删除过滤规则: /removefilter, /rf <filter_id>
  bot.command(["removefilter", "rf"], async (ctx) => {
    const args = ctx.message.text.split(" ").slice(1);

    if (args.length === 0) {
      return ctx.reply(
        "❌ 用法错误\n\n" +
          "正确用法: /rf <过滤规则ID>\n\n" +
          "使用 /lf 查看所有过滤规则及其 ID"
      );
    }

    const filterId = parseInt(args[0]);

    if (isNaN(filterId)) {
      return ctx.reply("❌ 过滤规则 ID 必须是数字");
    }

    const filter = filters.getById.get(filterId);
    if (!filter) {
      return ctx.reply(
        `❌ 过滤规则 ID ${filterId} 不存在\n\n` +
          `使用 /listfilters 查看所有过滤规则的 ID\n` +
          `注意：过滤规则 ID 不是订阅源 ID`
      );
    }

    try {
      const feed = feeds.getById.get(filter.feed_id);
      const typeText = filter.type === "include" ? "包含" : "排除";

      filters.remove.run(filterId);

      ctx.reply(
        `✅ 已删除过滤规则\n\n` +
          `规则 ID: #${filterId}\n` +
          `订阅源: ${feed?.title || feed?.url || "未知"}\n` +
          `类型: ${typeText}\n` +
          `关键词: ${filter.keyword}`
      );
    } catch (error) {
      ctx.reply("❌ 删除过滤规则失败: " + error.message);
    }
  });

  // 查看过滤规则: /listfilters, /lf [feed_id]
  bot.command(["listfilters", "lf"], async (ctx) => {
    const args = ctx.message.text.split(" ").slice(1);
    let filterList;

    if (args.length > 0) {
      const feedId = parseInt(args[0]);
      if (isNaN(feedId)) {
        return ctx.reply("❌ 订阅源 ID 必须是数字");
      }

      const feed = feeds.getById.get(feedId);
      if (!feed) {
        return ctx.reply(`❌ 订阅源 ID ${feedId} 不存在`);
      }

      filterList = filters.getByFeed.all(feedId);

      if (filterList.length === 0) {
        return ctx.reply(
          `📋 订阅源 "${feed.title || feed.url}" 没有设置过滤规则`
        );
      }

      let message = `📋 *订阅源过滤规则*\n\n订阅源: ${
        feed.title || feed.url
      }\n\n`;
      filterList.forEach((filter) => {
        const typeText = filter.type === "include" ? "包含" : "排除";
        message += `#${filter.id} [${typeText}] ${filter.keyword}\n`;
      });

      ctx.reply(message);
    } else {
      filterList = filters.getAll.all();

      if (filterList.length === 0) {
        return ctx.reply("📋 还没有设置任何过滤规则");
      }

      let message = "📋 *所有过滤规则*\n\n";
      let currentFeedId = null;

      filterList.forEach((filter) => {
        if (filter.feed_id !== currentFeedId) {
          currentFeedId = filter.feed_id;
          const feed = feeds.getById.get(filter.feed_id);
          message += `\n📡 ${feed?.title || feed?.url || "未知源"}\n`;
        }
        const typeText = filter.type === "include" ? "包含" : "排除";
        message += `  #${filter.id} [${typeText}] ${filter.keyword}\n`;
      });

      ctx.reply(message);
    }
  });
}

module.exports = setupFilterCommands;
