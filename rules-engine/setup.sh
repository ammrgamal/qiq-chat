#!/bin/bash

# setup.sh - Quick setup script for Rules Engine AI Enrichment
# This script helps configure the environment for product enrichment

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  QuickITQuote Rules Engine - Setup Wizard                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if running from rules-engine directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: Please run this script from the rules-engine directory"
  echo "   cd rules-engine && ./setup.sh"
  exit 1
fi

# Step 1: Install dependencies
echo "📦 Step 1: Installing dependencies..."
if npm install; then
  echo "✅ Dependencies installed successfully"
else
  echo "❌ Failed to install dependencies"
  exit 1
fi
echo ""

# Step 2: Create logs directory
echo "📁 Step 2: Creating logs directory..."
mkdir -p logs
echo "✅ Logs directory created"
echo ""

# Step 3: Check database configuration
echo "🗄️  Step 3: Database configuration..."
if [ -f "config/dbConfig.json" ]; then
  echo "✅ Database config found: config/dbConfig.json"
else
  echo "⚠️  Database config not found"
  if [ -f "config/dbConfig.example.json" ]; then
    echo "   Copy example config: cp config/dbConfig.example.json config/dbConfig.json"
    echo "   Then edit config/dbConfig.json with your credentials"
  fi
fi
echo ""

# Step 4: Check environment variables
echo "🔑 Step 4: Environment variables..."
if [ -f "../.env" ]; then
  echo "✅ .env file found in root directory"
  
  # Check for required keys
  if grep -q "OPENAI_API_KEY" ../.env; then
    echo "   ✓ OPENAI_API_KEY is set"
  else
    echo "   ⚠ OPENAI_API_KEY is missing (required for enrichment)"
  fi
  
  if grep -q "ALGOLIA_APP_ID" ../.env && grep -q "ALGOLIA_API_KEY" ../.env; then
    echo "   ✓ Algolia credentials are set"
  else
    echo "   ⚠ Algolia credentials are missing (required for sync)"
  fi
  
  if grep -q "GOOGLE_API_KEY" ../.env && grep -q "GOOGLE_CX_ID" ../.env; then
    echo "   ✓ Google Custom Search is configured (optional)"
  else
    echo "   ℹ Google Custom Search not configured (optional for images)"
  fi
else
  echo "⚠️  .env file not found in root directory"
  echo "   Copy example: cp .env.enrichment.example ../.env"
  echo "   Then edit ../.env with your API keys"
fi
echo ""

# Step 5: Database schema
echo "🗃️  Step 5: Database schema..."
if [ -f "db/add-enrichment-fields.sql" ]; then
  echo "✅ Migration script found: db/add-enrichment-fields.sql"
  echo "   Run this SQL script to add required fields to Products table"
  echo "   sqlcmd -S localhost -d QuoteWerksDB -i db/add-enrichment-fields.sql"
fi
echo ""

# Summary
echo "═══════════════════════════════════════════════════════════"
echo "📋 Setup Summary"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo ""
echo "1. Configure database:"
echo "   • Edit config/dbConfig.json"
echo ""
echo "2. Configure API keys:"
echo "   • Edit ../.env with your OpenAI and Algolia keys"
echo ""
echo "3. Run database migration:"
echo "   • Execute db/add-enrichment-fields.sql on your SQL Server"
echo ""
echo "4. Test enrichment:"
echo "   • npm run enrich (process 20 products)"
echo ""
echo "5. Sync to Algolia:"
echo "   • npm run sync"
echo ""
echo "📚 Documentation:"
echo "   • ENRICHMENT_README.md - Complete guide"
echo "   • WORKFLOW.md - Architecture diagram"
echo ""
echo "✨ Setup script completed!"
