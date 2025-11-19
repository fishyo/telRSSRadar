# 使用 Node.js 24 LTS 版本
FROM node:24-alpine

# 安装构建工具（用于编译 better-sqlite3）
RUN apk add --no-cache python3 make g++

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --production

# 复制应用代码
COPY src ./src

# 创建数据目录
RUN mkdir -p /app/data

# 设置环境变量
ENV NODE_ENV=production

# 启动应用
CMD ["npm", "start"]
