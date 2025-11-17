# Docker 数据持久化说明

## 数据库位置

- **宿主机**: `./data/rss.db`
- **容器内**: `/app/data/rss.db`

## 验证数据持久化

1. **查看数据库文件**:
   ```bash
   ls -lh data/
   ```

2. **添加测试数据**:
   - 启动容器
   - 使用 `/add` 添加一个 RSS 源
   - 使用 `/list` 确认已添加

3. **测试持久化**:
   ```bash
   # 停止容器
   docker compose down
   
   # 确认数据库文件还在
   ls -lh data/rss.db
   
   # 重新启动
   docker compose up -d
   
   # 查看日志，确认数据库连接成功
   docker compose logs -f
   
   # 使用 /list 命令检查数据是否还在
   ```

## 故障排查

### 问题：重启后数据丢失

**检查项**:

1. **确认挂载正确**:
   ```bash
   docker compose exec telrssradar ls -la /app/data
   ```
   应该能看到 `rss.db` 文件

2. **检查宿主机文件**:
   ```bash
   ls -lh ./data/
   ```
   确认 `rss.db` 文件存在且有内容（大小 > 0）

3. **查看容器日志**:
   ```bash
   docker compose logs | grep "数据库"
   ```
   应该看到类似这样的输出：
   ```
   📊 数据库路径: /app/data/rss.db
   📂 数据库目录: /app/data
   ✅ 数据库文件存在: true
   ✅ 数据库已连接: /app/data/rss.db
   ```

4. **手动检查数据库**:
   ```bash
   # 进入容器
   docker compose exec telrssradar sh
   
   # 查看文件
   ls -lh /app/data/
   
   # 退出
   exit
   ```

### 问题：权限错误

如果遇到权限问题：

```bash
# 修复权限（Linux/macOS）
sudo chown -R $USER:$USER ./data

# 或者
chmod -R 755 ./data
```

## 备份数据

```bash
# 备份数据库
cp data/rss.db data/rss.db.backup.$(date +%Y%m%d_%H%M%S)

# 或使用 Docker
docker compose exec telrssradar cp /app/data/rss.db /app/data/rss.db.backup
```

## 恢复数据

```bash
# 停止容器
docker compose down

# 恢复备份
cp data/rss.db.backup.YYYYMMDD_HHMMSS data/rss.db

# 启动容器
docker compose up -d
```
