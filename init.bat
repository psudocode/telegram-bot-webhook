@echo off
title My Node + Ngrok Auto Start

REM === Go to your project folder ===
cd /d C:\Users\Psudo\CascadeProjects\telegram-bot-webhook

REM === Start Node in a new window ===
start cmd /k "npm run start"

REM small delay so Node is ready before ngrok starts
timeout /t 5 /nobreak >nul

REM === Start ngrok in another window ===
start cmd /k "ngrok http 3000"

echo All started!