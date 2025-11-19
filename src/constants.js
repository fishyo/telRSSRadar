// 应用配置常量
module.exports = {
  // RSS 相关配置
  RSS: {
    INITIAL_ARTICLE_COUNT: 10, // 初始记录文章数
    PREVIEW_ARTICLE_COUNT: 10, // 预览显示文章数
    MAX_DESCRIPTION_LENGTH: 200, // 文章描述最大长度
  },

  // AI 相关配置
  AI: {
    REQUEST_TIMEOUT: 30000, // AI请求超时时间（毫秒）
    DEFAULT_MIN_ARTICLES: 3, // 默认最小文章数触发AI总结
    MAX_MIN_ARTICLES: 20, // 最大文章数限制
  },

  // 错误处理配置
  ERROR: {
    MAX_RETRY_COUNT: 3, // 最大错误重试次数
  },

  // Telegraph 配置
  TELEGRAPH: {
    SHORT_NAME: "RSS Bot", // Telegraph账号简称
    AUTHOR_NAME: "RSS Bot", // 作者名称
  },

  // Web服务器配置
  WEB: {
    DEFAULT_PORT: 3000, // 默认端口
  },

  // 数据保留配置
  DATA_RETENTION: {
    DEFAULT_DAYS: 30, // 默认保留天数
    DEFAULT_COUNT: 100, // 默认每源保留文章数
    DEFAULT_CHECK_INTERVAL: 10, // 默认检查间隔（分钟）
  },
};
