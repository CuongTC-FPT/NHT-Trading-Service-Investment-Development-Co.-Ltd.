@echo off
cd /d "%~dp0backend"
set "LOCAL_URL=http://localhost:3000"
set "ADMIN_URL=http://localhost:3000/admin-login.html"

netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul
if not errorlevel 1 (
  echo.
  echo Backend NHT dang chay tai:
  echo %LOCAL_URL%
  echo.
  echo Dang mo website tren trinh duyet...
  start "" "%LOCAL_URL%"
  echo.
  exit /b 0
)

echo Dang chay backend NHT tai:
echo %LOCAL_URL%
echo.
echo Trang admin:
echo %ADMIN_URL%
echo.
echo Dang mo website tren trinh duyet...
echo Nhan Ctrl+C de dung server.
echo.
start "" "%LOCAL_URL%"
node index.js
pause
