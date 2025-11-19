require("dotenv").config();
const { bot, rssChecker, errorHandler } = require("./bot");
const { settings } = require("./database");
const createWebServer = require("./webServer");

// 验证环境变量
if (!process.env.BOT_TOKEN) {
  console.error("❌ 错误: 未设置 BOT_TOKEN 环境变量");
  console.error("请创建 .env 文件并添加你的 Telegram Bot Token");
  process.exit(1);
}

if (!process.env.CHAT_ID) {
  console.error("❌ 错误: 未设置 CHAT_ID 环境变量");
  console.error("请在 .env 文件中添加你的 Telegram Chat ID");
  process.exit(1);
}

// 获取检查间隔（分钟）
const getCheckInterval = () => {
  const result = settings.get.get("check_interval");
  return parseInt(result?.value || process.env.CHECK_INTERVAL || "10");
};

// 定时检查 RSS
async function checkRSSTask() {
  console.log(
    `\n🔄 [${new Date().toLocaleString("zh-CN")}] 开始检查 RSS 更新...`
  );
  try {
    await rssChecker.checkAllFeeds();
    console.log("✅ RSS 检查完成\n");
  } catch (error) {
    console.error("❌ RSS 检查失败:", error);
  }
}

// 定时清理旧文章
async function cleanupTask() {
  console.log(`\n🧹 [${new Date().toLocaleString("zh-CN")}] 开始清理旧文章...`);
  try {
    await rssChecker.cleanupOldArticles();
    console.log("✅ 旧文章清理完成\n");
  } catch (error) {
    console.error("❌ 旧文章清理失败:", error);
  }
}

// 启动定时任务
async function startScheduler() {
  const interval = getCheckInterval();
  console.log(`⏱️  检查间隔: ${interval} 分钟`);

  // 立即执行一次检查
  console.log("🔄 执行首次检查...");
  await checkRSSTask();

  // 设置RSS检查定时器
  const intervalId = setInterval(async () => {
    await checkRSSTask();
  }, interval * 60 * 1000);

  // 设置每日清理定时器（每天凌晨2点执行）
  const now = new Date();
  const nextRun = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    2,
    0,
    0
  );
  const delay = nextRun - now;

  const cleanupTimeoutId = setTimeout(() => {
    // 执行首次清理
    cleanupTask();

    // 设置每日清理定时器
    const cleanupIntervalId = setInterval(async () => {
      await cleanupTask();
    }, 24 * 60 * 60 * 1000);

    // 将cleanupIntervalId保存到全局变量或返回值中
    global.cleanupIntervalId = cleanupIntervalId;
  }, delay);

  console.log("✅ 定时任务已启动");

  return {
    stop: () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (cleanupTimeoutId) {
        clearTimeout(cleanupTimeoutId);
      }
      if (global.cleanupIntervalId) {
        clearInterval(global.cleanupIntervalId);
      }
    },
  };
}

// 启动 Bot
async function main() {
  try {
    console.log("🚀 正在启动 Telegram RSS Bot...\n");

    // 启动 Web 服务器
    const webPort = process.env.WEB_PORT || 3000;
    const webHost = process.env.WEB_HOST || "127.0.0.1"; // 默认仅本地访问，设置为 0.0.0.0 允许局域网访问
    const app = createWebServer(bot, process.env.CHAT_ID, errorHandler);
    app.listen(webPort, webHost, () => {
      console.log(`🌐 Web 管理面板已启动: http://localhost:${webPort}`);
      if (webHost === "0.0.0.0") {
        console.log(`🌍 局域网访问已启用: http://<服务器IP>:${webPort}`);
        console.log(`⚠️  安全警告: Web 面板可被局域网内所有设备访问，请注意安全！`);
      } else {
        console.log(`🔒 安全提示: Web 面板仅监听本地回环地址，外部无法访问`);
      }
      console.log(
        `🔐 数据库文件位置: ${require("path").join(
          __dirname,
          "..",
          "data",
          "rss.db"
        )}`
      );
      console.log(`⚠️  请妥善保管数据库文件，其中包含 API Keys`);
    });

    // 启动 bot（非阻塞方式）
    console.log("🤖 启动 Telegram Bot...");
    bot.launch();
    console.log("✅ Bot 已启动");
    console.log(`📱 Chat ID: ${process.env.CHAT_ID}\n`);

    // 启动定时任务
    console.log("⏰ 启动定时任务...");
    const scheduler = await startScheduler();
    console.log("✅ 定时任务已就绪\n");

    // 优雅关闭
    process.once("SIGINT", () => {
      console.log("\n⏹️  收到 SIGINT 信号，正在关闭...");
      scheduler.stop();
      bot.stop("SIGINT");
    });

    process.once("SIGTERM", () => {
      console.log("\n⏹️  收到 SIGTERM 信号，正在关闭...");
      scheduler.stop();
      bot.stop("SIGTERM");
    });

    console.log("🎉 Telegram RSS Bot 运行中...");
    console.log("按 Ctrl+C 停止\n");
  } catch (error) {
    console.error("❌ 启动失败:", error);
    process.exit(1);
  }
}

main();
