@echo off
cd /d "%~dp0"
title WARDOGS BOT AI

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js not found. Install from https://nodejs.org/
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  echo Created .env - fill DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID, OPENAI_API_KEY
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing npm packages...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    echo.
    pause
    exit /b 1
  )
)

echo Starting WARDOGS BOT AI...
echo Close this window to stop the bot.
echo.
call npm start
echo.
echo Bot stopped.
pause
