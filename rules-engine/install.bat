@echo off
REM Rules Engine Installation Script for Windows
REM This script helps set up the Rules Engine module

setlocal enabledelayedexpansion

echo ================================================================
echo          Rules Engine Installation ^& Setup Script
echo               QuickITQuote (qiq-chat)
echo ================================================================
echo.

REM Check Node.js version
echo [1/5] Checking Node.js version...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] Node.js is not installed
    echo Please install Node.js 18 or higher from https://nodejs.org/
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [OK] Node.js !NODE_VERSION! detected
echo.

REM Install dependencies
echo [2/5] Installing npm dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [X] Failed to install dependencies
    exit /b 1
)
echo [OK] Dependencies installed successfully
echo.

REM Check for .env file
echo [3/5] Checking environment configuration...
if exist "..\\.env" (
    echo [OK] Found .env file in root directory
    
    findstr /C:"OPENAI_API_KEY=" ..\\.env >nul 2>&1
    set HAS_OPENAI=!errorlevel!
    findstr /C:"GOOGLE_API_KEY=" ..\\.env >nul 2>&1
    set HAS_GEMINI=!errorlevel!
    
    if !HAS_OPENAI! equ 0 (
        echo [OK] AI API keys configured
    ) else if !HAS_GEMINI! equ 0 (
        echo [OK] AI API keys configured
    ) else (
        echo [!] No AI API keys found in .env
        echo     Add OPENAI_API_KEY or GOOGLE_API_KEY to use AI features
    )
) else (
    echo [!] No .env file found in root directory
    if exist ".env.example" (
        echo     Creating .env.example as reference...
        copy .env.example ..\\.env.example >nul
        echo     Edit ..\\.env (copy from ..\\.env.example) and add your API keys
    )
)
echo.

REM Check database configuration
echo [4/5] Checking database configuration...
if exist "config\\dbConfig.json" (
    echo [OK] Database configuration file found
    
    findstr /C:"YOUR_SQL_USER" config\\dbConfig.json >nul 2>&1
    if !errorlevel! equ 0 (
        echo [!] Database config still has default values
        echo     Edit config\\dbConfig.json with your SQL Server credentials
    ) else (
        echo [OK] Database configuration customized
    )
) else (
    echo [X] Database configuration file not found
    exit /b 1
)
echo.

REM Check SQL schema
echo [5/5] Checking database schema...
if exist "db\\schema.sql" (
    echo [OK] SQL schema file found
    echo     Run the schema.sql script in your SQL Server to create tables
) else (
    echo [X] SQL schema file not found
    exit /b 1
)
echo.

REM Summary
echo ================================================================
echo                    Installation Summary
echo ================================================================
echo.
echo [OK] Dependencies installed
echo [OK] Configuration files verified
echo.
echo Next Steps:
echo 1. Edit config\\dbConfig.json with your SQL Server credentials
echo 2. Run db\\schema.sql in your SQL Server to create tables
echo 3. Add API keys to ..\\.env (root directory)
echo 4. Test with: npm start
echo.
echo For detailed setup instructions, see: SETUP.md
echo For usage documentation, see: README.md
echo.
echo Installation complete! 🎉
echo.

endlocal
