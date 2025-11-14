const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "../data.db"));

// 创建表结构
db.exec(`
  CREATE TABLE IF NOT EXISTS feeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    title TEXT,
    last_check INTEGER,
    error_count INTEGER DEFAULT 0,
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

// 初始化默认设置
const insertSetting = db.prepare(
  "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
);
insertSetting.run("check_interval", process.env.CHECK_INTERVAL || "10");
insertSetting.run("retention_days", process.env.RETENTION_DAYS || "30");

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
  deleteOlderThan: db.prepare("DELETE FROM articles WHERE created_at < ?"),
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
};

module.exports = {
  db,
  feeds: feedsDb,
  articles: articlesDb,
  filters: filtersDb,
  settings: settingsDb,
};
