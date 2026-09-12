@echo off
echo ===================================================
echo     STARTING LUNAR-ALIGN GITHUB UPLOAD
echo ===================================================
echo.
echo 1. Launching GitHub authenticator...
echo 2. Please look for a popup window or browser tab to sign in!
echo.
cd "e:\lunar align"
git push -u origin main
echo.
echo ===================================================
echo UPLOAD FINISHED! You can close this window now.
echo ===================================================
pause
