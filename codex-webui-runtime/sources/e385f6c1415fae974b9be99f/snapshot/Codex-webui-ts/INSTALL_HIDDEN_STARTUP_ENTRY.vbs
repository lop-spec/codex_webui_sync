Option Explicit

Dim shell, fso, baseDir, programsDir, startupDir, shortcutPath, oldCmdPath, shortcut
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
programsDir = shell.SpecialFolders("Programs")
startupDir = shell.SpecialFolders("Startup")

shortcutPath = programsDir & "\Codex WebUI Start.lnk"
oldCmdPath = programsDir & "\Codex WebUI Start.cmd"

If fso.FileExists(oldCmdPath) Then
  On Error Resume Next
  fso.DeleteFile oldCmdPath, True
  On Error GoTo 0
End If

Set shortcut = shell.CreateShortcut(shortcutPath)
shortcut.TargetPath = "wscript.exe"
shortcut.Arguments = """" & baseDir & "\START_WATCHDOG_HIDDEN.vbs"""
shortcut.WorkingDirectory = baseDir
shortcut.WindowStyle = 7
shortcut.Description = "Start Codex WebUI watchdog hidden"
shortcut.Save

Set shortcut = shell.CreateShortcut(startupDir & "\Codex WebUI Watchdog.lnk")
shortcut.TargetPath = "wscript.exe"
shortcut.Arguments = """" & baseDir & "\START_WATCHDOG_HIDDEN.vbs"""
shortcut.WorkingDirectory = baseDir
shortcut.WindowStyle = 7
shortcut.Description = "Start Codex WebUI watchdog hidden"
shortcut.Save
