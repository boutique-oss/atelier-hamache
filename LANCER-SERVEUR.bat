@echo off
title Atelier Stephan Hamache - Serveur
echo ============================================================
echo  ATELIER STEPHAN HAMACHE - Serveur de l'application
echo ============================================================
echo.
cd /d "%~dp0"

echo [1/3] Installation des dependances...
call npm install
echo.

echo [2/3] Construction de l'application...
call npm run build
echo.

echo [3/3] Demarrage du serveur...
echo   - Sur ce poste      : http://localhost:3001
echo   - Sur les autres PC : http://[IP-DE-CE-POSTE]:3001
echo Pour arreter : ferme cette fenetre ou Ctrl+C
echo.

:: Ouvre Arc dans 6 secondes (temps que le serveur demarre)
start "" cmd /c "timeout /t 6 /nobreak >nul && start arc http://localhost:3001"

call npm start
pause
