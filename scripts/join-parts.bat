@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

rem Склейка частей установщика SARO в один exe.
rem Положите этот файл рядом с частями *.part001, *.part002 и запустите двойным кликом.

set "FOUND="
for %%F in (*.part001) do set "FOUND=%%~nF"

if "%FOUND%"=="" (
  echo Не найдено ни одной части *.part001 в этой папке.
  pause
  exit /b 1
)

echo Склеиваю части в файл: %FOUND%
copy /b "%FOUND%.part*" "%FOUND%" >nul

if exist "%FOUND%" (
  echo Готово. Создан файл: %FOUND%
  echo Проверьте контрольную сумму:
  certutil -hashfile "%FOUND%" SHA256
) else (
  echo Ошибка склейки.
)

pause
