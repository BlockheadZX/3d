@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo 正在启动本地网页服务（请勿关闭本窗口）……
echo 浏览器将打开: http://127.0.0.1:8765/
echo 按 Ctrl+C 可停止服务。
echo.
start "" "http://127.0.0.1:8765/"
python -m http.server 8765
if errorlevel 1 (
  echo.
  echo 未找到 python 命令。请安装 Python 3，或将本文件夹用其它方式提供 HTTP 访问。
  pause
)
