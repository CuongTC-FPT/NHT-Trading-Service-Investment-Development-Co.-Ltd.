@echo off
cd /d "%~dp0backend"

netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul
if not errorlevel 1 (
  echo.
  echo Port 3000 dang duoc su dung. Hay dong cua so backend cu hoac dung tien trinh Node dang chay truoc.
  echo Sau do chay lai file start-backend.bat.
  echo.
  pause
  exit /b 1
)

echo Dang chay backend NHT tai http://localhost:3000
echo Trang admin: http://localhost:3000/admin-login.html
echo Nhan Ctrl+C de dung server.
echo.
node index.js
pause
