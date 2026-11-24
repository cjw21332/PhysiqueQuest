@echo off
cd /d "%~dp0..\.."
echo Pushing PhysiqueQuest-v6.1.0 (source only, no APKs) to GitHub...
echo.
git push origin 7e032c2d4df970a8969a3c1b55a0df88495eaf97:refs/heads/PhysiqueQuest-v6.1.0
echo.
if errorlevel 1 (echo PUSH FAILED - read the messages above.) else (echo PUSH OK - branch PhysiqueQuest-v6.1.0 is on GitHub.)
pause
