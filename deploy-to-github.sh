#!/bin/bash

# Telegram RSS Bot GitHub 部署脚本

echo "=== Telegram RSS Bot GitHub 部署脚本 ==="
echo

# 检查是否已安装 Git
if ! command -v git &> /dev/null
then
    echo "错误: 未检测到 Git。请先安装 Git。"
    exit 1
fi

# 检查当前目录是否为 Git 仓库
if ! git rev-parse --git-dir > /dev/null 2>&1
then
    echo "初始化 Git 仓库..."
    git init
    git add .
    git config user.email "telegram-rss-bot@example.com"
    git config user.name "Telegram RSS Bot"
    git commit -m "Initial commit"
fi

echo "请按照以下步骤操作："
echo
echo "1. 在 GitHub 上创建一个新的仓库："
echo "   a. 登录 GitHub"
echo "   b. 点击右上角的 '+' 号"
echo "   c. 选择 'New repository'"
echo "   d. 输入仓库名称（例如：telegram-rss-bot）"
echo "   e. 选择公开或私有"
echo "   f. 不要初始化 README、.gitignore 或 LICENSE"
echo "   g. 点击 'Create repository'"
echo
echo "2. 获取仓库的 HTTPS URL（例如：https://github.com/yourusername/telegram-rss-bot.git）"
echo
echo -n "请输入您的 GitHub 仓库 URL: "
read REPO_URL

# 验证 URL 格式
if [[ ! $REPO_URL =~ ^https://github.com/[^/]+/[^/]+\.git$ ]]; then
    echo "错误: URL 格式不正确。应该类似于 https://github.com/username/repository.git"
    exit 1
fi

# 添加远程仓库
echo "添加远程仓库..."
git remote add origin $REPO_URL

# 设置主分支
echo "设置主分支..."
git branch -M main

# 推送到 GitHub
echo "推送到 GitHub..."
git push -u origin main

echo
echo "=== 部署完成 ==="
echo "您的 Telegram RSS Bot 项目已成功上传到 GitHub！"
echo
echo "下一步："
echo "1. 在其他设备上部署："
echo "   git clone $REPO_URL"
echo "   cd telegram-rss-bot"
echo "   npm install"
echo "   cp .env.example .env"
echo "   # 编辑 .env 文件填入您的 Telegram 凭据"
echo "   npm start"
