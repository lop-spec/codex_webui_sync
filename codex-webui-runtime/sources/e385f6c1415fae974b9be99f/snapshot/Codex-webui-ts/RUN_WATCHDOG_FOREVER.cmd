@echo off
setlocal
cd /d "%~dp0"
if not exist logs mkdir logs

:loop
>> logs\webui-watchdog-runner.log echo %DATE% %TIME% starting watchdog
node watchdog.cjs >> logs\webui-watchdog-runner.out.log 2>> logs\webui-watchdog-runner.err.log
>> logs\webui-watchdog-runner.log echo %DATE% %TIME% watchdog exited code %ERRORLEVEL%
timeout /t 3 /nobreak >nul
goto loop
