# Enrichment Engine - Setup Guide

Complete step-by-step setup guide for the Product Enrichment Engine.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Database Setup](#database-setup)
4. [API Configuration](#api-configuration)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

- **Node.js**: Version 18 or higher
- **SQL Server**: 2016 or higher (with QuoteWerks database)
- **Operating System**: Windows, Linux, or macOS
- **Memory**: Minimum 2GB RAM
- **Disk Space**: 500MB for dependencies and logs

### Required Services

At least ONE of the following AI providers:

- **OpenAI**: API key from https://platform.openai.com/api-keys
- **Google Gemini**: API key from https://aistudio.google.com/app/apikey

### Optional Services

- **Google Custom Search**: For image fetching
  - API key: https://console.cloud.google.com/
  - Custom Search Engine ID: https://programmablesearchengine.google.com/
  
- **Algolia**: For search index synchronization
  - App ID and Admin API Key: https://www.algolia.com/

---

## Installation

### Step 1: Navigate to Directory

```bash
cd qiq-chat/enrichment-engine
```

### Step 2: Run Installation Script

**On Windows:**
```cmd
install.bat
```

**On Linux/macOS:**
```bash
chmod +x install.sh
./install.sh
```

**Manual Installation:**
```bash
npm install
mkdir logs
```

### Step 3: Verify Installation

```bash
node --version
# Should show v18.0.0 or higher

npm list
# Should show all dependencies installed
```

---

## Database Setup

### Step 1: Configure Connection

1. Copy the example configuration:
   ```bash
   cp config/dbConfig.example.json config/dbConfig.json
   ```

2. Edit `config/dbConfig.json` with your credentials:
   ```json
   {
     "user": "your_sql_username",
     "password": "your_sql_password",
     "server": "your_server_address",
     "database": "QuoteWerksDB",
     "options": {
       "encrypt": false,
       "trustServerCertificate": true
     }
   }
   ```

### Step 2: Create Required Tables

Connect to your SQL Server and run the schema script:

```sql
-- Option 1: Run from SQL Server Management Studio
-- Open: db/quoteworks-schema.sql
-- Execute the script

-- Option 2: Run from command line
sqlcmd -S localhost -U sa -P YourPassword -i db/quoteworks-schema.sql
```

This creates:
- `Enrichment_Log` table
- `Enrichment_Batch` table
- All necessary indexes

### Step 3: Verify QuoteWerks Fields

Ensure your QuoteWerks Products table has the required custom fields:

```sql
SELECT TOP 1
    CustomMemo01, CustomMemo02, CustomMemo03, CustomMemo04, CustomMemo05,
    CustomMemo06, CustomMemo07, CustomMemo08, CustomMemo09, CustomMemo10,
    CustomText01, CustomText02, CustomText03, CustomText04, CustomText05,
    CustomText06, CustomText07, CustomText08, CustomText09, CustomText10,
    CustomText11, CustomText12,
    CustomNumber01, CustomNumber02, CustomNumber03, CustomNumber04, CustomNumber05
FROM Products
```

If these fields don't exist, you may need to add them to your QuoteWerks database schema.

---

## API Configuration

### Step 1: Create Environment File

In the **root qiq-chat directory** (not in enrichment-engine), create or edit `.env`:

```bash
cd ..
nano .env  # or use your preferred editor
```

### Step 2: Add API Keys

Add at least ONE AI provider:

```bash
# OpenAI Configuration (Recommended)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini

# OR Google Gemini Configuration (Cost-effective alternative)
GOOGLE_API_KEY=xxxxxxxxxxxxxxxxxxxx
GEMINI_MODEL=gemini-1.5-flash

# Optional: Google Custom Search (for images)
GOOGLE_CX_ID=xxxxxxxxxxxxxxxxxxxx

# Optional: Algolia (for search index)
ALGOLIA_APP_ID=xxxxxxxxxxxxxxxxxxxx
ALGOLIA_ADMIN_API_KEY=xxxxxxxxxxxxxxxxxxxx
ALGOLIA_INDEX_NAME=woocommerce_products
```

### Step 3: Verify Configuration

```bash
cd enrichment-engine
node -e "require('dotenv').config({path:'../.env'}); console.log('OpenAI:', process.env.OPENAI_API_KEY ? 'OK' : 'Missing'); console.log('Gemini:', process.env.GOOGLE_API_KEY ? 'OK' : 'Missing');"
```

---

## Testing

### Step 1: Test Database Connection

Create a test script `test-db.js`:

```javascript
import dbService from './src/dbService.js';

async function test() {
  try {
    await dbService.connect();
    console.log('✓ Database connection successful');
    await dbService.disconnect();
  } catch (error) {
    console.error('✗ Database connection failed:', error.message);
  }
}

test();
```

Run:
```bash
node test-db.js
```

### Step 2: Run Small Test Batch

Process just 5 products for testing:

```bash
node src/index.js 5
```

Expected output:
```
🚀 AI-Powered Product Enrichment System
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Starting enrichment batch (5 products)...
Fetching 5 products for enrichment...
Retrieved 5 products for enrichment

Progress |████████████████████████████████████████████████| 100% | 5/5 Products

📊 Processing Summary
────────────────────────────────────────────────────────
Total Products:        5
✓ Successfully Processed: 5 (100%)
...
```

### Step 3: Verify Results

Check the database:

```sql
-- View enriched products
SELECT TOP 5
    ManufacturerPartNo,
    CustomMemo01 as ShortDescription,
    CustomText02 as Category,
    CustomText11 as AIProcessed,
    CustomNumber03 as Confidence
FROM Products
WHERE CustomText11 = 'TRUE'

-- View enrichment logs
SELECT TOP 10 * FROM Enrichment_Log ORDER BY ProcessDate DESC

-- View batch statistics
SELECT * FROM Enrichment_Batch ORDER BY StartTime DESC
```

### Step 4: Test Algolia Sync

If Algolia is configured:

```bash
node src/index.js --sync
```

Verify in Algolia dashboard that products were synced.

---

## Troubleshooting

### Database Connection Errors

**Error**: `Failed to connect to SQL Server`

**Solutions**:
1. Verify SQL Server is running:
   ```bash
   # Windows
   services.msc  # Look for SQL Server service
   
   # Linux
   systemctl status mssql-server
   ```

2. Check firewall allows port 1433:
   ```bash
   telnet localhost 1433
   ```

3. Verify credentials in `config/dbConfig.json`

4. Test with SQL Server Management Studio first

5. Check SQL Server authentication mode (should allow SQL Server auth)

### API Errors

**Error**: `OpenAI API error: 401 Unauthorized`

**Solutions**:
1. Verify API key starts with `sk-proj-` (newer keys) or `sk-` (older keys)
2. Check API key is in parent `.env` file, not in enrichment-engine directory
3. Ensure no extra spaces or quotes around the key
4. Verify billing is set up at https://platform.openai.com/account/billing
5. Test API key directly:
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

**Error**: `Gemini API error: 403 Forbidden`

**Solutions**:
1. Enable Gemini API at https://aistudio.google.com/app/apikey
2. Check API quota limits
3. Verify the API key is correct
4. Try regenerating the API key

### No Products Found

**Error**: `No products found for enrichment`

**Solutions**:
1. Check Products table has data:
   ```sql
   SELECT COUNT(*) FROM Products WHERE ManufacturerPartNo IS NOT NULL
   ```

2. Check if products already processed:
   ```sql
   SELECT COUNT(*) FROM Products WHERE CustomText11 = 'TRUE'
   ```

3. Reset flags to reprocess:
   ```sql
   UPDATE Products SET CustomText11 = NULL WHERE ManufacturerPartNo = 'SPECIFIC_PART'
   ```

4. Verify the SQL query in `dbService.js` matches your table structure

### Image Fetching Issues

**Error**: `Google Custom Search API not configured`

**Solutions**:
1. This is optional - enrichment will continue without images
2. To enable images:
   - Get API key: https://console.cloud.google.com/
   - Create custom search engine: https://programmablesearchengine.google.com/
   - Add both to `.env` file

**Note**: Google Custom Search free tier has 100 searches/day limit

### Algolia Sync Issues

**Error**: `Algolia not configured`

**Solutions**:
1. This is optional - enrichment saves to database regardless
2. To enable Algolia:
   - Get credentials from https://www.algolia.com/
   - Add to `.env` file:
     ```
     ALGOLIA_APP_ID=YOUR_APP_ID
     ALGOLIA_ADMIN_API_KEY=YOUR_ADMIN_KEY
     ```

3. Configure index:
   ```bash
   node src/index.js --configure-algolia
   ```

### Performance Issues

**Issue**: Enrichment is slow

**Solutions**:
1. Check your internet connection
2. Verify AI provider response times (OpenAI can be slower than Gemini)
3. Reduce batch size:
   ```bash
   node src/index.js 10  # Process 10 instead of 20
   ```
4. Monitor API rate limits
5. Check database query performance

**Issue**: High API costs

**Solutions**:
1. Use Gemini instead of OpenAI (more cost-effective)
2. Process smaller batches
3. Use caching (already implemented)
4. Skip already processed products (automatic)
5. Use fallback mode for testing (set both API keys to empty)

### Memory Issues

**Issue**: Out of memory errors

**Solutions**:
1. Reduce batch size
2. Increase Node.js memory:
   ```bash
   node --max-old-space-size=4096 src/index.js
   ```
3. Process during off-peak hours
4. Clear logs directory periodically

---

## Advanced Configuration

### Custom Batch Sizes

```bash
# Process 10 products
node src/index.js 10

# Process 50 products
node src/index.js 50
```

### Scheduled Enrichment

Set up a cron job (Linux/macOS):

```bash
crontab -e

# Add line to run daily at 2 AM:
0 2 * * * cd /path/to/qiq-chat/enrichment-engine && /usr/bin/node src/index.js 20 >> /var/log/enrichment.log 2>&1
```

Windows Task Scheduler:
1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (daily at 2 AM)
4. Action: Start a program
5. Program: `node.exe`
6. Arguments: `src/index.js 20`
7. Start in: `C:\path\to\enrichment-engine`

### Environment-Specific Configuration

Development:
```bash
NODE_ENV=development npm start
```

Production:
```bash
NODE_ENV=production npm start
```

### Logging Configuration

To change log verbosity, edit `src/logger.js`:

```javascript
debug(message, data) {
  // Change this condition to always log:
  if (process.env.LOG_LEVEL === 'debug') {
    console.log(chalk.gray('⋯'), message);
    this.writeToFile('DEBUG', message, data);
  }
}
```

---

## Security Best Practices

1. **Never commit** `.env` file or `config/dbConfig.json` to version control
2. Use **read-only** database credentials where possible
3. Store API keys in **secure vault** in production
4. Regularly **rotate** API keys
5. Monitor API usage for **anomalies**
6. Use **HTTPS** for all API calls (automatic)
7. Limit **network access** to SQL Server
8. Enable **SQL Server audit logging**
9. Use **Algolia secured API keys** on frontend
10. Regularly **review logs** for security events

---

## Monitoring & Maintenance

### Daily Checks

```bash
# View today's batch results
node src/index.js --stats

# Check log files
tail -f logs/enrichment-$(date +%Y-%m-%d).log
```

### Weekly Maintenance

1. Review failed enrichments:
   ```sql
   SELECT * FROM Enrichment_Log WHERE Status = 'Error' AND ProcessDate > DATEADD(day, -7, GETDATE())
   ```

2. Check database size:
   ```sql
   EXEC sp_spaceused 'Enrichment_Log'
   ```

3. Archive old logs (older than 30 days):
   ```sql
   DELETE FROM Enrichment_Log WHERE ProcessDate < DATEADD(day, -30, GETDATE())
   ```

### Monthly Tasks

1. Review API costs and usage
2. Optimize batch sizes based on performance
3. Update AI models if new versions available
4. Check for enrichment engine updates
5. Review and update product rules
6. Analyze enrichment quality metrics

---

## Getting Help

If you encounter issues not covered here:

1. Check the main [README.md](README.md)
2. Review [CHANGELOG.md](CHANGELOG.md) for known issues
3. Enable debug logging: `NODE_ENV=development npm start`
4. Check logs in `logs/` directory
5. Review database logs in `Enrichment_Log` table
6. Contact the development team with:
   - Node.js version: `node --version`
   - Error logs
   - Steps to reproduce
   - Sample data (sanitized)

---

## Next Steps

After successful setup:

1. ✅ Run initial test batch (5-10 products)
2. ✅ Review and validate enriched content
3. ✅ Configure Algolia sync (if needed)
4. ✅ Set up scheduled enrichment
5. ✅ Monitor logs and statistics
6. ✅ Gradually increase batch sizes
7. ✅ Integrate with main qiq-chat application

---

**Version**: 1.0.0  
**Last Updated**: 2024  
**Support**: QuickITQuote Team
