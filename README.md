# 📡 Telegram RSS Bot

<div align="center">

[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D24.0.0-brightgreen.svg)](https://nodejs.org/)
[![Telegram](https://img.shields.io/badge/Telegram-Bot-blue.svg)](https://telegram.org/)

一个功能强大的 Telegram RSS 订阅机器人，支持 AI 智能总结、关键词过滤、批量管理等功能。

[功能特性](#-功能特性) • [快速开始](#-快速开始) • [使用指南](#-使用指南) • [配置说明](#-配置说明) • [免责声明](#-免责声明)

</div>

---

## 📖 服务介绍

Telegram RSS Bot 是一个专为个人或小团队设计的 RSS 订阅管理工具，通过 Telegram 机器人提供便捷的订阅源管理和内容推送服务。

### 核心优势

- **🤖 AI 智能总结** - 集成 Google Gemini、DeepSeek、Qwen 等 AI 服务，自动生成文章摘要
- **🎯 精准过滤** - 支持关键词包含/排除过滤，只推送你关心的内容
- **📱 双端管理** - Telegram 命令 + Web 管理界面，随时随地管理订阅
- **📦 批量操作** - 批量检查错误源、批量删除、导入导出 OPML/JSON
- **🔒 安全私密** - 本地部署，数据完全掌控，支持 API Key 加密存储
- **⚡ 轻量高效** - 基于 SQLite 数据库，资源占用低，响应速度快

### 技术栈

- **后端**: Node.js + Express.js
- **数据库**: better-sqlite3 (WAL 模式)
- **机器人框架**: Telegraf 4.16.3
- **RSS 解析**: rss-parser
- **AI 服务**: Google Gemini / DeepSeek / Qwen
- **内容展示**: Telegraph 页面生成

---

## ✨ 功能特性

### 📚 订阅源管理

- ✅ 添加/删除/重命名 RSS 订阅源
- ✅ 查看订阅源列表和详细信息
- ✅ 测试订阅源连接状态
- ✅ 批量检查错误源
- ✅ 批量删除订阅源
- ✅ 导入/导出 OPML 和 JSON 格式

### 🔄 内容推送

- ✅ 自动定时检查更新（可自定义间隔）
- ✅ 手动触发检查（全部或单个源）
- ✅ 新文章即时推送到 Telegram
- ✅ Telegraph 页面预览（保留原文格式）
- ✅ 支持文章标题、链接、发布时间

### 🤖 AI 智能总结

- ✅ 支持 Google Gemini (免费)
- ✅ 支持 DeepSeek (¥1/2 百万 tokens)
- ✅ 支持 Qwen (¥0.5/2 百万 tokens)
- ✅ 全局 AI 总结开关
- ✅ 单个订阅源 AI 开关
- ✅ 批量文章智能摘要
- ✅ Token 使用统计和成本预估

### 🔍 内容过滤

- ✅ 关键词包含过滤（只推送匹配的文章）
- ✅ 关键词排除过滤（排除不想看的内容）
- ✅ 每个订阅源独立过滤规则
- ✅ 支持多个过滤规则组合

### ⚙️ 系统设置

- ✅ 自定义检查间隔（分钟级）
- ✅ 文章保留天数设置
- ✅ 每源文章数量限制
- ✅ 自动清理旧文章
- ✅ 数据库状态监控

### 🌐 Web 管理面板

- ✅ 美观的可视化界面
- ✅ 订阅源列表和统计
- ✅ AI 设置和 API Key 管理
- ✅ 系统运行状态监控
- ✅ 数据库信息查看
- ✅ 批量管理工具
- ✅ 导入/导出功能

---

## 🚀 快速开始

### 环境要求

- **Node.js** >= 24.0.0 (LTS)
- **npm** >= 10.0.0
- **Telegram Bot Token** ([获取教程](https://core.telegram.org/bots#3-how-do-i-create-a-bot))
- **Telegram Chat ID** ([获取方法](https://stackoverflow.com/questions/32423837/telegram-bot-how-to-get-a-group-chat-id))

### 安装步骤

#### 1️⃣ 克隆仓库

```bash
git clone https://github.com/fishyo/telRSSRadar.git
cd telRSSRadar
```

#### 2️⃣ 安装依赖

```bash
npm install
```

#### 3️⃣ 配置环境变量

创建 `.env` 文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入必要配置：

```env
# Telegram 配置（必填）
BOT_TOKEN=your_bot_token_here
CHAT_ID=your_chat_id_here

# Web 管理面板端口（可选，默认 3000）
WEB_PORT=3000

# AI 服务 API Key（可选，在 Web 界面配置）
# GEMINI_API_KEY=your_gemini_key
# DEEPSEEK_API_KEY=your_deepseek_key
# QWEN_API_KEY=your_qwen_key
```

#### 4️⃣ 启动服务

```bash
npm start
```

#### 5️⃣ 访问 Web 管理面板

打开浏览器访问：`http://localhost:3000`

---

## 📱 使用指南

### Telegram 命令列表

#### 📚 订阅源管理

```
/add <URL>           - 添加 RSS 订阅源
/rm <ID>            - 删除订阅源
/rename <ID> <名称>  - 重命名订阅源
/ls                 - 查看所有订阅源
/info <ID>          - 查看订阅源详情
/test <ID>          - 测试订阅源连接
```

#### 🔄 更新与检查

```
/check              - 手动检查所有订阅源更新
/check <ID>         - 检查指定订阅源
/stats              - 查看系统统计信息
```

#### 🔧 批量管理

```
/checkerrors        - 批量检查所有订阅源状态
/batchrm <ID1 ID2>  - 批量删除订阅源
```

#### 🤖 AI 总结

```
/ai                 - 查看 AI 设置
/ai on <ID>         - 为订阅源启用 AI 总结
/ai off <ID>        - 为订阅源禁用 AI 总结
```

#### 📦 导入/导出

```
/export             - 导出订阅列表（JSON 格式）
/import             - 导入订阅列表（发送 JSON 文件）
```

#### 🔍 过滤管理

```
/f <ID> <类型> <关键词>  - 添加过滤规则
/rf <过滤ID>             - 删除过滤规则
/lf <订阅源ID>           - 查看过滤规则
```

#### ⚙️ 系统设置

```
/interval <分钟>    - 设置检查间隔
/retention <天数>   - 设置文章保留天数
/cleanup            - 手动清理旧文章
```

### Web 面板使用

#### 订阅源管理

1. **添加订阅源**: 输入 RSS URL，点击"预览"确认后添加
2. **批量检查**: 点击"🔍 检查错误源"，测试所有源的连通性
3. **批量删除**: 勾选订阅源，点击"🗑️ 批量删除"
4. **导入导出**: 支持 OPML 和 JSON 格式的订阅列表

#### AI 设置

1. 在 AI 设置区域选择 AI 提供商
2. 输入对应的 API Key
3. 启用全局 AI 开关
4. 为单个订阅源开启/关闭 AI 总结

#### 过滤规则

1. 点击订阅源的"过滤"按钮
2. 添加"包含"或"排除"关键词
3. 支持多个规则组合使用

---

## 🔧 配置说明

### 环境变量

| 变量名             | 必填 | 默认值 | 说明                        |
| ------------------ | ---- | ------ | --------------------------- |
| `BOT_TOKEN`        | ✅   | -      | Telegram Bot Token          |
| `CHAT_ID`          | ✅   | -      | 接收消息的 Telegram Chat ID |
| `WEB_PORT`         | ❌   | 3000   | Web 管理面板端口            |
| `GEMINI_API_KEY`   | ❌   | -      | Google Gemini API Key       |
| `DEEPSEEK_API_KEY` | ❌   | -      | DeepSeek API Key            |
| `QWEN_API_KEY`     | ❌   | -      | Qwen API Key                |

### AI 服务配置

#### Google Gemini (推荐)

- **免费额度**: 每天 1500 次请求
- **模型**: gemini-2.0-flash-exp
- **获取方式**: [Google AI Studio](https://aistudio.google.com/app/apikey)

#### DeepSeek

- **价格**: ¥1/百万 输入 tokens, ¥2/百万 输出 tokens
- **模型**: deepseek-chat
- **获取方式**: [DeepSeek 官网](https://platform.deepseek.com/)

#### Qwen (通义千问)

- **价格**: ¥0.5/百万 输入 tokens, ¥2/百万 输出 tokens
- **模型**: qwen-plus
- **获取方式**: [阿里云百炼](https://bailian.console.aliyun.com/)

### 系统设置

- **检查间隔**: 建议 5-15 分钟，避免过于频繁
- **保留天数**: 建议 30 天，根据需求调整
- **保留文章数**: 每个源建议 100-500 篇
- **数据库**: 自动使用 WAL 模式，支持并发读写

---

## 🐳 Docker 部署

### 使用 Docker Compose (推荐)

```yaml
version: "3.8"
services:
  telegram-rss-bot:
    build: .
    container_name: telegram-rss-bot
    restart: unless-stopped
    environment:
      - BOT_TOKEN=your_bot_token
      - CHAT_ID=your_chat_id
      - WEB_PORT=3000
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./.env:/app/.env
```

启动服务：

```bash
docker-compose up -d
```

### Dockerfile

```dockerfile
FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

---

## 🔒 安全建议

### API Key 保护

1. **不要提交到 Git**: `.env` 文件已在 `.gitignore` 中
2. **定期轮换**: 建议每 3-6 个月更换一次 API Key
3. **最小权限**: 仅授予必要的 API 权限
4. **备份加密**: 备份数据库时使用加密工具

### 数据库安全

1. **文件权限**:

   ```bash
   chmod 600 data/rss.db
   ```

2. **定期备份**:

   ```bash
   cp data/rss.db backups/rss.db.$(date +%Y%m%d)
   ```

3. **加密备份**:
   ```bash
   tar czf - data/rss.db | openssl enc -aes-256-cbc -e > backup.tar.gz.enc
   ```

### Web 面板安全

- 默认仅监听 `127.0.0.1` (本地回环地址)
- 外部访问建议使用 SSH 隧道或 VPN
- 不建议直接暴露到公网

### 网络安全

```bash
# SSH 隧道访问 Web 面板
ssh -L 3000:localhost:3000 user@your-server
```

---

## 📊 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                       Telegram RSS Bot                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │   Telegram   │◄────────┤   Bot Core   │                  │
│  │   Commands   │         │  (Telegraf)  │                  │
│  └──────────────┘         └──────┬───────┘                  │
│                                   │                           │
│  ┌──────────────┐         ┌──────▼───────┐                  │
│  │  Web Panel   │◄────────┤  RSS Checker │                  │
│  │  (Express)   │         │   (Parser)   │                  │
│  └──────────────┘         └──────┬───────┘                  │
│                                   │                           │
│  ┌──────────────┐         ┌──────▼───────┐                  │
│  │  AI Summary  │◄────────┤   Database   │                  │
│  │ (Gemini/DS)  │         │   (SQLite)   │                  │
│  └──────────────┘         └──────────────┘                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ 开发指南

### 目录结构

```
telRSSRadar/
├── src/
│   ├── index.js              # 主入口
│   ├── bot.js                # Telegram Bot 逻辑
│   ├── webServer.js          # Web 管理面板
│   ├── rssChecker.js         # RSS 检查器
│   ├── database.js           # 数据库操作
│   ├── aiSummary.js          # AI 总结服务
│   ├── logger.js             # 日志模块
│   ├── errorHandler.js       # 错误处理
│   ├── utils.js              # 工具函数
│   ├── constants.js          # 常量定义
│   └── commands/
│       └── filters.js        # 过滤命令
├── views/
│   └── index.html            # Web 界面
├── data/
│   └── rss.db                # SQLite 数据库
├── .env                      # 环境变量配置
├── package.json              # 项目依赖
├── Dockerfile                # Docker 镜像
├── docker-compose.yml        # Docker Compose 配置
└── README.md                 # 项目文档
```

### 开发模式

```bash
npm run dev  # 启用热重载
```

### 添加新的 AI 提供商

1. 在 `src/aiSummary.js` 中添加新的提供商配置
2. 实现 API 调用逻辑
3. 在 Web 界面添加配置选项
4. 更新文档

---

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出建议！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📝 更新日志

### v1.0.0 (2025-11-19)

**新增功能**:

- ✅ 批量管理功能（检查错误源、批量删除）
- ✅ 导入/导出 OPML 和 JSON 格式
- ✅ AI 智能总结（支持 Gemini/DeepSeek/Qwen）
- ✅ 关键词过滤系统
- ✅ Web 管理面板
- ✅ Telegraph 页面预览
- ✅ 完整的 Telegram 命令支持

**优化改进**:

- 🔧 数据库使用 WAL 模式提升性能
- 🔧 Web 面板仅监听本地地址增强安全
- 🔧 API Key 加密存储和传输
- 🔧 错误日志过滤敏感信息

---

## ❓ 常见问题

### 1. Bot 无法收到消息？

- 检查 `BOT_TOKEN` 和 `CHAT_ID` 是否正确
- 确认已向 Bot 发送过 `/start` 命令
- 查看终端日志是否有错误信息

### 2. AI 总结不工作？

- 确认已配置正确的 API Key
- 检查 API Key 是否有足够的额度
- 查看 AI 使用统计中的错误信息
- 确认订阅源的 AI 开关已启用

### 3. RSS 源添加失败？

- 验证 RSS URL 是否可访问
- 检查 URL 是否返回有效的 XML
- 尝试使用 `/test` 命令测试连接
- 查看是否有网络代理设置

### 4. 数据库损坏怎么办？

```bash
# 检查数据库完整性
sqlite3 data/rss.db "PRAGMA integrity_check;"

# 修复数据库
sqlite3 data/rss.db "VACUUM;"
```

### 5. 如何迁移数据？

1. 导出所有订阅源（JSON 或 OPML）
2. 复制 `data/rss.db` 到新服务器
3. 或在新服务器上导入之前导出的文件

---

## 📄 免责声明

### 使用条款

1. **个人使用**: 本软件仅供个人学习和研究使用，不得用于商业目的。

2. **内容责任**:

   - 用户对订阅的 RSS 源内容负全部责任
   - 开发者不对推送的内容承担任何责任
   - 请遵守内容来源网站的服务条款

3. **API 使用**:

   - 使用 AI 服务需遵守相应提供商的服务条款
   - API Key 和使用费用由用户自行承担
   - 建议合理使用，避免超出配额限制

4. **数据安全**:

   - 用户需自行保管 API Key 和数据库文件
   - 建议定期备份重要数据
   - 开发者不对数据丢失承担责任

5. **服务可用性**:

   - 本软件"按原样"提供，不提供任何明示或暗示的保证
   - 不保证软件无错误或持续可用
   - 用户需自行承担使用风险

6. **法律合规**:

   - 请遵守所在地区的法律法规
   - 不得用于非法用途或侵犯他人权益
   - 违法使用造成的后果由用户自行承担

7. **隐私保护**:

   - 所有数据存储在用户本地
   - 不会收集或上传用户数据到第三方
   - 用户需自行保护个人隐私信息

8. **开源协议**:
   - 本项目遵循 ISC 开源协议
   - 允许自由使用、修改和分发
   - 修改后的版本需保留原作者信息

### 风险提示

⚠️ **使用本软件前，请确保:**

- 已阅读并理解上述免责声明
- 具备基本的服务器管理和安全知识
- 了解 RSS 订阅和 Telegram Bot 的工作原理
- 能够自行解决常见的技术问题
- 已做好数据备份和安全防护措施

### 责任限制

在任何情况下，本软件的开发者和贡献者均不对以下情况承担责任：

- 直接或间接的损失或损害
- 数据丢失或损坏
- 服务中断或不可用
- 第三方服务的问题
- 不当使用造成的后果

---

## 📧 联系方式

- **GitHub**: [fishyo/telRSSRadar](https://github.com/fishyo/telRSSRadar)
- **Issues**: [报告问题](https://github.com/fishyo/telRSSRadar/issues)
- **Discussions**: [参与讨论](https://github.com/fishyo/telRSSRadar/discussions)

---

## 📜 许可证

本项目采用 ISC 许可证。详见 [LICENSE](LICENSE) 文件。

---

## 🙏 致谢

感谢以下开源项目：

- [Telegraf](https://github.com/telegraf/telegraf) - Telegram Bot 框架
- [rss-parser](https://github.com/rbren/rss-parser) - RSS 解析器
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - SQLite 数据库
- [Express.js](https://expressjs.com/) - Web 框架
- [Google Gemini](https://ai.google.dev/) - AI 服务
- [DeepSeek](https://www.deepseek.com/) - AI 服务
- [Qwen](https://tongyi.aliyun.com/) - AI 服务

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给一个 Star！**

Made with ❤️ by [fishyo](https://github.com/fishyo)

</div>
