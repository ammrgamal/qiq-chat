@echo off
REM setup.bat - Quick setup script for Rules Engine AI Enrichment (Windows)
REM This script helps configure the environment for product enrichment

echo ================================================================
echo   QuickITQuote Rules Engine - Setup Wizard (Windows)
echo ================================================================
echo.

REM Check if running from rules-engine directory
if not exist "package.json" (
  echo ERROR: Please run this script from the rules-engine directory
  echo   cd rules-engine
  echo   setup.bat
  exit /b 1
)

REM Step 1: Install dependencies
echo [Step 1] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
  echo ERROR: Failed to install dependencies
  exit /b 1
)
echo SUCCESS: Dependencies installed
echo.

REM Step 2: Create logs directory
echo [Step 2] Creating logs directory...
if not exist "logs" mkdir logs
echo SUCCESS: Logs directory created
echo.

REM Step 3: Check database configuration
echo [Step 3] Database configuration...
if exist "config\dbConfig.json" (
  echo SUCCESS: Database config found: config\dbConfig.json
) else (
  echo WARNING: Database config not found
  if exist "config\dbConfig.example.json" (
    echo   Copy example config: copy config\dbConfig.example.json config\dbConfig.json
    echo   Then edit config\dbConfig.json with your credentials
  )
)
echo.

REM Step 4: Check environment variables
echo [Step 4] Environment variables...
if exist "..\\.env" (
  echo SUCCESS: .env file found in root directory
  
  findstr /C:"OPENAI_API_KEY" "..\\.env" >nul
  if %errorlevel% equ 0 (
    echo   [OK] OPENAI_API_KEY is set
  ) else (
    echo   [!] OPENAI_API_KEY is missing (required for enrichment^)
  )
  
  findstr /C:"ALGOLIA_APP_ID" "..\\.env" >nul && findstr /C:"ALGOLIA_API_KEY" "..\\.env" >nul
  if %errorlevel% equ 0 (
    echo   [OK] Algolia credentials are set
  ) else (
    echo   [!] Algolia credentials are missing (required for sync^)
  )
  
  findstr /C:"GOOGLE_API_KEY" "..\\.env" >nul && findstr /C:"GOOGLE_CX_ID" "..\\.env" >nul
  if %errorlevel% equ 0 (
    echo   [OK] Google Custom Search is configured (optional^)
  ) else (
    echo   [i] Google Custom Search not configured (optional for images^)
  )
) else (
  echo WARNING: .env file not found in root directory
  echo   Copy example: copy .env.enrichment.example ..\\.env
  echo   Then edit ..\\.env with your API keys
)
echo.

REM Step 5: Database schema
echo [Step 5] Database schema...
if exist "db\add-enrichment-fields.sql" (
  echo SUCCESS: Migration script found: db\add-enrichment-fields.sql
  echo   Run this SQL script to add required fields to Products table
  echo   sqlcmd -S localhost -d QuoteWerksDB -i db\add-enrichment-fields.sql
)
echo.

REM Summary
echo ================================================================
echo Setup Summary
echo ================================================================
echo.
echo Next steps:
echo.
echo 1. Configure database:
echo    - Edit config\dbConfig.json
echo.
echo 2. Configure API keys:
echo    - Edit ..\\.env with your OpenAI and Algolia keys
echo.
echo 3. Run database migration:
echo    - Execute db\add-enrichment-fields.sql on your SQL Server
echo.
echo 4. Test enrichment:
echo    - npm run enrich (process 20 products^)
echo.
echo 5. Sync to Algolia:
echo    - npm run sync
echo.
echo Documentation:
echo    - ENRICHMENT_README.md - Complete guide
echo    - WORKFLOW.md - Architecture diagram
echo.
echo Setup script completed!
pause
