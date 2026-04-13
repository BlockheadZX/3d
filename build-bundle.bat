@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在打包 main-enhanced.js 为 file-bundle.js …
npx --yes esbuild main-enhanced.js --bundle --format=iife --outfile=file-bundle.js --platform=browser --target=es2019 --alias:three=./vendor/three/build/three.module.js
if errorlevel 1 (
  echo 打包失败。请安装 Node.js 后重试。
  pause
  exit /b 1
)
echo 完成: file-bundle.js
pause
