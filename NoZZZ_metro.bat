@echo off
title Oculus App - Metro Server (React Native)

echo ===========================================
echo   Oculus App - Metro Bundler
echo ===========================================
echo.

:: VARIAVEIS DE AMBIENTE
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set ANDROID_HOME=C:\Users\rmace\AppData\Local\Android\Sdk
set NODE_HOME=C:\Program Files\nodejs
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%NODE_HOME%;%PATH%

echo Ambiente preparado. A iniciar Metro...
echo (Nao feches esta janela enquanto estiveres a trabalhar.)
echo.

:: Metro oficial de React Native
call npx react-native start

echo.
echo Metro terminou.
pause
