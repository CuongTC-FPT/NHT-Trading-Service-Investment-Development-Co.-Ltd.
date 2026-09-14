@echo off
cd /d "%~dp0backend"
set "LOCAL_URL=http://localhost:3000"

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
echo Dang khoi dong backend...
echo Trinh duyet se tu mo khi backend san sang.
echo Nhan Ctrl+C de dung server.
echo.
start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "$url='%LOCAL_URL%'; for ($i = 0; $i -lt 120; $i++) { try { $response = Invoke-WebRequest -UseBasicParsing -Uri ($url + '/healthz') -TimeoutSec 1; if ($response.StatusCode -eq 200) { Start-Process $url; exit 0 } } catch {}; Start-Sleep -Milliseconds 250 }"
node index.js
pause
