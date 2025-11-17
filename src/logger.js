// 简单的日志工具
const DEBUG_MODE = process.env.DEBUG === "true";

const logger = {
  debug: (...args) => {
    if (DEBUG_MODE) {
      console.log("[DEBUG]", ...args);
    }
  },
  info: (...args) => {
    console.log("[INFO]", ...args);
  },
  warn: (...args) => {
    console.warn("[WARN]", ...args);
  },
  error: (...args) => {
    console.error("[ERROR]", ...args);
  },
};

module.exports = logger;
