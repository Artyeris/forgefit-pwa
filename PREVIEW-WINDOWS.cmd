@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. This script is only for an optional PC preview.
  echo For iPhone installation, upload the prebuilt ZIP using docs\INSTALL-IPHONE.md.
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  echo The prebuilt dist folder is missing. Run BUILD-WINDOWS.cmd first.
  pause
  exit /b 1
)
echo.
echo ForgeFit PC preview: http://127.0.0.1:4173
echo This is a loopback-only developer preview, NOT the iPhone install method.
echo Press Ctrl+C to stop this preview. An installed hosted PWA does not need this running.
echo.
node scripts\serve.mjs
pause
