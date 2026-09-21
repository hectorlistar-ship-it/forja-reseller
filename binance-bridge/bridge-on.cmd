@echo off
schtasks /Change /TN "ForjaResellerBridge" /ENABLE >nul 2>&1
if %errorlevel%==0 (
  echo [OK] Bridge ENCENDIDO - revisara pagos cada 5 minutos.
  schtasks /Run /TN "ForjaResellerBridge" >nul 2>&1
) else (
  echo [ERROR] No se pudo encender. Ejecuta este comando como Administrador.
)
pause
