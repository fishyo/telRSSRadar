@echo off
setlocal enabledelayedexpansion

echo === Telegram RSS Bot GitHub 部署脚本 ===
echo.

rem 检查是否已安装 Git
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未检测到 Git。请先安装 Git。
    exit /b 1
)

rem 检查当前目录是否为 Git 仓库
git rev-parse --git-dir >nul 2>&1
if %errorlevel% neq 0 (
    echo 初始化 Git 仓库...
    git init
    git add .
    git config user.email "telegram-rss-bot@example.com"
    git config user.name "Telegram RSS Bot"
    git commit -m "Initial commit"
)

echo 请按照以下步骤操作：
echo.
echo 1. 在 GitHub 上创建一个新的仓库：
echo    a. 登录 GitHub
echo    b. 点击右上角的 '+' 号
echo    c. 选择 'New repository'
echo    d. 输入仓库名称（例如：telegram-rss-bot）
echo    e. 选择公开或私有
echo    f. 不要初始化 README、.gitignore 或 LICENSE
echo    g. 点击 'Create repository'
echo.
echo 2. 获取仓库的 HTTPS URL（例如：https://github.com/yourusername/telegram-rss-bot.git）
echo.
set /p REPO_URL=请输入您的 GitHub 仓库 URL: 

rem 验证 URL 格式（简单验证）
echo %REPO_URL% | findstr /R "^https://github.com/.*/.*\.git$" >nul
if %errorlevel% neq 0 (
    echo 错误: URL 格式不正确。应该类似于 https://github.com/username/repository.git
    exit /b 1
)

rem 添加远程仓库
echo 添加远程仓库...
git remote add origin %REPO_URL%

rem 设置主分支
echo 设置主分支...
git branch -M main

rem 推送到 GitHub
echo 推送到 GitHub...
git push -u origin main

echo.
echo === 部署完成 ===
echo 您的 Telegram RSS Bot 项目已成功上传到 GitHub！
echo.
echo 下一步：
echo 1. 在其他设备上部署：
echo    git clone %REPO_URL%
echo    cd telegram-rss-bot
echo    npm install
echo    copy .env.example .env
echo    rem 编辑 .env 文件填入您的 Telegram 凭据
echo    npm start
echo.
pause
