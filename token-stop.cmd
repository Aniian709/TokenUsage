@echo off
setlocal

if exist "%USERPROFILE%\.tokenusage\tracker\widget-host.pid" (
  for /f "usebackq delims=" %%i in ("%USERPROFILE%\.tokenusage\tracker\widget-host.pid") do taskkill /PID %%i /T /F >nul 2>nul
)

if exist "C:\Users\Tanian\Desktop\WorkFile\token usage\token\token.pid" (
  for /f "usebackq delims=" %%i in ("C:\Users\Tanian\Desktop\WorkFile\token usage\token\token.pid") do taskkill /PID %%i /T /F >nul 2>nul
)

for /f "tokens=5" %%i in ('netstat -ano ^| findstr /R /C:":7680 .*LISTENING"') do taskkill /PID %%i /T /F >nul 2>nul

del /q "%USERPROFILE%\.tokenusage\tracker\widget-host.pid" "C:\Users\Tanian\Desktop\WorkFile\token usage\token\token.pid" >nul 2>nul

endlocal
