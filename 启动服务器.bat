@echo off
chcp 65001 > nul
echo ================================
echo   仓库管理系统 - 服务器启动
echo ================================
echo.
echo 正在启动服务器...
echo.

start http://localhost:3000

node server.js

pause
