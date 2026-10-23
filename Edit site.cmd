@echo off
rem Starts the site editor and opens it in your browser. Close this window to stop it.
cd /d "%~dp0"
start "" http://localhost:4321/admin/
node serve.mjs
pause
