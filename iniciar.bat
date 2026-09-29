@echo off
chcp 65001 >nul
title Fio da Lamina
cd /d "%~dp0"

if not exist node_modules (
  echo Instalando dependencias pela primeira vez, aguarde...
  call npm install
  if errorlevel 1 (
    echo.
    echo Falhou ao instalar. Precisa ter o Node.js instalado: https://nodejs.org
    pause
    exit /b 1
  )
)

echo.
echo Endereco deste PC na rede (para abrir no celular, mesmo Wi-Fi):
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R /C:"IPv4"') do (
  for /f "tokens=1" %%b in ("%%a") do echo   http://%%b:5173
)
echo.
echo No PC vai abrir sozinho em http://localhost:5173
echo Para parar o jogo, feche esta janela ou aperte Ctrl+C.
echo.

start "" http://localhost:5173
call npx vite --host
pause
