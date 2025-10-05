@echo off
REM Enrichment Engine Installation Script
REM For Windows

echo ==================================
echo Enrichment Engine Installation
echo ==================================
echo.

REM Check Node.js version
echo Checking Node.js version...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo X Node.js is not installed!
    echo Please install Node.js version 18 or higher from https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo + Node.js version: %NODE_VERSION%
echo.

REM Install dependencies
echo Installing dependencies...
call npm install

if %errorlevel% neq 0 (
    echo X Failed to install dependencies
    pause
    exit /b 1
)

echo + Dependencies installed
echo.

REM Create logs directory
echo Creating logs directory...
if not exist logs mkdir logs
echo + Logs directory created
echo.

REM Check for .env file
if not exist "..\\.env" (
    echo ! Warning: .env file not found in root directory
    echo Please create a .env file with your API keys:
    echo   - OPENAI_API_KEY or GOOGLE_API_KEY
    echo   - GOOGLE_CX_ID ^(optional, for images^)
    echo   - ALGOLIA credentials ^(optional, for search^)
    echo.
)

REM Check database config
if not exist "config\\dbConfig.json" (
    echo ! Warning: Database configuration not found
    echo Please edit config\\dbConfig.json with your SQL Server credentials
    echo.
)

echo ==================================
echo Installation Complete!
echo ==================================
echo.
echo Next steps:
echo 1. Configure your database in config\dbConfig.json
echo 2. Add API keys to ..\.env file
echo 3. Run: npm start
echo.
echo For help, see README.md
echo.
pause
