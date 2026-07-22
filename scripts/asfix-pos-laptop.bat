@echo off
REM AsFix POS Laptop — double-click to open POS + start COM bridge when available
cd /d "%~dp0.."
title AsFix POS Laptop Print Station
echo.
echo Starting AsFix POS Laptop...
echo.
node "%~dp0asfix-pos-laptop.mjs"
if errorlevel 1 (
  echo.
  echo Node.js is required. Install from https://nodejs.org then try again.
  pause
  exit /b 1
)
pause
