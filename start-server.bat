@echo off
echo.
echo ========================================
echo   Starting ShopNow API Server
echo ========================================
echo.

cd backend

echo Checking Node.js...
node --version

echo.
echo Starting server on port 5000...
echo.
echo Once you see "ShopNow API listening on 5000",
echo open: http://localhost:5000/frontend/user.html
echo or:   http://localhost:5000/admin/admin.html
echo.
echo Press CTRL+C to stop the server
echo ========================================
echo.

npm start
