# 🔒 安全说明

## API Key 安全措施

### ✅ 当前已实施的安全措施

#### 1. **存储安全**
- ✓ API Key 存储在本地 SQLite 数据库文件 (`data/rss.db`)
- ✓ 数据库文件仅保存在本地，不会上传到任何服务器
- ✓ 不同 AI 提供商的 API Key 分别存储

#### 2. **传输安全**
- ✓ Web 服务器仅监听 `127.0.0.1` (本地回环地址)
- ✓ 外部网络无法直接访问管理面板
- ✓ API Key 在 HTTP 响应中始终显示为掩码格式 (`***xxxx`)

#### 3. **显示安全**
- ✓ 前端页面不会显示完整 API Key
- ✓ 仅显示后 4 位字符用于识别
- ✓ 输入框默认为密码类型 (可临时切换查看)

#### 4. **日志安全**
- ✓ 控制台日志不会打印完整 API Key
- ✓ 错误日志中过滤敏感响应数据
- ✓ 仅记录必要的错误信息

### ⚠️ 需要注意的安全风险

#### 1. **数据库文件未加密**
- 数据库文件 `data/rss.db` 以明文形式存储 API Key
- **风险**: 如果有人获得服务器访问权限，可以直接读取数据库文件
- **缓解措施**:
  - 确保服务器操作系统账户安全
  - 设置适当的文件权限 (仅当前用户可读写)
  - 定期备份时加密备份文件

#### 2. **本地访问无身份验证**
- Web 管理面板没有登录机制
- **风险**: 同一台电脑的其他用户可以访问
- **缓解措施**:
  - 仅在受信任的个人电脑上运行
  - 使用完毕后关闭服务

#### 3. **进程内存**
- API Key 在运行时会加载到内存中
- **风险**: 理论上可通过内存转储获取
- **缓解措施**: 确保操作系统安全，防止恶意程序

## 安全最佳实践

### 1. **保护数据库文件**
```bash
# Linux/Mac: 设置文件权限
chmod 600 data/rss.db

# Windows: 通过文件属性设置仅当前用户可访问
```

### 2. **使用环境变量 (可选)**
虽然当前版本将 API Key 存储在数据库中，但您也可以通过环境变量传递:

```bash
# 在 .env 文件中设置
GEMINI_API_KEY=your_gemini_key_here
DEEPSEEK_API_KEY=your_deepseek_key_here
QWEN_API_KEY=your_qwen_key_here
```

### 3. **定期轮换 API Key**
- 定期在 AI 提供商处生成新的 API Key
- 在管理面板中更新
- 撤销旧的 API Key

### 4. **监控 API 使用**
- 在 AI 提供商的控制台中监控 API 使用情况
- 设置使用量和费用警报
- 如发现异常使用，立即撤销 Key

### 5. **备份安全**
如果备份数据库文件:
```bash
# 使用 GPG 加密备份
gpg -c data/rss.db

# 或使用 7zip 加密压缩
7z a -p -mhe=on backup.7z data/rss.db
```

### 6. **网络隔离**
- 服务器已配置为仅监听 `127.0.0.1`
- 如需远程访问，使用 SSH 隧道:
```bash
ssh -L 3000:localhost:3000 user@your-server
```

## API Key 泄露应对

如果怀疑 API Key 泄露:

1. **立即撤销**
   - 前往 AI 提供商控制台
   - 撤销可能泄露的 API Key

2. **生成新 Key**
   - 创建新的 API Key
   - 在管理面板中更新

3. **检查使用记录**
   - 查看 AI 提供商的使用日志
   - 确认是否有异常调用

4. **更改密码**
   - 更改 AI 提供商账户密码
   - 启用两步验证

## 技术细节

### API Key 存储位置
```
data/rss.db
├── settings 表
    ├── ai_api_key_gemini    (Gemini API Key)
    ├── ai_api_key_deepseek  (DeepSeek API Key)
    └── ai_api_key_qwen      (Qwen API Key)
```

### Web API 安全机制
- GET `/api/ai-settings` - 返回掩码后的 Key (`***xxxx`)
- PUT `/api/ai-settings` - 仅当输入非掩码格式时才更新

### 日志过滤
错误日志仅包含:
- HTTP 状态码
- 错误消息
- 不包含请求/响应的完整内容

## 额外建议

### 使用 API Key 的限制功能
大多数 AI 提供商支持为 API Key 设置限制:
- ✅ 设置每日/每月使用配额
- ✅ 限制允许的 IP 地址 (如果提供商支持)
- ✅ 限制可调用的 API 端点

### 示例 - Google Gemini API Key 限制
1. 前往 [Google AI Studio](https://aistudio.google.com/apikey)
2. 点击 API Key 右侧的 "⋮"
3. 选择 "Set restrictions"
4. 设置 Application restrictions 和 API restrictions

---

**总结**: 当前的安全措施对于个人使用已经足够。最重要的是:
1. 保护好服务器的系统账户
2. 不要将数据库文件分享给他人
3. 定期检查 API 使用情况
4. 仅在受信任的环境中运行服务
