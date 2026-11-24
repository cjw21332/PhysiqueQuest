@echo off
setlocal
for %%I in ("%~dp0..\..") do set "ROOT=%%~fI"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "LOG=%ROOT%\build-logs\apk-1.5.1.log"
set "STATUS=%ROOT%\build-logs\apk-1.5.1.status"

echo RUNNING> "%STATUS%"
echo === PhysiqueQuest 1.5.1 standalone APK (fast path) === > "%LOG%"
echo Started %DATE% %TIME% >> "%LOG%"

rem No cache copying. The default Gradle home (C:\Users\<user>\.gradle) is
rem already short enough for ninja's 260-character limit and is already
rem populated - attempts 2 and 4 configured against it in about three minutes.
rem The long .gradle-local paths that broke attempt 4 were baked into stale
rem generated ninja files, so those .cxx trees are deleted here instead.
rem reanimated still needs its object tree relocated: -PpqCxxDir=C:/pqcxx.

taskkill /F /IM robocopy.exe >nul 2>&1

if not defined JAVA_HOME set "JAVA_HOME=%ROOT%\.gradle-local\jdks\eclipse_adoptium-17-amd64-windows.2"
echo JAVA_HOME=%JAVA_HOME% >> "%LOG%"
echo GRADLE_USER_HOME=[%GRADLE_USER_HOME%] (empty means the default home) >> "%LOG%"

echo --- clearing stale native config --- >> "%LOG%"
if exist "%ROOT%\mobile\android\app\.cxx" rmdir /s /q "%ROOT%\mobile\android\app\.cxx"
if exist "%ROOT%\mobile\node_modules\react-native-reanimated\android\.cxx" rmdir /s /q "%ROOT%\mobile\node_modules\react-native-reanimated\android\.cxx"
if exist "C:\pqcxx" rmdir /s /q "C:\pqcxx"

if not exist "%ROOT%\frontend\.next-mobile-export\index.html" (
  echo --- web export missing, building it --- >> "%LOG%"
  cd /d "%ROOT%\frontend" || goto fail
  call npm run build:mobile-shell >> "%LOG%" 2>&1
  if errorlevel 1 goto fail
) else (
  echo --- web export already present, reusing it --- >> "%LOG%"
)

echo. >> "%LOG%"
echo --- gradlew assembleStandalone -PpqCxxDir=C:/pqcxx --- >> "%LOG%"
cd /d "%ROOT%\mobile\android" || goto fail
call gradlew.bat assembleStandalone -PpqCxxDir=C:/pqcxx >> "%LOG%" 2>&1
if errorlevel 1 goto fail

echo. >> "%LOG%"
echo --- copy artifact --- >> "%LOG%"
cd /d "%ROOT%"
if not exist "%ROOT%\output" mkdir "%ROOT%\output"
copy /Y "%ROOT%\mobile\android\app\build\outputs\apk\standalone\app-standalone.apk" "%ROOT%\output\PhysiqueQuest-v1.5.1.apk" >> "%LOG%" 2>&1
if errorlevel 1 goto fail

echo OK> "%STATUS%"
echo BUILD OK %DATE% %TIME% >> "%LOG%"
echo.
echo ============================================
echo  BUILD OK  output\PhysiqueQuest-v1.5.1.apk
echo ============================================
pause
exit /b 0

:fail
echo FAILED> "%STATUS%"
echo BUILD FAILED %DATE% %TIME% >> "%LOG%"
echo.
echo ============================================
echo  BUILD FAILED - see build-logs\apk-1.5.1.log
echo ============================================
pause
exit /b 1
