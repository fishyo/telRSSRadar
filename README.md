# Telegram RSS Bot

一个简单的 Telegram RSS 订阅机器人，可自动推送新文章到您的 Telegram 聊天。

## 功能

- ✅ 自动检查 RSS 更新
- ✅ 自动清理旧文章
- ✅ 支持关键词过滤
- ✅ Markdown 格式推送

## 快速开始

### 1. 安装

```bash
# 克隆项目
git clone <repository-url>
cd telegram-rss-bot

# 安装依赖
npm install
```

### 2. 配置

1. 复制配置文件：

   ```bash
   cp .env.example .env
   ```

2. 编辑 `.env` 文件，填入您的信息：
   ```
   BOT_TOKEN=your_telegram_bot_token
   CHAT_ID=your_chat_id
   ```

### 3. 启动

```bash
npm start
```

## 使用方法

### 基本命令

- `/start` - 显示帮助信息
- `/add <RSS链接>` - 添加 RSS 源
- `/list` - 查看所有 RSS 源
- `/remove <ID>` - 删除 RSS 源

### 设置命令

- `/setinterval <分钟>` - 设置检查间隔（默认 10 分钟）
- `/setretention <天数>` - 设置数据保留天数（默认 30 天）
- `/cleanup` - 手动清理旧文章

## 工作原理

1. **自动检查更新**：机器人会根据设定的时间间隔自动检查所有 RSS 源是否有新文章
2. **智能推送**：发现新文章后会立即推送到您的 Telegram 聊天
3. **数据清理**：定期自动清理旧文章，避免数据库无限增长
4. **错误处理**：当 RSS 源出现问题时会记录错误并继续处理其他源

## 配置说明

- `BOT_TOKEN`：Telegram Bot 的访问令牌
- `CHAT_ID`：接收消息的聊天 ID
- `CHECK_INTERVAL`：检查 RSS 更新的时间间隔（分钟）
- `RETENTION_DAYS`：保留文章的天数

## 部署到其他设备

您可以将此项目上传到 GitHub，然后在其他设备上部署运行。详细部署指南请查看 [DEPLOYMENT.md](DEPLOYMENT.md) 文件。
