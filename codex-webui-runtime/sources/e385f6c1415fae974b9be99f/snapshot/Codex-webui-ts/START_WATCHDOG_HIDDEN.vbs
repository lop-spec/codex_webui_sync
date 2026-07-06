Option Explicit

Dim shell, fso, baseDir, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
command = "cmd.exe /d /c """ & baseDir & "\RUN_WATCHDOG_FOREVER.cmd"""

shell.CurrentDirectory = baseDir
shell.Run command, 0, False
