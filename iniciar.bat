@echo off
chcp 65001 >nul
title Controla Marcher - Servidor local (sem build)
cd /d "%~dp0"

echo ============================================
echo   CONTROLA MARCHER - Ambiente local
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado no computador.
  echo.
  echo Instale a versao LTS em https://nodejs.org e execute este arquivo de novo.
  echo Abrindo a pagina de download...
  start "" https://nodejs.org/pt-br/download
  echo.
  pause
  exit /b 1
)

if not exist "server.mjs" (
  echo [ERRO] server.mjs nao encontrado.
  echo        Coloque este .bat na mesma pasta do index.html e do server.mjs.
  echo.
  pause
  exit /b 1
)

echo Abrindo o navegador em  http://localhost:5173
start "" http://localhost:5173
echo.
echo Servidor rodando (sem build, sem npm install).
echo Para PARAR: feche esta janela ou pressione Ctrl+C.
echo ============================================
echo.

node server.mjs

echo.
echo Servidor encerrado.
pause
