const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const { DATA_RETENTION, AI } = require("./constants");

const dataDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dataDir, "rss.db");

// 确保 data 目录存在
if (!fs.existsSync(dataDir)) {
  console.log(`📁 创建数据目录: ${dataDir}`);
  fs.mkdirSync(dataDir, { recursive: true });
} else {
  console.log(`📂 数据目录已存在: ${dataDir}`);
}

// 列出 data 目录内容
try {
  const files = fs.readdirSync(dataDir);
  console.log(`📋 数据目录内容 (${files.length} 个文件):`, files);
} catch (err) {
  console.error(`❌ 无法读取数据目录:`, err);
}

console.log(`📊 数据库路径: ${dbPath}`);
console.log(`✅ 数据库文件存在: ${fs.existsSync(dbPath)}`);

// 如果数据库文件存在，显示文件大小
if (fs.existsSync(dbPath)) {
  const stats = fs.statSync(dbPath);
  console.log(`📏 数据库文件大小: ${stats.size} 字节`);
}

const db = new Database(dbPath);

// 启用 WAL 模式以提高性能和并发性
db.pragma("journal_mode = WAL");

console.log(`✅ 数据库已连接: ${dbPath}`);

// 创建表结构
db.exec(`
  CREATE TABLE IF NOT EXISTS feeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    title TEXT,
    last_check INTEGER,
    error_count INTEGER DEFAULT 0,
    ai_summary_enabled INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feed_id INTEGER NOT NULL,
    guid TEXT NOT NULL,
    title TEXT,
    link TEXT,
    published_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE,
    UNIQUE(feed_id, guid)
  );

  CREATE TABLE IF NOT EXISTS filters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feed_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('include', 'exclude')),
    keyword TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// 数据库迁移: 添加 ai_summary_enabled 列(如果不存在)
try {
  const columns = db.prepare("PRAGMA table_info(feeds)").all();
  const hasAIColumn = columns.some((col) => col.name === "ai_summary_enabled");
  if (!hasAIColumn) {
    console.log("📝 添加 ai_summary_enabled 列到 feeds 表");
    db.exec(
      "ALTER TABLE feeds ADD COLUMN ai_summary_enabled INTEGER DEFAULT 0"
    );
  }
} catch (error) {
  console.error("数据库迁移失败:", error);
}

// 初始化默认设置
const insertSetting = db.prepare(
  "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
);
insertSetting.run(
  "check_interval",
  process.env.CHECK_INTERVAL || DATA_RETENTION.DEFAULT_CHECK_INTERVAL.toString()
);
insertSetting.run(
  "retention_days",
  process.env.RETENTION_DAYS || DATA_RETENTION.DEFAULT_DAYS.toString()
);
insertSetting.run(
  "retention_count",
  process.env.RETENTION_COUNT || DATA_RETENTION.DEFAULT_COUNT.toString()
);
insertSetting.run("ai_summary_enabled", "false");
insertSetting.run("ai_provider", "gemini");
insertSetting.run("ai_api_key_gemini", "");
insertSetting.run("ai_api_key_deepseek", "");
insertSetting.run("ai_api_key_qwen", "");
insertSetting.run("ai_model_gemini", "");
insertSetting.run("ai_model_deepseek", "");
insertSetting.run("ai_model_qwen", "");
insertSetting.run("ai_min_articles", AI.DEFAULT_MIN_ARTICLES.toString()); // 最少文章数量才生成总结

// 输出数据库统计信息
const feedCount = db.prepare("SELECT COUNT(*) as count FROM feeds").get();
const articleCount = db.prepare("SELECT COUNT(*) as count FROM articles").get();
console.log(
  `📊 当前统计: ${feedCount.count} 个订阅源, ${articleCount.count} 篇文章`
);

// Feeds 操作
const feedsDb = {
  add: db.prepare("INSERT INTO feeds (url, title) VALUES (?, ?)"),
  remove: db.prepare("DELETE FROM feeds WHERE id = ?"),
  getById: db.prepare("SELECT * FROM feeds WHERE id = ?"),
  getByUrl: db.prepare("SELECT * FROM feeds WHERE url = ?"),
  getAll: db.prepare("SELECT * FROM feeds ORDER BY id"),
  updateTitle: db.prepare("UPDATE feeds SET title = ? WHERE id = ?"),
  updateLastCheck: db.prepare("UPDATE feeds SET last_check = ? WHERE id = ?"),
  updateErrorCount: db.prepare("UPDATE feeds SET error_count = ? WHERE id = ?"),
  resetErrorCount: db.prepare("UPDATE feeds SET error_count = 0 WHERE id = ?"),
  updateAISummary: db.prepare(
    "UPDATE feeds SET ai_summary_enabled = ? WHERE id = ?"
  ),
  exportAll: db.prepare(`
    SELECT
      f.url,
      f.title,
      json_group_array(
        json_object('type', fi.type, 'keyword', fi.keyword)
      ) FILTER (WHERE fi.id IS NOT NULL) as filters
    FROM
      feeds f
    LEFT JOIN
      filters fi ON f.id = fi.feed_id
    GROUP BY
      f.id
  `),
};

// Articles 操作
const articlesDb = {
  add: db.prepare(
    "INSERT OR IGNORE INTO articles (feed_id, guid, title, link, published_at) VALUES (?, ?, ?, ?, ?)"
  ),
  exists: db.prepare(
    "SELECT 1 FROM articles WHERE feed_id = ? AND guid = ? LIMIT 1"
  ),
  getByFeed: db.prepare(
    "SELECT * FROM articles WHERE feed_id = ? ORDER BY published_at DESC LIMIT ?"
  ),
  deleteByFeed: db.prepare("DELETE FROM articles WHERE feed_id = ?"),
  deleteOlderThan: db.prepare("DELETE FROM articles WHERE published_at < ?"),
  deleteByCount: db.prepare(`
    DELETE FROM articles
    WHERE id IN (
      SELECT id
      FROM (
        SELECT
          id,
          ROW_NUMBER() OVER(PARTITION BY feed_id ORDER BY published_at DESC) as rn
        FROM articles
      )
      WHERE rn > ?
    )
  `),
  getCount: db.prepare("SELECT COUNT(*) as count FROM articles"),
};

// Filters 操作
const filtersDb = {
  add: db.prepare(
    "INSERT INTO filters (feed_id, type, keyword) VALUES (?, ?, ?)"
  ),
  remove: db.prepare("DELETE FROM filters WHERE id = ?"),
  getById: db.prepare("SELECT * FROM filters WHERE id = ?"),
  getByFeed: db.prepare("SELECT * FROM filters WHERE feed_id = ? ORDER BY id"),
  getAll: db.prepare("SELECT * FROM filters ORDER BY feed_id, id"),
};

// Settings 操作
const settingsDb = {
  get: db.prepare("SELECT value FROM settings WHERE key = ?"),
  set: db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)"),
  delete: db.prepare("DELETE FROM settings WHERE key = ?"),
};

module.exports = {
  db,
  feeds: feedsDb,
  articles: articlesDb,
  filters: filtersDb,
  settings: settingsDb,
};
