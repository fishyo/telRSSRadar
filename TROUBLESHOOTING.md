# 故障排除指南

本文档提供了在不同设备上安装和运行 Telegram RSS Bot 时可能遇到的常见问题及其解决方案。

## 1. Node.js 版本兼容性问题

### 问题描述

安装过程中出现类似以下错误：

```
npm WARN EBADENGINE Unsupported engine {
  package: 'better-sqlite3@12.4.1',
  required: { node: '20.x || 22.x || 23.x || 24.x' },
  current: { node: 'v18.20.4', npm: '9.2.0' }
}
```

### 解决方案

#### 方案一：升级 Node.js（推荐）

1. 卸载当前 Node.js 版本
2. 从 [Node.js 官网](https://nodejs.org/) 下载并安装最新的 LTS 版本（建议 20.x 或更高版本）

#### 方案二：使用 Node.js 版本管理器

##### macOS/Linux (使用 nvm)：

```bash
# 安装 nvm（如果尚未安装）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 重新加载终端配置
source ~/.bashrc

# 安装并使用 Node.js 20.x
nvm install 20
nvm use 20
```

##### Windows (使用 nvm-windows)：

1. 从 [nvm-windows GitHub](https://github.com/coreybutler/nvm-windows/releases) 下载并安装
2. 在命令提示符中运行：
   ```cmd
   nvm install 20
   nvm use 20
   ```

#### 方案三：使用兼容的 better-sqlite3 版本

如果您无法升级 Node.js，可以尝试使用兼容 Node.js 18.x 的 better-sqlite3 版本：

```bash
# 修改 package.json 中的 better-sqlite3 版本
"better-sqlite3": "^7.6.2"

# 删除 node_modules 和 package-lock.json
rm -rf node_modules package-lock.json

# 重新安装依赖
npm install
```

## 2. 编译工具缺失问题

### 问题描述

安装过程中出现类似以下错误：

```
gyp ERR! stack Error: not found: make
gyp ERR! stack     at getNotFoundError
```

### 解决方案

#### Windows：

1. 安装 Windows Build Tools：
   ```bash
   npm install -g windows-build-tools
   ```
2. 或者安装 Visual Studio Community（确保选择 C++ 开发工具）

#### macOS：

1. 安装 Xcode Command Line Tools：
   ```bash
   xcode-select --install
   ```

#### Linux (Debian/Ubuntu)：

```bash
sudo apt update
sudo apt install build-essential
```

#### Linux (CentOS/RHEL/Fedora)：

```bash
# CentOS/RHEL
sudo yum groupinstall "Development Tools"

# Fedora
sudo dnf groupinstall "Development Tools"
```

## 3. 权限问题

### 问题描述

安装过程中出现权限错误。

### 解决方案

1. 避免使用 sudo 运行 npm（可能导致权限问题）
2. 使用 nvm 安装 Node.js（推荐）
3. 或者配置 npm 使用不同的全局目录：
   ```bash
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   # 然后将 ~/.npm-global/bin 添加到 PATH 环境变量
   ```

## 4. 网络问题

### 问题描述

下载依赖时出现超时或连接错误。

### 解决方案

1. 使用国内镜像源：
   ```bash
   npm config set registry https://registry.npmmirror.com
   ```
2. 或者使用 cnpm：
   ```bash
   npm install -g cnpm --registry=https://registry.npmmirror.com
   cnpm install
   ```

## 5. 数据库文件权限问题

### 问题描述

运行时出现数据库访问错误。

### 解决方案

确保运行 Telegram RSS Bot 的用户对项目目录具有读写权限：

```bash
chmod -R 755 .
```

## 6. Telegram Bot 无法启动

### 问题描述

Bot 启动后无法接收或发送消息。

### 解决方案

1. 检查 `.env` 文件中的 `BOT_TOKEN` 和 `CHAT_ID` 是否正确
2. 确保已在 Telegram 中与 Bot 进行过对话（访问 bot 链接并点击 "Start"）
3. 检查防火墙设置是否阻止了网络连接

## 7. 更新部署

当您在 GitHub 上更新了代码后，可以通过以下命令在部署设备上更新：

```bash
# 拉取最新代码
git pull

# 如果有依赖更新，重新安装
npm install

# 重启应用（如果使用 PM2）
pm2 restart telegram-rss-bot
```

## 8. Docker 部署（推荐的替代方案）

如果您在安装过程中遇到持续问题，可以考虑使用 Docker 部署：

1. 安装 Docker：

   ```bash
   # Ubuntu/Debian
   sudo apt install docker.io docker-compose
   ```

2. 创建 `Dockerfile`：

   ```dockerfile
   FROM node:20-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY . .
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

3. 构建并运行：
   ```bash
   docker build -t telegram-rss-bot .
   docker run -d --name telegram-rss-bot \
     -v $(pwd)/data.db:/app/data.db \
     -v $(pwd)/.env:/app/.env \
     telegram-rss-bot
   ```

## 9. 获取帮助

如果以上解决方案都无法解决问题，请提供以下信息以获得帮助：

1. 操作系统版本：`uname -a` (Linux/macOS) 或 `systeminfo` (Windows)
2. Node.js 版本：`node --version`
3. npm 版本：`npm --version`
4. 完整的错误信息
5. 已尝试的解决方案

您可以通过以下方式获取帮助：

- 在 GitHub 项目页面提交 issue
- 联系项目维护者
