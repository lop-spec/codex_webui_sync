Option Explicit

Dim shell, fso, baseDir
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
baseDir = fso.GetParentFolderName(WScript.ScriptFullName)

shell.Run "wscript.exe """ & baseDir & "\DIAGNOSE_CONSOLE_FLASHES.vbs""", 0, False
shell.Run "wscript.exe """ & baseDir & "\INSTALL_HIDDEN_STARTUP_ENTRY.vbs""", 0, True
TerminateMatchingProcesses
WScript.Sleep 1200

shell.Run "wscript.exe """ & baseDir & "\START_WATCHDOG_HIDDEN.vbs""", 0, False

Sub TerminateMatchingProcesses()
  Dim svc, processes, process, name, commandLine
  Set svc = GetObject("winmgmts:\\.\root\cimv2")
  Set processes = svc.ExecQuery("SELECT ProcessId,Name,CommandLine FROM Win32_Process")

  For Each process In processes
    name = LCase("" & process.Name)
    commandLine = LCase("" & process.CommandLine)

    If IsWebuiProcess(name, commandLine) Then
      On Error Resume Next
      process.Terminate()
      On Error GoTo 0
    End If
  Next
End Sub

Function IsWebuiProcess(name, commandLine)
  IsWebuiProcess = False

  If InStr(commandLine, "codex-webui-ts") > 0 Then
    If InStr(commandLine, "dist/server.js") > 0 Then
      IsWebuiProcess = True
      Exit Function
    End If
    If InStr(commandLine, "watchdog.cjs") > 0 Or InStr(commandLine, "watchdog.js") > 0 Then
      IsWebuiProcess = True
      Exit Function
    End If
    If InStr(commandLine, "run_watchdog_forever.cmd") > 0 Then
      IsWebuiProcess = True
      Exit Function
    End If
  End If

  If name = "codex.exe" And InStr(commandLine, "app-server") > 0 And InStr(commandLine, "--disable shell_tool") > 0 Then
    IsWebuiProcess = True
  End If
End Function
