@echo off
echo === Estado de la tarea ForjaResellerBridge ===
schtasks /Query /TN "ForjaResellerBridge" /FO LIST 2>nul | findstr /i "TaskName Status Next Last"
echo.
echo === Ultimas 15 lineas del log ===
powershell -NoProfile -Command "if (Test-Path 'C:\forja-reseller\binance-bridge\logs\bridge.log') { Get-Content 'C:\forja-reseller\binance-bridge\logs\bridge.log' -Tail 15 } else { 'Sin log todavia' }"
pause
