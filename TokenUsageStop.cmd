@echo off
setlocal

set "REPO_DIR=%~dp0"
set "TRACKER_DIR=%USERPROFILE%\.tokenusage\tracker"

if exist "%TRACKER_DIR%\widget-host.pid" (
  for /f "usebackq delims=" %%i in ("%TRACKER_DIR%\widget-host.pid") do taskkill /PID %%i /T /F >nul 2>nul
)

if exist "%REPO_DIR%token.pid" (
  for /f "usebackq delims=" %%i in ("%REPO_DIR%token.pid") do taskkill /PID %%i /T /F >nul 2>nul
)

for /f "tokens=5" %%i in ('netstat -ano ^| findstr /R /C:":7680 .*LISTENING"') do taskkill /PID %%i /T /F >nul 2>nul

del /q "%TRACKER_DIR%\widget-host.pid" "%REPO_DIR%token.pid" >nul 2>nul

echo TokenUsage stopped.
timeout /t 2 >nul

endlocal
