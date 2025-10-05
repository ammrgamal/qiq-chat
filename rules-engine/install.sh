#!/bin/bash

# Rules Engine Installation Script
# This script helps set up the Rules Engine module

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Rules Engine Installation & Setup Script           ║${NC}"
echo -e "${BLUE}║              QuickITQuote (qiq-chat)                        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check Node.js version
echo -e "${YELLOW}[1/5]${NC} Checking Node.js version..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed${NC}"
    echo "Please install Node.js 18 or higher from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}✗ Node.js version $NODE_VERSION is too old${NC}"
    echo "Please upgrade to Node.js 18 or higher"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v) detected${NC}"

# Install dependencies
echo -e "\n${YELLOW}[2/5]${NC} Installing npm dependencies..."
if npm install; then
    echo -e "${GREEN}✓ Dependencies installed successfully${NC}"
else
    echo -e "${RED}✗ Failed to install dependencies${NC}"
    exit 1
fi

# Check for .env file
echo -e "\n${YELLOW}[3/5]${NC} Checking environment configuration..."
if [ -f "../.env" ]; then
    echo -e "${GREEN}✓ Found .env file in root directory${NC}"
    
    # Check for API keys
    HAS_OPENAI=$(grep -c "OPENAI_API_KEY=" ../.env 2>/dev/null || true)
    HAS_GEMINI=$(grep -c "GOOGLE_API_KEY=" ../.env 2>/dev/null || true)
    
    if [ "$HAS_OPENAI" -gt 0 ] || [ "$HAS_GEMINI" -gt 0 ]; then
        echo -e "${GREEN}✓ AI API keys configured${NC}"
    else
        echo -e "${YELLOW}⚠ No AI API keys found in .env${NC}"
        echo "  Add OPENAI_API_KEY or GOOGLE_API_KEY to use AI features"
    fi
else
    echo -e "${YELLOW}⚠ No .env file found in root directory${NC}"
    echo "  Creating .env.example as reference..."
    if [ -f ".env.example" ]; then
        cp .env.example ../.env.example
        echo -e "${BLUE}  ℹ Edit ../.env (copy from ../.env.example) and add your API keys${NC}"
    fi
fi

# Check database configuration
echo -e "\n${YELLOW}[4/5]${NC} Checking database configuration..."
if [ -f "config/dbConfig.json" ]; then
    echo -e "${GREEN}✓ Database configuration file found${NC}"
    
    # Check if it's still using default values
    if grep -q "YOUR_SQL_USER" config/dbConfig.json 2>/dev/null; then
        echo -e "${YELLOW}⚠ Database config still has default values${NC}"
        echo "  Edit config/dbConfig.json with your SQL Server credentials"
    else
        echo -e "${GREEN}✓ Database configuration customized${NC}"
    fi
else
    echo -e "${RED}✗ Database configuration file not found${NC}"
    exit 1
fi

# Check SQL schema
echo -e "\n${YELLOW}[5/5]${NC} Checking database schema..."
if [ -f "db/schema.sql" ]; then
    echo -e "${GREEN}✓ SQL schema file found${NC}"
    echo -e "${BLUE}  ℹ Run the schema.sql script in your SQL Server to create tables${NC}"
else
    echo -e "${RED}✗ SQL schema file not found${NC}"
    exit 1
fi

# Summary
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    Installation Summary                     ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo -e "${GREEN}✓ Configuration files verified${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Edit config/dbConfig.json with your SQL Server credentials"
echo "2. Run db/schema.sql in your SQL Server to create tables"
echo "3. Add API keys to ../.env (root directory)"
echo "4. Test with: npm start"
echo ""
echo -e "For detailed setup instructions, see: ${BLUE}SETUP.md${NC}"
echo -e "For usage documentation, see: ${BLUE}README.md${NC}"
echo ""
echo -e "${GREEN}Installation complete! 🎉${NC}"
