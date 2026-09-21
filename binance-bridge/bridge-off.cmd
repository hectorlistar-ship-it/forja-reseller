@echo off
schtasks /Change /TN "ForjaResellerBridge" /DISABLE >nul 2>&1
if %errorlevel%==0 (
  echo [OK] Bridge APAGADO - no revisara pagos.
) else (
  echo [ERROR] No se pudo apagar. Ejecuta este comando como Administrador.
)
pause
