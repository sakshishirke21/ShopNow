@echo off
echo.
echo ========================================
echo    ShopNow E-commerce Setup
echo ========================================
echo.
echo Checking for Node.js...

node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed or not in PATH
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

echo ✓ Node.js found
echo.
echo Installing locked backend dependencies...
cd backend
call npm ci

if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo ✓ Dependencies installed successfully
echo.
echo ========================================
echo Setup complete! Next steps:
echo ========================================
echo.
echo 1. Run the backend server:
echo    cd backend
echo    npm start
echo.
echo 2. Copy backend\.env.example to backend\.env and configure MongoDB.
echo.
echo 3. Open the storefront in your browser:
echo    http://localhost:5000/frontend/user.html
echo.
echo The API will be available at:
echo http://localhost:5000/api
echo.
pause
