Option Explicit

Dim shell, fso, baseDir, logPath, svc, watcher, startedAt, timeoutSeconds
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
logPath = baseDir & "\logs\console-flash-diagnosis.log"
timeoutSeconds = 300

If Not fso.FolderExists(baseDir & "\logs") Then
  fso.CreateFolder(baseDir & "\logs")
End If

Set svc = GetObject("winmgmts:\\.\root\cimv2")
Set watcher = svc.ExecNotificationQuery( _
  "SELECT * FROM Win32_ProcessStartTrace " & _
  "WHERE ProcessName='cmd.exe' OR ProcessName='pwsh.exe' OR ProcessName='powershell.exe' OR ProcessName='conhost.exe'")

startedAt = Timer
WriteLog "diagnosis started pid=" & GetCurrentPid()

Do While ElapsedSeconds(startedAt) < timeoutSeconds
  Dim eventObj
  Set eventObj = Nothing
  On Error Resume Next
  Set eventObj = watcher.NextEvent(1000)
  If Err.Number <> 0 Then
    Err.Clear
  End If
  On Error GoTo 0
  If Not eventObj Is Nothing Then
    WriteProcessEvent eventObj.ProcessID, eventObj.ParentProcessID, eventObj.ProcessName
  End If
Loop

WriteLog "diagnosis finished"

Sub WriteProcessEvent(pid, ppid, name)
  Dim commandLine, parentCommandLine
  commandLine = ProcessCommandLine(pid)
  parentCommandLine = ProcessCommandLine(ppid)
  WriteLog "start name=" & name & " pid=" & pid & " ppid=" & ppid & _
    " cmd=[" & commandLine & "] parent=[" & parentCommandLine & "]"
End Sub

Function ProcessCommandLine(pid)
  On Error Resume Next
  Dim items, item
  ProcessCommandLine = ""
  If IsNull(pid) Or pid = "" Then Exit Function
  Set items = svc.ExecQuery("SELECT CommandLine FROM Win32_Process WHERE ProcessId=" & CLng(pid))
  For Each item In items
    ProcessCommandLine = "" & item.CommandLine
    Exit For
  Next
  On Error GoTo 0
End Function

Sub WriteLog(message)
  Dim file
  Set file = fso.OpenTextFile(logPath, 8, True)
  file.WriteLine Now & " " & message
  file.Close
End Sub

Function ElapsedSeconds(startValue)
  Dim nowValue
  nowValue = Timer
  If nowValue >= startValue Then
    ElapsedSeconds = nowValue - startValue
  Else
    ElapsedSeconds = (86400 - startValue) + nowValue
  End If
End Function

Function GetCurrentPid()
  Dim processes, process, currentCommand
  currentCommand = LCase(WScript.ScriptFullName)
  GetCurrentPid = ""
  Set processes = svc.ExecQuery("SELECT ProcessId,CommandLine FROM Win32_Process WHERE Name='wscript.exe' OR Name='cscript.exe'")
  For Each process In processes
    If InStr(LCase("" & process.CommandLine), currentCommand) > 0 Then
      GetCurrentPid = process.ProcessId
      Exit Function
    End If
  Next
End Function
