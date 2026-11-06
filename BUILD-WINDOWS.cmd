@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20.11 or newer is required to rebuild the source.
  echo Rebuilding is NOT needed to use the ready-to-upload ZIP.
  pause
  exit /b 1
)
node -e "const p=process.versions.node.split('.').map(Number);process.exit(p[0]<20||(p[0]===20&&p[1]<11)?1:0)"
if errorlevel 1 (
  echo Please use Node.js 20.11 or newer.
  pause
  exit /b 1
)
if not exist "node_modules\typescript\bin\tsc" (
  echo Installing the pinned TypeScript development compiler. Internet is needed for this step.
  call npm install --ignore-scripts --no-audit --no-fund
  if errorlevel 1 goto failed
)
call npm run typecheck
if errorlevel 1 goto failed
call npm run build
if errorlevel 1 goto failed
call npm test
if errorlevel 1 goto failed
node --test tests\package.test.mjs
if errorlevel 1 goto failed
echo.
echo Build complete. Upload the CONTENTS of dist to your static HTTPS host.
echo Native iPhone and offline-integration checks are still required.
pause
exit /b 0
:failed
echo.
echo A build or test step failed. Do not deploy a partially rebuilt folder.
pause
exit /b 1
