@echo off
title HotBoard Launcher
cd /d "%~dp0backend"

REM Check if service is already running
curl -s -o nul --max-time 2 http://localhost:8000/
if %errorlevel%==0 (
    echo HotBoard service is already running, opening page...
    start "" http://localhost:8000
    exit /b 0
)

echo Starting HotBoard service...
start "HotBoard Service (do not close)" cmd /k ".venv\Scripts\python.exe app.py"

echo Waiting for service to start...
ping -n 5 127.0.0.1 >nul

echo Opening browser...
start "" http://localhost:8000

echo.
echo HotBoard started. Keep the "HotBoard Service" window open while using.
pause
