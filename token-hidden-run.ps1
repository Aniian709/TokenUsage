$repo = 'C:\Users\Tanian\Desktop\WorkFile\token usage\token'
$pidPath = Join-Path $repo 'token.pid'

Set-Content -LiteralPath $pidPath -Value $PID -NoNewline

& 'D:\nodejs\node.exe' 'C:\Users\Tanian\Desktop\WorkFile\token usage\token\bin\tracker.js' 'serve'
