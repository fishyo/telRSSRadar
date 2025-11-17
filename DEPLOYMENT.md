# 部署指南

本文档介绍如何使用 Docker 部署 TelRSSRadar。

---

## 方式一：使用 Docker 部署（推荐）

Docker 部署是最简单、最可靠的方式，适合所有平台。

### 前置要求

- 已安装 Docker 和 Docker Compose
- 如果没有安装，请访问：
  - [Docker Desktop](https://www.docker.com/products/docker-desktop) (Windows/Mac)
  - [Docker Engine](https://docs.docker.com/engine/install/) (Linux)

### 部署步骤

1. **克隆项目**

   ```bash
   git clone <your-repo-url>
   cd telRSSRadar
   ```

2. **配置环境变量**

   ```bash
   # Linux/Mac
   cp .env.example .env

   # Windows
   copy .env.example .env
   ```

   编辑 `.env` 文件，填入你的配置：

   ```env
   BOT_TOKEN=your_telegram_bot_token
   CHAT_ID=your_chat_id
   CHECK_INTERVAL=10
   RETENTION_DAYS=30
   ```

3. **启动服务**

   ```bash
   docker-compose up -d
   ```

4. **查看日志**

   ```bash
   docker-compose logs -f
   ```

5. **停止服务**

   ```bash
   docker-compose down
   ```

### Docker 常用命令

```bash
# 查看运行状态
docker-compose ps

# 重启服务
docker-compose restart

# 更新代码后重新构建
docker-compose up -d --build

# 查看实时日志
docker-compose logs -f telrssradar

# 进入容器
docker-compose exec telrssradar sh
```

---

## 云服务器部署建议

### 服务器配置要求

1. **最低配置**

   - CPU: 1 核
   - 内存: 1GB
   - 存储: 10GB

2. **推荐系统**

   - Ubuntu 20.04/22.04 LTS
   - Debian 11/12
   - CentOS 7/8

3. **安全组设置**
   - 无需开放端口（机器人主动连接 Telegram）
   - 建议只开放 SSH 端口（22）

### 快速部署步骤

```bash
# 1. 安装 Docker（如果未安装）
curl -fsSL https://get.docker.com | sh

# 2. 安装 Docker Compose（如果未安装）
sudo apt install docker-compose -y
# 或
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 3. 克隆项目
git clone <your-repo-url>
cd telRSSRadar

# 4. 配置环境变量
cp .env.example .env
nano .env  # 或使用 vim 编辑

# 5. 启动服务
docker-compose up -d

# 6. 查看日志确认运行正常
docker-compose logs -f
```

---

## 数据备份

数据库文件位于 `data/rss.db`，定期备份此文件：

```bash
# 创建备份
cp data/rss.db data/rss.db.backup.$(date +%Y%m%d)

# 使用 Docker 时
docker cp telrssradar:/app/data/rss.db ./rss.db.backup
```

---

## 更新应用

```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker-compose down
docker-compose up -d --build

# 查看日志确认更新成功
docker-compose logs -f
```

---

## 故障排查

### 查看日志

```bash
# 查看实时日志
docker-compose logs -f

# 查看最近 100 行日志
docker-compose logs --tail=100

# 查看特定容器日志
docker-compose logs telrssradar
```

### 常见问题

1. **容器无法启动**

   ```bash
   # 检查容器状态
   docker-compose ps

   # 查看详细错误
   docker-compose logs
   ```

2. **数据库权限问题**

   ```bash
   # 确保数据目录存在且有正确权限
   mkdir -p data
   chmod 755 data
   ```

3. **环境变量未生效**
   - 确认 `.env` 文件存在且格式正确
   - 修改后需重启容器: `docker-compose restart`

---

## 监控和告警

1. **查看 Docker 容器状态**

   ```bash
   docker-compose ps
   docker stats telrssradar
   ```

2. **使用 Uptime Kuma**（自托管监控）

   - https://github.com/louislam/uptime-kuma

3. **配置 Telegram 通知**
   - 机器人会自动报告错误到你的 Chat ID

---

## 性能优化

1. **调整检查间隔**

   - 默认 10 分钟，可根据需求调整

2. **定期清理数据**

   - 设置合理的 `RETENTION_DAYS`

3. **使用 SSD 存储**
   - SQLite 在 SSD 上性能更好

---

## 安全建议

1. ✅ 不要公开 `.env` 文件
2. ✅ 定期更新依赖包
3. ✅ 使用防火墙限制访问
4. ✅ 定期备份数据库
5. ✅ 使用独立的 Telegram Bot Token

---

## 技术支持

如有问题，请查看：

- [README.md](README.md) - 基本使用说明
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - 故障排查指南
- GitHub Issues - 提交问题和建议
