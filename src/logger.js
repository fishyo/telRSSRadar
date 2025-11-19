// 简单的日志工具
const DEBUG_MODE = process.env.DEBUG === "true";

// 日志缓存 (保留最近1000条)
const logCache = [];
const MAX_LOGS = 1000;

function addToCache(level, message) {
  const timestamp = Date.now();
  const logEntry = {
    timestamp,
    level,
    message,
    time: new Date(timestamp).toLocaleString("zh-CN"),
  };

  logCache.push(logEntry);

  // 保持最大数量限制
  if (logCache.length > MAX_LOGS) {
    logCache.shift();
  }
}

// 保存原始 console 方法
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
};

// 重写 console 方法以捕获所有日志
console.log = function (...args) {
  const message = args
    .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg)))
    .join(" ");
  addToCache("info", message);
  originalConsole.log.apply(console, args);
};

console.info = function (...args) {
  const message = args
    .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg)))
    .join(" ");
  addToCache("info", message);
  originalConsole.info.apply(console, args);
};

console.warn = function (...args) {
  const message = args
    .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg)))
    .join(" ");
  addToCache("warn", message);
  originalConsole.warn.apply(console, args);
};

console.error = function (...args) {
  const message = args
    .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg)))
    .join(" ");
  addToCache("error", message);
  originalConsole.error.apply(console, args);
};

console.debug = function (...args) {
  const message = args
    .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg)))
    .join(" ");
  if (DEBUG_MODE) {
    addToCache("debug", message);
    originalConsole.debug.apply(console, args);
  }
};

const logger = {
  debug: (...args) => {
    if (DEBUG_MODE) {
      console.debug("[DEBUG]", ...args);
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
  getLogs: (limit = 100) => {
    return logCache.slice(-limit).reverse();
  },
  clearLogs: () => {
    logCache.length = 0;
  },
};

module.exports = logger;
