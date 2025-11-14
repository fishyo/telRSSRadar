// Markdown 特殊字符转义 (MarkdownV2)
function escapeMarkdown(text) {
  if (!text) return "";
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

// 格式化时间戳
function formatDate(timestamp) {
  if (!timestamp) return "未知时间";
  const date = new Date(timestamp * 1000);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 截断文本
function truncate(text, maxLength = 200) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

module.exports = {
  escapeMarkdown,
  formatDate,
  truncate,
};
