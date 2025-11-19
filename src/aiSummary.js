const axios = require("axios");
const { settings, db } = require("./database");
const { AI } = require("./constants");

class AISummaryService {
  constructor() {
    // 初始化统计表
    this.initStatsTable();

    this.providers = {
      gemini: {
        name: "Google Gemini",
        defaultModel: "gemini-2.0-flash-exp",
        endpoint:
          "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}",
        formatRequest: (articles, model) => ({
          contents: [
            {
              parts: [
                {
                  text: this.buildPrompt(articles),
                },
              ],
            },
          ],
        }),
        parseResponse: (data) => {
          return {
            text: data.candidates?.[0]?.content?.parts?.[0]?.text || "总结失败",
            inputTokens: data.usageMetadata?.promptTokenCount || 0,
            outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: data.usageMetadata?.totalTokenCount || 0,
          };
        },
        // Gemini 定价 (USD per 1M tokens)
        pricing: {
          input: 0, // 免费
          output: 0,
        },
      },
      deepseek: {
        name: "DeepSeek",
        defaultModel: "deepseek-chat",
        endpoint: "https://api.deepseek.com/v1/chat/completions",
        formatRequest: (articles, model) => ({
          model: model,
          messages: [
            {
              role: "user",
              content: this.buildPrompt(articles),
            },
          ],
          temperature: 0.7,
        }),
        parseResponse: (data) => {
          return {
            text: data.choices?.[0]?.message?.content || "总结失败",
            inputTokens: data.usage?.prompt_tokens || 0,
            outputTokens: data.usage?.completion_tokens || 0,
            totalTokens: data.usage?.total_tokens || 0,
          };
        },
        headers: (apiKey) => ({
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        }),
        // DeepSeek 定价 (CNY per 1M tokens)
        pricing: {
          input: 1.0,
          output: 2.0,
          currency: "CNY",
        },
      },
      qwen: {
        name: "通义千问",
        defaultModel: "qwen-turbo",
        endpoint:
          "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
        formatRequest: (articles, model) => ({
          model: model,
          input: {
            messages: [
              {
                role: "user",
                content: this.buildPrompt(articles),
              },
            ],
          },
          parameters: {
            result_format: "message",
          },
        }),
        parseResponse: (data) => {
          return {
            text: data.output?.choices?.[0]?.message?.content || "总结失败",
            inputTokens: data.usage?.input_tokens || 0,
            outputTokens: data.usage?.output_tokens || 0,
            totalTokens: data.usage?.total_tokens || 0,
          };
        },
        headers: (apiKey) => ({
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        }),
        // 通义千问定价 (CNY per 1M tokens)
        pricing: {
          input: 0.5,
          output: 2.0,
          currency: "CNY",
        },
      },
    };
  }

  // 初始化统计数据表
  initStatsTable() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_usage_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        estimated_cost REAL DEFAULT 0,
        article_count INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `);
  }

  // 记录使用统计
  recordUsage(
    provider,
    model,
    inputTokens,
    outputTokens,
    totalTokens,
    cost,
    articleCount
  ) {
    const stmt = db.prepare(`
      INSERT INTO ai_usage_stats 
      (provider, model, input_tokens, output_tokens, total_tokens, estimated_cost, article_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      provider,
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      cost,
      articleCount
    );
  }

  // 获取统计数据
  getStats(days = 30) {
    const cutoffTimestamp = Math.floor(Date.now() / 1000 - days * 24 * 60 * 60);

    const summary = db
      .prepare(
        `
      SELECT 
        provider,
        COUNT(*) as call_count,
        SUM(input_tokens) as total_input_tokens,
        SUM(output_tokens) as total_output_tokens,
        SUM(total_tokens) as total_tokens,
        SUM(estimated_cost) as total_cost,
        SUM(article_count) as total_articles
      FROM ai_usage_stats
      WHERE created_at >= ?
      GROUP BY provider
    `
      )
      .all(cutoffTimestamp);

    const recentCalls = db
      .prepare(
        `
      SELECT *
      FROM ai_usage_stats
      WHERE created_at >= ?
      ORDER BY created_at DESC
      LIMIT 50
    `
      )
      .all(cutoffTimestamp);

    return { summary, recentCalls };
  }

  // 计算成本
  calculateCost(provider, inputTokens, outputTokens) {
    const providerConfig = this.providers[provider];
    if (!providerConfig || !providerConfig.pricing) {
      return 0;
    }

    const { input, output, currency = "USD" } = providerConfig.pricing;
    const cost = (inputTokens * input + outputTokens * output) / 1000000;

    return {
      cost: parseFloat(cost.toFixed(6)),
      currency,
    };
  }

  // 构建提示词
  buildPrompt(articles) {
    const articleList = articles
      .map(
        (article, index) =>
          `${index + 1}. 标题：${article.title}\n   摘要：${
            article.contentSnippet || "无摘要"
          }`
      )
      .join("\n\n");

    return `请对以下 ${articles.length} 篇文章进行简洁的总结汇总，要求：
1. 提炼每篇文章的核心观点
2. 按主题归类整理
3. 使用中文输出
4. 总结不超过 500 字
5. 使用简洁的段落格式，不要使用代码块
6. 可以使用项目符号(•)或数字列表

文章列表：
${articleList}

请开始总结：`;
  }

  // 检查是否启用 AI 总结
  isEnabled() {
    const result = settings.get.get("ai_summary_enabled");
    return result?.value === "true";
  }

  // 获取配置
  getConfig() {
    const provider = settings.get.get("ai_provider")?.value || "gemini";
    // 从对应提供商字段读取 API Key 和 Model
    const apiKey = settings.get.get(`ai_api_key_${provider}`)?.value || "";
    const model = settings.get.get(`ai_model_${provider}`)?.value || "";

    return { provider, apiKey, model };
  }

  // 调用 AI 生成总结
  async summarize(articles, feedTitle, skipGlobalCheck = false) {
    // 允许跳过全局开关检查(当从订阅源级别调用时)
    if (!skipGlobalCheck && !this.isEnabled()) {
      return null;
    }

    if (!articles || articles.length === 0) {
      return null;
    }

    const { provider, apiKey, model } = this.getConfig();

    if (!apiKey) {
      console.log("⚠️  AI 总结已启用但未配置 API Key");
      return null;
    }

    const providerConfig = this.providers[provider];
    if (!providerConfig) {
      console.error(`❌ 不支持的 AI 提供商: ${provider}`);
      return null;
    }

    try {
      const selectedModel = model || providerConfig.defaultModel;
      const endpoint = providerConfig.endpoint
        .replace("{model}", selectedModel)
        .replace("{apiKey}", apiKey);

      const requestBody = providerConfig.formatRequest(articles, selectedModel);
      const headers = providerConfig.headers
        ? providerConfig.headers(apiKey)
        : {
            "Content-Type": "application/json",
          };

      console.log(
        `🤖 正在使用 ${providerConfig.name} (${selectedModel}) 生成总结...`
      );

      const response = await axios.post(endpoint, requestBody, {
        headers,
        timeout: AI.REQUEST_TIMEOUT,
      });

      const result = providerConfig.parseResponse(response.data);
      const { text, inputTokens, outputTokens, totalTokens } = result;

      // 计算成本
      const costData = this.calculateCost(provider, inputTokens, outputTokens);

      // 记录统计
      this.recordUsage(
        provider,
        selectedModel,
        inputTokens,
        outputTokens,
        totalTokens,
        costData.cost,
        articles.length
      );

      console.log(`✅ AI 总结生成成功`);
      console.log(
        `📊 Token 使用: 输入=${inputTokens}, 输出=${outputTokens}, 总计=${totalTokens}`
      );
      console.log(`💰 预估成本: ${costData.cost} ${costData.currency}`);

      return {
        feedTitle,
        articleCount: articles.length,
        summary: text,
        tokens: { inputTokens, outputTokens, totalTokens },
        cost: costData,
      };
    } catch (error) {
      console.error(`❌ AI 总结失败 (${provider}):`, error.message);
      if (error.response) {
        // 安全处理:不打印可能包含敏感信息的完整响应
        const safeData = {
          status: error.response.status,
          statusText: error.response.statusText,
          message: error.response.data?.error?.message || error.response.data?.message || '未知错误'
        };
        console.error("响应信息:", safeData);
      }
      return null;
    }
  }

  // 格式化总结消息
  formatSummaryMessage(summaryData, articles = []) {
    const { feedTitle, articleCount, summary } = summaryData;

    // 清理 AI 返回的 Markdown 代码块标记
    let cleanedSummary = summary
      .replace(/```markdown\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    let message =
      `📊 *${feedTitle} - AI 总结*\n\n` +
      `📖 本次更新: ${articleCount} 篇文章\n\n` +
      `${cleanedSummary}\n\n`;

    // 添加文章链接列表
    if (articles && articles.length > 0) {
      message += `📑 *文章列表:*\n`;
      articles.forEach((article, index) => {
        const title = article.title || "无标题";
        const link = article.link || "";
        message += `${index + 1}. [${title}](${link})\n`;
      });
      message += "\n";
    }

    message += `_[由 AI 自动生成]_`;

    return message;
  }
}

module.exports = AISummaryService;
