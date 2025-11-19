const express = require("express");
const path = require("path");
const { feeds, articles, filters, settings } = require("./database");
const RSSChecker = require("./rssChecker");
const logger = require("./logger");

function createWebServer(bot, chatId, errorHandler) {
  const app = express();
  const rssChecker = new RSSChecker(bot, chatId, errorHandler);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API routes first (before static files)

  // API: 获取所有订阅源
  app.get("/api/feeds", (req, res) => {
    try {
      const allFeeds = feeds.getAll.all();
      res.json({ success: true, data: allFeeds });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API: 添加订阅源
  // API: 预览 RSS 源
  app.post("/api/feeds/preview", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ success: false, error: "缺少 URL 参数" });
      }

      // 验证 URL 格式
      try {
        new URL(url);
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: "URL 格式无效，请检查是否包含 http:// 或 https://",
        });
      }

      const previewResult = await rssChecker.previewFeed(url);
      res.json({ success: true, data: previewResult });
    } catch (error) {
      console.error("预览RSS源失败:", error);
      let errorMessage = error.message;

      // 根据错误类型提供更友好的提示
      if (
        errorMessage.includes("ENOTFOUND") ||
        errorMessage.includes("getaddrinfo")
      ) {
        errorMessage = "无法访问该地址，请检查 URL 是否正确";
      } else if (
        errorMessage.includes("ETIMEDOUT") ||
        errorMessage.includes("timeout")
      ) {
        errorMessage = "连接超时，请检查网络或稍后重试";
      } else if (errorMessage.includes("ECONNREFUSED")) {
        errorMessage = "连接被拒绝，服务器可能不可用";
      } else if (
        errorMessage.includes("Invalid XML") ||
        errorMessage.includes("Non-whitespace")
      ) {
        errorMessage = "该链接不是有效的 RSS/Atom 源";
      }

      res.status(500).json({ success: false, error: errorMessage });
    }
  });

  // API: 添加订阅源
  app.post("/api/feeds", async (req, res) => {
    try {
      const {
        url,
        pushLatest = false,
        pushCount = 5,
        enableAI = false,
      } = req.body;
      if (!url) {
        return res.status(400).json({ success: false, error: "缺少 URL 参数" });
      }

      // 检查是否已存在
      const existing = feeds.getByUrl.get(url);
      if (existing) {
        return res
          .status(400)
          .json({ success: false, error: "该 RSS 源已存在" });
      }

      // 添加到数据库
      const result = feeds.add.run(url, null);
      const feedId = result.lastInsertRowid;

      // 设置 AI 总结开关
      if (enableAI) {
        feeds.updateAISummary.run(1, feedId);
      }

      // 拉取最新文章
      const fetchResult = await rssChecker.fetchInitialArticles(
        feedId,
        url,
        pushLatest,
        pushCount
      );

      res.json({
        success: true,
        data: {
          id: feedId,
          title: fetchResult.title,
          url: url,
          articleCount: fetchResult.count,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API: 删除订阅源
  app.delete("/api/feeds/:id", (req, res) => {
    try {
      const feedId = parseInt(req.params.id);
      const feed = feeds.getById.get(feedId);

      if (!feed) {
        return res.status(404).json({ success: false, error: "订阅源不存在" });
      }

      feeds.remove.run(feedId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API: 重命名订阅源
  app.put("/api/feeds/:id", (req, res) => {
    try {
      const feedId = parseInt(req.params.id);
      const { title, aiSummaryEnabled } = req.body;

      const feed = feeds.getById.get(feedId);
      if (!feed) {
        return res.status(404).json({ success: false, error: "订阅源不存在" });
      }

      if (title !== undefined) {
        feeds.updateTitle.run(title, feedId);
      }

      if (aiSummaryEnabled !== undefined) {
        feeds.updateAISummary.run(aiSummaryEnabled ? 1 : 0, feedId);
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API: 获取指定订阅源的过滤规则
  app.get("/api/feeds/:id/filters", (req, res) => {
    try {
      const feedId = parseInt(req.params.id);
      const feedFilters = filters.getByFeed.all(feedId);
      res.json({ success: true, data: feedFilters });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API: 获取指定订阅源的文章列表
  app.get("/api/feeds/:id/articles", (req, res) => {
    try {
      const feedId = parseInt(req.params.id);
      const limit = parseInt(req.query.limit) || 50;
      const feedArticles = articles.getByFeed.all(feedId, limit);
      res.json({ success: true, data: feedArticles });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API: 清理指定订阅源的文章
  app.delete("/api/feeds/:id/articles", (req, res) => {
    try {
      const feedId = parseInt(req.params.id);
      const feed = feeds.getById.get(feedId);

      if (!feed) {
        return res.status(404).json({ success: false, error: "订阅源不存在" });
      }

      const result = articles.deleteByFeed.run(feedId);
      res.json({ success: true, deletedCount: result.changes });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API: 批量检查错误源
  app.post("/api/feeds/check-errors", async (req, res) => {
    try {
      const allFeeds = feeds.getAll.all();
      const results = [];

      for (const feed of allFeeds) {
        try {
          const testResult = await rssChecker.testFeed(feed.url);
          results.push({
            id: feed.id,
            title: feed.title,
            url: feed.url,
            status: "ok",
            articleCount: testResult.articleCount,
            latestArticle: testResult.latestArticle,
          });
        } catch (error) {
          results.push({
            id: feed.id,
            title: feed.title,
            url: feed.url,
            status: "error",
            error: error.message,
          });
        }
      }

      const errorFeeds = results.filter((r) => r.status === "error");
      const okFeeds = results.filter((r) => r.status === "ok");

      res.json({
        success: true,
        data: {
          total: allFeeds.length,
          ok: okFeeds.length,
          error: errorFeeds.length,
          results: results,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API: 批量删除订阅源
  app.post("/api/feeds/batch-delete", (req, res) => {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "请提供要删除的订阅源ID数组" });
      }

      const results = {
        success: [],
        failed: [],
      };

      for (const id of ids) {
        try {
          const feedId = parseInt(id);
          const feed = feeds.getById.get(feedId);

          if (!feed) {
            results.failed.push({ id: feedId, error: "订阅源不存在" });
            continue;
          }

          feeds.remove.run(feedId);
          results.success.push({ id: feedId, title: feed.title });
        } catch (error) {
          results.failed.push({ id: parseInt(id), error: error.message });
        }
      }

      res.json({
        success: true,
        data: {
          deleted: results.success.length,
          failed: results.failed.length,
          results: results,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API: 添加过滤规则
  app.post("/api/filters", (req, res) => {
    try {
      const { feedId, type, keyword } = req.body;

      if (!feedId || !type || !keyword) {
        return res.status(400).json({ success: false, error: "缺少必要参数" });
      }

      if (!["include", "exclude"].includes(type)) {
        return res.status(400).json({ success: false, error: "过滤类型无效" });
      }

      const result = filters.add.run(feedId, type, keyword);
      res.json({ success: true, data: { id: result.lastInsertRowid } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API: 删除过滤规则
  app.delete("/api/filters/:id", (req, res) => {
    try {
      const filterId = parseInt(req.params.id);
      filters.remove.run(filterId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API: 获取统计信息
  app.get("/api/stats", (req, res) => {
    try {
      const allFeeds = feeds.getAll.all();
      const feedCount = allFeeds.length;
      const articleCount = articles.getCount.get().count;
      const retentionDays = settings.get.get("retention_days")?.value || "30";
      const retentionCount =
        settings.get.get("retention_count")?.value || "100";
      const checkInterval = settings.get.get("check_interval")?.value || "10";

      // 计算每个源的文章数
      const feedStats = allFeeds.map((feed) => {
        const count = articles.getByFeed.all(feed.id, 999999).length;
        return { feedId: feed.id, articleCount: count };
      });

      // 获取数据库信息
      const fs = require("fs");
      const path = require("path");
      const dbPath = path.join(__dirname, "..", "data", "rss.db");
      let dbSize = 0;
      let dbSizeFormatted = "0 B";

      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        dbSize = stats.size;
        // 格式化文件大小
        if (dbSize < 1024) {
          dbSizeFormatted = dbSize + " B";
        } else if (dbSize < 1024 * 1024) {
          dbSizeFormatted = (dbSize / 1024).toFixed(2) + " KB";
        } else if (dbSize < 1024 * 1024 * 1024) {
          dbSizeFormatted = (dbSize / (1024 * 1024)).toFixed(2) + " MB";
        } else {
          dbSizeFormatted = (dbSize / (1024 * 1024 * 1024)).toFixed(2) + " GB";
        }
      }

      res.json({
        success: true,
        data: {
          feedCount,
          articleCount,
          retentionDays: parseInt(retentionDays),
          retentionCount: parseInt(retentionCount),
          checkInterval: parseInt(checkInterval),
          feedStats,
          database: {
            path: dbPath,
            size: dbSize,
            sizeFormatted: dbSizeFormatted,
            exists: fs.existsSync(dbPath),
          },
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API: 更新设置
  app.put("/api/settings", (req, res) => {
    try {
      const { retentionDays, retentionCount, checkInterval } = req.body;

      if (retentionDays !== undefined) {
        settings.set.run("retention_days", retentionDays.toString());
      }
      if (retentionCount !== undefined) {
        settings.set.run("retention_count", retentionCount.toString());
      }
      if (checkInterval !== undefined) {
        settings.set.run("check_interval", checkInterval.toString());
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API: 手动清理（按天数）
  app.post("/api/cleanup/days", async (req, res) => {
    try {
      const result = await rssChecker.cleanupOldArticles();
      res.json({ success: true, deletedCount: result.deletedCount });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API: 获取日志
  app.get("/api/logs", (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const logs = logger.getLogs(limit);
      res.json({ success: true, data: logs });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API: 清空日志
  app.post("/api/logs/clear", (req, res) => {
    try {
      logger.clearLogs();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API: 手动清理（按数量）
  app.post("/api/cleanup/count", async (req, res) => {
    try {
      const result = await rssChecker.cleanupByCount();
      res.json({ success: true, deletedCount: result.deletedCount });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API: 手动检查更新
  app.post("/api/check", async (req, res) => {
    try {
      const allFeeds = feeds.getAll.all();
      let successCount = 0;
      let failCount = 0;

      for (const feed of allFeeds) {
        const result = await rssChecker.checkFeed(feed.id);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      res.json({ success: true, data: { successCount, failCount } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API: 获取 AI 设置
  app.get("/api/ai-settings", (req, res) => {
    try {
      const enabled = settings.get.get("ai_summary_enabled")?.value === "true";
      const provider = settings.get.get("ai_provider")?.value || "gemini";
      const minArticles = parseInt(
        settings.get.get("ai_min_articles")?.value || "3"
      );

      // 获取当前提供商的 API Key 和 Model
      const apiKey = settings.get.get(`ai_api_key_${provider}`)?.value || "";
      const model = settings.get.get(`ai_model_${provider}`)?.value || "";

      // 安全处理 API Key:永不返回完整密钥
      let maskedKey = "";
      if (apiKey) {
        const visibleChars = Math.min(4, apiKey.length);
        maskedKey = "***" + apiKey.slice(-visibleChars);
      }

      res.json({
        success: true,
        data: {
          enabled,
          provider,
          apiKey: maskedKey,
          model,
          minArticles,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API: 更新 AI 设置
  app.put("/api/ai-settings", (req, res) => {
    try {
      const { enabled, provider, apiKey, model, minArticles } = req.body;

      if (enabled !== undefined) {
        settings.set.run("ai_summary_enabled", enabled ? "true" : "false");
      }
      if (provider) {
        settings.set.run("ai_provider", provider);
      }
      // 保存到对应提供商的 API Key 字段
      if (apiKey && !apiKey.startsWith("***")) {
        settings.set.run(`ai_api_key_${provider}`, apiKey);
      }
      // 保存到对应提供商的 Model 字段
      if (model !== undefined) {
        settings.set.run(`ai_model_${provider}`, model);
      }
      if (minArticles !== undefined) {
        settings.set.run("ai_min_articles", minArticles.toString());
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API: 删除 AI API Key
  app.delete("/api/ai-settings/apikey/:provider", (req, res) => {
    try {
      const { provider } = req.params;
      const keyName = `ai_api_key_${provider}`;

      settings.delete.run(keyName);

      res.json({ success: true, message: `已删除 ${provider} 的 API Key` });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API: 导出订阅源 (JSON)
  app.get("/api/feeds/export/json", (req, res) => {
    try {
      const allFeeds = feeds.getAll.all();
      const exportData = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        feeds: allFeeds.map((feed) => ({
          title: feed.title,
          url: feed.url,
          ai_summary_enabled: feed.ai_summary_enabled === 1,
        })),
      };

      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="rss-feeds-${Date.now()}.json"`
      );
      res.json(exportData);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API: 导出订阅源 (OPML)
  app.get("/api/feeds/export/opml", (req, res) => {
    try {
      const allFeeds = feeds.getAll.all();

      let opml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      opml += '<opml version="2.0">\n';
      opml += "  <head>\n";
      opml += `    <title>RSS Feeds Export</title>\n`;
      opml += `    <dateCreated>${new Date().toUTCString()}</dateCreated>\n`;
      opml += "  </head>\n";
      opml += "  <body>\n";
      opml += '    <outline text="Feeds">\n';

      allFeeds.forEach((feed) => {
        const title = feed.title
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
        const url = feed.url
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
        opml += `      <outline type="rss" text="${title}" xmlUrl="${url}" />\n`;
      });

      opml += "    </outline>\n";
      opml += "  </body>\n";
      opml += "</opml>";

      res.setHeader("Content-Type", "text/xml");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="rss-feeds-${Date.now()}.opml"`
      );
      res.send(opml);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API: 导入订阅源
  app.post("/api/feeds/import", (req, res) => {
    try {
      const { data, format } = req.body;
      const results = { added: 0, skipped: 0, errors: [] };

      if (format === "json") {
        // 解析 JSON 格式
        let feedsData;
        try {
          feedsData = typeof data === "string" ? JSON.parse(data) : data;
        } catch (e) {
          return res
            .status(400)
            .json({ success: false, error: "Invalid JSON format" });
        }

        const feedsList = feedsData.feeds || feedsData;
        if (!Array.isArray(feedsList)) {
          return res
            .status(400)
            .json({ success: false, error: "Invalid JSON structure" });
        }

        feedsList.forEach((feed) => {
          try {
            if (!feed.url) {
              results.errors.push(
                `Missing URL for feed: ${feed.title || "Unknown"}`
              );
              return;
            }

            // 检查是否已存在
            const existing = feeds.getByUrl.get(feed.url);
            if (existing) {
              results.skipped++;
              return;
            }

            // 添加订阅源
            feeds.add.run(feed.url, feed.title || feed.url);
            results.added++;
          } catch (e) {
            results.errors.push(`Error adding ${feed.url}: ${e.message}`);
          }
        });
      } else if (format === "opml") {
        // 解析 OPML 格式
        const DOMParser = require("xmldom").DOMParser;
        let doc;
        try {
          doc = new DOMParser().parseFromString(data, "text/xml");
        } catch (e) {
          return res
            .status(400)
            .json({ success: false, error: "Invalid OPML format" });
        }

        const outlines = doc.getElementsByTagName("outline");
        for (let i = 0; i < outlines.length; i++) {
          const outline = outlines[i];
          const xmlUrl = outline.getAttribute("xmlUrl");
          const text =
            outline.getAttribute("text") || outline.getAttribute("title");

          if (!xmlUrl) continue;

          try {
            // 检查是否已存在
            const existing = feeds.getByUrl.get(xmlUrl);
            if (existing) {
              results.skipped++;
              continue;
            }

            // 添加订阅源
            feeds.add.run(xmlUrl, text || xmlUrl);
            results.added++;
          } catch (e) {
            results.errors.push(`Error adding ${xmlUrl}: ${e.message}`);
          }
        }
      } else {
        return res
          .status(400)
          .json({ success: false, error: "Unsupported format" });
      }

      res.json({ success: true, data: results });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API: 获取 AI 使用统计
  app.get("/api/ai-stats", (req, res) => {
    try {
      const AISummaryService = require("./aiSummary");
      const aiService = new AISummaryService();
      const days = parseInt(req.query.days) || 30;
      const stats = aiService.getStats(days);
      res.json({ success: true, data: stats });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Static files and homepage (after all API routes)
  app.use(express.static(path.join(__dirname, "../public")));

  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../views/index.html"));
  });

  return app;
}

module.exports = createWebServer;
