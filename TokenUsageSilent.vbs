Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

repoDir = fso.GetParentFolderName(WScript.ScriptFullName)
cmdPath = repoDir & "\TokenUsage.cmd"

If Not fso.FileExists(cmdPath) Then
  WScript.Echo "Missing TokenUsage.cmd in " & repoDir
  WScript.Quit 1
End If

shell.CurrentDirectory = repoDir
shell.Run "cmd.exe /c """ & cmdPath & """", 0, False
