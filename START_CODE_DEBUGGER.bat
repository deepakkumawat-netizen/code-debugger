@echo off
title Code_Debugger Startup
echo Starting Code_Debugger...
echo.
echo Starting Backend on port 8000...
start "Code_Debugger Backend" cmd /k "cd /d %~dp0backend && python main.py"
timeout /t 3
echo.
echo Starting Frontend on port 5174...
start "Code_Debugger Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 5
echo.
echo Opening http://localhost:5174 in browser...
start http://localhost:5174
echo Done! Servers should be running now.
pause
