@echo off
setlocal

set "REPO_DIR=%~dp0"
cd /d "%REPO_DIR%"
title TokenUsage
set "CMD_ARGS=serve"
if not "%~1"=="" set "CMD_ARGS=%*"

set "NODE_EXE="
for %%I in (node.exe) do set "NODE_EXE=%%~$PATH:I"
if not defined NODE_EXE if exist "D:\nodejs\node.exe" set "NODE_EXE=D:\nodejs\node.exe"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LocalAppData%\Programs\nodejs\node.exe" set "NODE_EXE=%LocalAppData%\Programs\nodejs\node.exe"

if not defined NODE_EXE (
  echo TokenUsage could not find Node.js.
  echo.
  echo Install Node.js 20+ or add node.exe to PATH, then try again.
  pause
  exit /b 1
)

"%NODE_EXE%" "%REPO_DIR%bin\tracker.js" %CMD_ARGS%
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo TokenUsage exited with code %EXIT_CODE%.
  pause
)

endlocal
exit /b %EXIT_CODE%
