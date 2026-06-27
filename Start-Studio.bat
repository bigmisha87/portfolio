@echo off
REM ===== Misha Graphics - launch the Studio editor =====
REM Double-click this file. It starts a tiny local server using PowerShell
REM (built into Windows - NO Python needed) and opens the Studio in your
REM browser. Keep the little server window open while you edit; close it
REM when you're done.

cd /d "%~dp0"
echo.
echo   Misha Graphics - Studio
echo   Starting a local server and opening the editor...
echo.
start "Misha Graphics server (keep open while editing)" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
timeout /t 2 >nul
start "" http://localhost:8080/studio.html
exit
