@echo off
setlocal DisableDelayedExpansion
echo DSH Custom Themes - Official Desktop Plugin Installer
set "themeInstallDir=%LOCALAPPDATA%\Programs\DeepSeek Harness"
if not "%~1"=="" set "themeInstallDir=%~1"
if not exist "%themeInstallDir%\resources\runtime\cli\bin\dsh.cmd" (
  echo Official DSH Desktop was not found. Install it first.
  echo For another location: install.cmd "C:\your\official\installation"
  goto failure
)
if not exist "%~dp0__THEME_PACKAGE__" (
  echo Extract the entire release ZIP. This source template cannot install a theme.
  goto failure
)
tasklist /FI "IMAGENAME eq DeepSeek Harness.exe" /NH | find /I "DeepSeek Harness.exe" >nul
if not errorlevel 1 (
  echo Fully exit DSH from the tray, then run this installer again.
  goto failure
)
certutil -hashfile "%~dp0__THEME_PACKAGE__" SHA256 | findstr /I /X /C:"__THEME_SHA256__" >nul
if errorlevel 1 (
  echo Checksum mismatch or verification unavailable. Download a fresh release ZIP.
  goto failure
)
call "%themeInstallDir%\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "%~dp0__THEME_PACKAGE__"
if errorlevel 1 (
  echo Installation failed. See the message above and README.md.
  goto failure
)
echo Installed! Reopen DSH and go to Settings ^> Custom Themes.
echo Keep this folder. If moved, run the installer again. History is untouched.
if not "%DSH_THEME_NO_PAUSE%"=="1" pause
exit /b 0
:failure
if not "%DSH_THEME_NO_PAUSE%"=="1" pause
exit /b 1
