@echo off
setlocal

set "TOKENUSAGE_REPO_DIR=%~dp0"
set "TOKENUSAGE_START=%TOKENUSAGE_REPO_DIR%TokenUsageSilent.vbs"
set "TOKENUSAGE_STOP=%TOKENUSAGE_REPO_DIR%TokenUsageStop.cmd"
set "TOKENUSAGE_ICON=%TOKENUSAGE_REPO_DIR%dashboard\dist\favicon.ico"

if not exist "%TOKENUSAGE_START%" (
  echo Missing TokenUsageSilent.vbs in "%TOKENUSAGE_REPO_DIR%".
  pause
  exit /b 1
)

if not exist "%TOKENUSAGE_STOP%" (
  echo Missing TokenUsageStop.cmd in "%TOKENUSAGE_REPO_DIR%".
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$desktop=[Environment]::GetFolderPath('Desktop');" ^
  "$shell=New-Object -ComObject WScript.Shell;" ^
  "function New-TokenUsageShortcut($name,$target) {" ^
  "  $shortcut=$shell.CreateShortcut((Join-Path $desktop $name));" ^
  "  $shortcut.TargetPath=$target;" ^
  "  $shortcut.WorkingDirectory=$env:TOKENUSAGE_REPO_DIR;" ^
  "  if (Test-Path $env:TOKENUSAGE_ICON) { $shortcut.IconLocation=$env:TOKENUSAGE_ICON; }" ^
  "  $shortcut.Save();" ^
  "}" ^
  "New-TokenUsageShortcut 'Token.lnk' $env:TOKENUSAGE_START;" ^
  "New-TokenUsageShortcut 'TokenStop.lnk' $env:TOKENUSAGE_STOP;"

if errorlevel 1 (
  echo Failed to create desktop shortcuts.
  pause
  exit /b 1
)

echo Created desktop shortcuts:
echo   Token
echo   TokenStop
echo.
echo You can move this project folder later, but run this file again after moving it.
pause

endlocal
