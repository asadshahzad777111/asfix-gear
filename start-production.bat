@echo off
title AsFix ^& Gear — Production (port 5000)
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm nahi mila. Node.js install karein: https://nodejs.org
  pause
  exit /b 1
)

echo.
echo Building frontend...
call npm run build --prefix frontend
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)

echo.
echo Starting production server on http://localhost:5000
echo Browser mein kholein: http://localhost:5000
echo Band karne ke liye: Ctrl+C
echo.

set NODE_ENV=production
node backend/server.js

pause
