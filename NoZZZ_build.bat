@echo off
setlocal enabledelayedexpansion

:: GARANTIR QUE ESTAMOS NA RAIZ DO PROJETO
cd /d %~dp0

title Oculus App - Build & Run (React Native)

echo ===========================================
echo   Oculus App - Build & Run (React Native)
echo ===========================================
echo.

:: VARIÁVEIS DE AMBIENTE
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set ANDROID_HOME=C:\Users\rmace\AppData\Local\Android\Sdk
set NODE_HOME=C:\Program Files\nodejs
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%NODE_HOME%;%PATH%

echo Ambiente configurado.
echo.

:: CONTROLAR node_modules
if not exist node_modules (
    echo node_modules nao existe. A correr npm install...
    call npm install
) else (
    echo node_modules encontrado, a saltar npm install.
)

echo.

:: LIMPAR GRADLE
echo A limpar Gradle...
cd android
call gradlew.bat clean
cd ..
echo.

:: CONFIGURAR ADB
"%ANDROID_HOME%\platform-tools\adb.exe" reverse tcp:8081 tcp:8081

echo A iniciar build Android...
call npx react-native run-android

pause
