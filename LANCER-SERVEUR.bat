@echo off
title Atelier Stephan Hamache - Serveur
echo ============================================================
echo  ATELIER STEPHAN HAMACHE - Serveur de l'application
echo ============================================================
echo.
echo Demarrage du serveur Next.js...
echo.
echo Une fois pret, l'application sera accessible :
echo   - Sur ce poste     : http://localhost:3000
echo   - Sur les autres PC : http://[IP-DE-CE-POSTE]:3000
echo.
echo Pour connaitre l'IP de ce poste, lance "ipconfig" dans une autre fenetre.
echo Pour arreter le serveur, ferme cette fenetre ou fais Ctrl+C.
echo ============================================================
echo.
cd /d "%~dp0"
echo Construction de l'application...
call npm run build
echo.
echo Demarrage du serveur...
call npm start
pause
