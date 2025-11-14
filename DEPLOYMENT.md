# 部署指南

本文档将指导您如何将 Telegram RSS Bot 项目上传到 GitHub，并在其他设备上部署运行。

## 1. 上传到 GitHub

### 1.1 创建 GitHub 仓库

1. 登录您的 GitHub 账户
2. 点击右上角的 "+" 号，选择 "New repository"
3. 输入仓库名称（例如：telegram-rss-bot）
4. 选择公开（Public）或私有（Private）
5. 不要初始化 README、.gitignore 或 LICENSE
6. 点击 "Create repository"

### 1.2 上传代码到 GitHub

在项目根目录下执行以下命令：

```bash
# 初始化 Git 仓库（如果尚未初始化）
git init

# 添加所有文件
git add .

# 提交更改
git commit -m "Initial commit"

# 添加远程仓库地址（替换为您的仓库地址）
git remote add origin https://github.com/yourusername/telegram-rss-bot.git

# 推送到 GitHub
git branch -M main
git push -u origin main
```

## 2. 在其他设备上部署

### 2.1 克隆仓库

在目标设备上执行以下命令：

```bash
# 克隆仓库
git clone https://github.com/yourusername/telegram-rss-bot.git
cd telegram-rss-bot
```

### 2.2 安装依赖

确保目标设备已安装 Node.js（建议版本 14 或更高）：

```bash
# 安装项目依赖
npm install
```

### 2.3 配置环境变量

1. 复制配置文件模板：

   ```bash
   cp .env.example .env
   ```

2. 编辑 `.env` 文件，填入您的信息：
   ```
   BOT_TOKEN=your_telegram_bot_token
   CHAT_ID=your_chat_id
   CHECK_INTERVAL=10
   RETENTION_DAYS=30
   ```

### 2.4 获取 Telegram 凭据

#### 获取 Bot Token

1. 在 Telegram 中搜索并打开 [@BotFather](https://t.me/BotFather)
2. 发送 `/newbot` 命令
3. 按照提示输入 bot 名称和用户名
4. 复制返回的 token 并填入 `.env` 文件的 `BOT_TOKEN` 字段

#### 获取 Chat ID

1. 在 Telegram 中搜索并打开 [@userinfobot](https://t.me/userinfobot)
2. 发送任意消息
3. 复制返回的 ID 并填入 `.env` 文件的 `CHAT_ID` 字段

### 2.5 启动机器人

```bash
# 启动机器人
npm start
```

## 3. 后台运行（可选）

### 3.1 使用 PM2（推荐）

PM2 是一个 Node.js 进程管理器，可以确保您的应用在后台持续运行：

```bash
# 安装 PM2
npm install -g pm2

# 使用 PM2 启动应用
pm2 start src/index.js --name telegram-rss-bot

# 设置开机自启
pm2 startup
pm2 save
```

### 3.2 使用 nohup

```bash
# 后台运行
nohup npm start > app.log 2>&1 &
```

## 4. 更新部署

当您在 GitHub 上更新了代码后，可以通过以下命令在部署设备上更新：

```bash
# 拉取最新代码
git pull

# 如果有依赖更新，重新安装
npm install

# 重启应用（如果使用 PM2）
pm2 restart telegram-rss-bot
```

## 5. 故障排除

### 5.1 常见问题

1. **Bot 无法启动**：检查 `.env` 文件中的 `BOT_TOKEN` 和 `CHAT_ID` 是否正确
2. **无法接收消息**：确保 Telegram bot 已经启动并与您进行过对话
3. **RSS 源无法更新**：检查网络连接和 RSS 源 URL 是否有效

### 5.2 查看日志

```bash
# 如果使用 PM2
pm2 logs telegram-rss-bot

# 或查看日志文件（如果使用 nohup）
tail -f app.log
```

## 6. 多设备部署注意事项

如果您想在多个设备上同时运行此 bot，请注意：

1. 每个设备需要使用不同的 Telegram bot token
2. 数据库文件是本地的，不同设备之间的数据不会同步
3. 如果需要数据同步，建议使用云数据库服务（如 MongoDB Atlas）
