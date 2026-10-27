@echo off
echo =======================================================
echo   BUILDING ANDROID APK - NHA TRO THONG MINH THANH TAM
echo =======================================================
echo.

set "ANDROID_HOME=C:\Users\ASUS\AppData\Local\Android\Sdk"
set "PATH=%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\build-tools\34.0.0;%PATH%"

cd /d "%~dp0\frontend"
echo [1/3] Building Web assets with Vite...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to build Web assets!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Syncing assets to native Android project...
call npx cap sync android
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to sync Capacitor Android!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [3/3] Compiling native Android APK with Gradle...
cd android
call .\gradlew.bat assembleDebug
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to assemble Android APK!
    pause
    exit /b %ERRORLEVEL%
)

if not exist "%~dp0\dist-mobile" mkdir "%~dp0\dist-mobile"
copy /y "%~dp0\frontend\android\app\build\outputs\apk\debug\app-debug.apk" "%~dp0\dist-mobile\NhaTroThanhTam-v1.0.0.apk"

echo.
echo =======================================================
echo   BUILD SUCCESSFUL!
echo   APK location: dist-mobile\NhaTroThanhTam-v1.0.0.apk
echo =======================================================
pause
