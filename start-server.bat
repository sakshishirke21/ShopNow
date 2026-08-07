@echo off
setlocal

echo.
echo ========================================
echo       Starting ShopNow API Server
echo ========================================
echo.

echo Checking for Node.js...
node --version >nul 2>&1

if errorlevel 1 (
    echo.
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js from:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js found
node --version
echo.

if not exist "%~dp0backend" (
    echo [ERROR] Backend folder not found.
    echo Please run this file from the ShopNow project.
    echo.
    pause
    exit /b 1
)

cd /d "%~dp0backend"

if not exist "package.json" (
    echo [ERROR] backend\package.json not found.
    echo.
    pause
    exit /b 1
)

if not exist ".env" (
    echo.
    echo [ERROR] backend\.env file was not found.
    echo.
    echo Please run setup.bat first.
    echo Then configure:
    echo    backend\.env
    echo.
    pause
    exit /b 1
)

echo ========================================
echo          ShopNow Server
echo ========================================
echo.
echo Starting server on port 5000...
echo.
echo Storefront:
echo http://localhost:5000/frontend/user.html
echo.
echo Admin Dashboard:
echo http://localhost:5000/admin/admin.html
echo.
echo API:
echo http://localhost:5000/api
echo.
echo Press CTRL+C to stop the server.
echo ========================================
echo.

call npm start

if errorlevel 1 (
    echo.
    echo ========================================
    echo [ERROR] ShopNow server stopped with an error.
    echo ========================================
    echo.
    pause
    exit /b 1
)

endlocal