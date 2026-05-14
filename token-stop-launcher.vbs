Set shell = CreateObject("WScript.Shell")

' Stop by PID for a near-instant shutdown.
shell.Run "cmd.exe /c ""C:\Users\Tanian\Desktop\WorkFile\token usage\token\token-stop.cmd""", 0, False
