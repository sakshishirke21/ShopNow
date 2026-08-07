@echo off
setlocal

echo.
echo ========================================
echo       ShopNow E-commerce Setup
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

echo ========================================
echo    Installing Backend Dependencies
echo ========================================
echo.

if not exist "backend" (
    echo [ERROR] Backend folder not found.
    echo Please run this setup.bat from the ShopNow project root.
    echo.
    pause
    exit /b 1
)

cd /d "%~dp0backend"

echo Installing locked backend dependencies...
call npm ci

if errorlevel 1 (
    echo.
    echo [ERROR] Failed to install backend dependencies.
    echo.
    pause
    exit /b 1
)

echo.
echo [OK] Backend dependencies installed successfully.
echo.

echo ========================================
echo    Environment Configuration
echo ========================================
echo.

if not exist ".env" (
    if exist ".env.example" (
        echo Creating backend .env from .env.example...
        copy /Y ".env.example" ".env" >nul

        if errorlevel 1 (
            echo [ERROR] Could not create .env file.
            pause
            exit /b 1
        )

        echo [OK] backend\.env created.
        echo.
        echo IMPORTANT:
        echo Edit backend\.env and configure your MongoDB,
        echo JWT, Stripe, email and other required settings.
    ) else (
        echo [WARNING] backend\.env.example not found.
        echo Please create backend\.env manually.
    )
) else (
    echo [OK] backend\.env already exists.
    echo Existing environment file was not changed.
)

echo.

cd /d "%~dp0"

echo ========================================
echo          Setup Complete
echo ========================================
echo.
echo Next steps:
echo.
echo 1. Configure your environment:
echo    Edit:
echo    backend\.env
echo.
echo 2. Start MongoDB.
echo.
echo 3. Start the backend server:
echo    cd backend
echo    npm start
echo.
echo 4. Open the ShopNow storefront:
echo    http://localhost:5000/frontend/user.html
echo.
echo 5. Open the Admin Dashboard:
echo    http://localhost:5000/admin/admin.html
echo.
echo 6. API base URL:
echo    http://localhost:5000/api
echo.
echo ========================================
echo        ShopNow Setup Finished
echo ========================================
echo.
pause

endlocal