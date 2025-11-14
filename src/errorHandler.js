const { feeds } = require("./database");

class ErrorHandler {
  constructor(bot, chatId) {
    this.bot = bot;
    this.chatId = chatId;
    this.maxErrorCount = 3;
  }

  async handleRSSError(feedId, feedUrl, error) {
    console.error(`RSS Error for feed ${feedId} (${feedUrl}):`, error.message);

    const feed = feeds.getById.get(feedId);
    if (!feed) return;

    const newErrorCount = (feed.error_count || 0) + 1;
    feeds.updateErrorCount.run(newErrorCount, feedId);

    // 连续失败 3 次后通知用户
    if (newErrorCount >= this.maxErrorCount) {
      const message =
        `⚠️ *RSS 源错误*\n\n` +
        `订阅源: ${feed.title || "未命名"}\n` +
        `URL: \`${feedUrl}\`\n` +
        `错误: ${error.message}\n\n` +
        `该源已连续失败 ${newErrorCount} 次，请检查 URL 是否有效。`;

      try {
        await this.bot.telegram.sendMessage(this.chatId, message, {
          parse_mode: "Markdown",
        });
      } catch (err) {
        console.error("Failed to send error notification:", err);
      }
    }
  }

  async handleSuccess(feedId) {
    const feed = feeds.getById.get(feedId);
    if (feed && feed.error_count > 0) {
      feeds.resetErrorCount.run(feedId);
    }
  }

  async notifyGeneralError(message) {
    try {
      await this.bot.telegram.sendMessage(this.chatId, `❌ 错误: ${message}`, {
        parse_mode: "Markdown",
      });
    } catch (err) {
      console.error("Failed to send general error notification:", err);
    }
  }
}

module.exports = ErrorHandler;
