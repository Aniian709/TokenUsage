Set shell = CreateObject("WScript.Shell")

shell.CurrentDirectory = "C:\Users\Tanian\Desktop\WorkFile\token usage\token"
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File ""C:\Users\Tanian\Desktop\WorkFile\token usage\token\token-hidden-run.ps1""", 0, False
