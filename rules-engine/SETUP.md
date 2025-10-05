# Rules Engine - Setup Guide

This guide will help you set up and run the Rules Engine module step by step.

## 📋 Prerequisites Checklist

Before starting, ensure you have:

- [ ] Node.js version 18 or higher installed
- [ ] SQL Server instance accessible
- [ ] At least one AI API key (OpenAI or Google Gemini)
- [ ] Access to create/modify database tables

## 🔧 Step-by-Step Setup

### Step 1: Install Dependencies

```bash
# Navigate to rules-engine directory
cd qiq-chat/rules-engine

# Install npm packages
npm install
```

Expected output:
```
added 50 packages in 5s
```

### Step 2: Configure Database

#### 2.1 Edit Database Configuration

Open `config/dbConfig.json` and update with your SQL Server credentials:

```json
{
  "user": "your_sql_username",
  "password": "your_sql_password",
  "server": "localhost",
  "database": "QuoteWerksDB",
  "options": {
    "encrypt": false,
    "trustServerCertificate": true
  }
}
```

**Common Configurations:**

- **Local SQL Server Express**: 
  ```json
  "server": "localhost\\SQLEXPRESS"
  ```

- **Remote SQL Server**:
  ```json
  "server": "192.168.1.100"
  ```

- **Azure SQL**:
  ```json
  {
    "server": "yourserver.database.windows.net",
    "options": {
      "encrypt": true,
      "trustServerCertificate": false
    }
  }
  ```

#### 2.2 Create Database Tables

Run the SQL schema script in your SQL Server:

**Option A: Using SQL Server Management Studio (SSMS)**
1. Open SSMS and connect to your server
2. Select `QuoteWerksDB` database (or create it if it doesn't exist)
3. Open `rules-engine/db/schema.sql`
4. Execute the script (F5)

**Option B: Using sqlcmd**
```bash
sqlcmd -S localhost -d QuoteWerksDB -U your_username -P your_password -i db/schema.sql
```

**Option C: Using Azure Data Studio**
1. Connect to your SQL Server
2. Open `db/schema.sql`
3. Click "Run" button

Expected output:
```
Tables created: AI_Log, Rules_Item, Rules_Category
Sample data inserted for testing
```

### Step 3: Configure API Keys

#### 3.1 Create .env File in Root Directory

Navigate to the **root qiq-chat directory** (not in rules-engine) and create/edit `.env`:

```bash
cd ..  # Go back to qiq-chat root
nano .env  # or use your preferred editor
```

#### 3.2 Add API Keys

Add at least ONE of these configurations:

**Option A: Using OpenAI (Recommended for accuracy)**
```bash
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini
```

**Option B: Using Google Gemini (Recommended for cost)**
```bash
GOOGLE_API_KEY=xxxxxxxxxxxxxxxxxxxx
GEMINI_MODEL=gemini-1.5-flash
```

**Option C: Using Both (Best redundancy)**
```bash
# OpenAI (primary)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini

# Gemini (fallback)
GOOGLE_API_KEY=xxxxxxxxxxxxxxxxxxxx
GEMINI_MODEL=gemini-1.5-flash
```

#### 3.3 Get API Keys

**OpenAI:**
1. Visit https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy and save the key (starts with `sk-proj-`)

**Google Gemini:**
1. Visit https://aistudio.google.com/app/apikey
2. Sign in with Google account
3. Click "Create API Key"
4. Copy the key

### Step 4: Verify Configuration

Test that everything is configured correctly:

```bash
cd rules-engine

# Check Node.js version
node --version
# Should show v18.0.0 or higher

# Check dependencies are installed
ls node_modules | head
# Should show installed packages

# Check .env file exists in parent directory
cat ../.env | grep -E 'OPENAI_API_KEY|GOOGLE_API_KEY'
# Should show your API keys (partially masked)
```

### Step 5: Test Database Connection

Create a quick test script:

```bash
node -e "
import sql from 'mssql';
import { readFileSync } from 'fs';

const config = JSON.parse(readFileSync('./config/dbConfig.json', 'utf8'));

sql.connect(config)
  .then(pool => {
    console.log('✓ Database connection successful!');
    return pool.close();
  })
  .catch(err => {
    console.error('✗ Database connection failed:', err.message);
    process.exit(1);
  });
"
```

Expected output:
```
✓ Database connection successful!
```

### Step 6: Run First Test

Run the Rules Engine with sample data:

```bash
npm start
```

You should see:
```
🚀 QuickITQuote Rules Engine
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Processing 20 Products
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Progress |████████████████████████████████████████████████| 100%

📊 Processing Summary
────────────────────────────────────────────────────────
Total Products:        20
Successful:            20 (100%)
...
```

## 🎉 Success!

If you see the processing summary, your Rules Engine is working correctly!

## 🔍 Verify Results in Database

Check that data was written to the database:

```sql
-- Check AI processing logs
SELECT TOP 10 * FROM dbo.AI_Log ORDER BY ProcessDate DESC;

-- Check product rules created
SELECT TOP 10 * FROM dbo.Rules_Item ORDER BY CreatedDate DESC;

-- Check categories
SELECT * FROM dbo.Rules_Category WHERE IsActive = 1;
```

## 🐛 Troubleshooting

### Error: "Cannot connect to database"

**Solutions:**
1. Verify SQL Server is running: `services.msc` (Windows) or `systemctl status mssql-server` (Linux)
2. Check firewall allows connections on port 1433
3. Verify credentials in `config/dbConfig.json`
4. Test connection with SQL Server Management Studio first

### Error: "No AI provider available"

**Solutions:**
1. Check `.env` file exists in root qiq-chat directory (not in rules-engine)
2. Verify API key format is correct (no quotes, no spaces)
3. Test API key with curl:
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

### Error: "ENOENT: no such file or directory"

**Solutions:**
1. Ensure you're in the `rules-engine` directory when running `npm start`
2. Check that all files were created correctly: `ls -la src/`
3. Verify node_modules was installed: `ls node_modules/`

### Warning: "Low confidence classification"

**This is normal!** The AI might have low confidence if:
- Product description is minimal
- Product is unusual or custom
- Using fallback mode (no AI keys)

The system will mark these for manual review.

## 📚 Next Steps

Now that your Rules Engine is running:

1. **Customize Rules**: Edit `src/autoApproval.js` to adjust price limits
2. **Add Categories**: Insert new categories into `Rules_Category` table
3. **Integrate with qiq-chat**: Import the module in your main application
4. **Monitor Performance**: Check `AI_Log` table for processing metrics
5. **Scale Up**: Process real product data from your catalog

## 🆘 Need Help?

- Check the main [README.md](./README.md) for detailed documentation
- Review the code comments in each source file
- Examine sample data in the database after a test run
- Check SQL Server logs for database errors
- Enable debug mode: `NODE_ENV=development npm start`

---

**Setup Complete!** 🎊

The Rules Engine is now ready to classify and process your IT products with AI-powered intelligence.
