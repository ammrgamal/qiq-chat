#!/bin/bash

# Enrichment Engine Installation Script
# For Linux/macOS

echo "=================================="
echo "Enrichment Engine Installation"
echo "=================================="
echo ""

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node --version 2>/dev/null)
if [ $? -ne 0 ]; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js version 18 or higher from https://nodejs.org"
    exit 1
fi

echo "✓ Node.js version: $NODE_VERSION"
echo ""

# Install dependencies
echo "Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✓ Dependencies installed"
echo ""

# Create logs directory
echo "Creating logs directory..."
mkdir -p logs
echo "✓ Logs directory created"
echo ""

# Check for .env file
if [ ! -f "../.env" ]; then
    echo "⚠ Warning: .env file not found in root directory"
    echo "Please create a .env file with your API keys:"
    echo "  - OPENAI_API_KEY or GOOGLE_API_KEY"
    echo "  - GOOGLE_CX_ID (optional, for images)"
    echo "  - ALGOLIA credentials (optional, for search)"
    echo ""
fi

# Check database config
if [ ! -f "config/dbConfig.json" ]; then
    echo "⚠ Warning: Database configuration not found"
    echo "Please edit config/dbConfig.json with your SQL Server credentials"
    echo ""
fi

echo "=================================="
echo "Installation Complete!"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Configure your database in config/dbConfig.json"
echo "2. Add API keys to ../.env file"
echo "3. Run: npm start"
echo ""
echo "For help, see README.md"
