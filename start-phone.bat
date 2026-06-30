@echo off
title AsFix ^& Gear — Phone Test
cd /d "%~dp0"

echo.
echo ========================================
echo   AsFix ^& Gear — Backend + Frontend
echo ========================================
echo.

where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm nahi mila. Pehle Node.js install karein: https://nodejs.org
  pause
  exit /b 1
)

echo [1/2] Backend start ho raha hai (port 5000)...
start "AsFix BACKEND - mat band karein" cmd /k "cd /d %~dp0backend && npm run dev"

echo Thora wait...
timeout /t 3 /nobreak >nul

echo [2/2] Frontend start ho rahi hai (port 5173)...
start "AsFix FRONTEND - mat band karein" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================
echo   DONO windows open honi chahiye:
echo   1) BACKEND  - "API running on ...5000"
echo   2) FRONTEND - "Network: http://192.168..."
echo ========================================
echo.
echo Phone par (Chrome):
echo   http://192.168.1.9:5173
echo.
echo IMPORTANT: http likhein — https NAHI
echo PC aur phone SAME Wi-Fi par hon
echo.
pause
