# Rules Engine - Algolia Sync Module Setup Guide

## 🎯 Overview

This guide will help you set up and use the Algolia Sync Module for the Rules Engine. The module is designed to keep Algolia as a mirror/replica of your SQL database.

## 📁 What Was Created

```
rules-engine/
├── README.md                      # Main documentation
├── SETUP_GUIDE.md                 # This file
├── package.json                   # npm configuration with scripts
├── config/
│   ├── dbConfig.json             # Your SQL credentials (gitignored)
│   └── dbConfig.example.json    # Template to copy from
├── db/                            # For future database migrations
├── src/
│   └── index.js                  # Rules Engine main entry point
└── sync/
    ├── algoliaSync.js            # Main sync script
    ├── algoliaConfig.json        # Algolia config reference
    └── README.md                 # Sync module documentation
```

## 🚀 Quick Start

### Step 1: Configure Database Connection

1. Navigate to `rules-engine/config/`
2. Copy the example file:
   ```bash
   cp dbConfig.example.json dbConfig.json
   ```
3. Edit `dbConfig.json` with your SQL Server credentials:
   ```json
   {
     "user": "your_username",
     "password": "your_password",
     "server": "your_server.database.windows.net",
     "database": "your_database_name",
     "options": {
       "encrypt": true,
       "trustServerCertificate": false
     }
   }
   ```

### Step 2: Set Environment Variables

In Vercel or your `.env` file at the project root:

```env
ALGOLIA_APP_ID=your_app_id
ALGOLIA_API_KEY=your_admin_api_key
ALGOLIA_INDEX_NAME=rules_engine
```

### Step 3: Verify Database Table

Ensure your SQL database has a `Rules_Item` table with these columns:
- `RuleID` (Primary Key)
- `ProductKeyword`
- `RuleType`
- `ActionDetails` (JSON string)
- `ConfidenceScore`
- `Priority`
- `ApprovedBy`
- `UpdatedAt`

### Step 4: Run the Sync

From the project root:

```bash
cd rules-engine
node sync/algoliaSync.js
```

Or using the npm script:

```bash
cd rules-engine
npm run sync
```

## 🔄 How It Works

1. **Connects to SQL**: Uses credentials from `config/dbConfig.json`
2. **Fetches Rules**: Queries all records from `Rules_Item` table
3. **Transforms Data**: Converts SQL records to Algolia format
4. **Syncs to Algolia**: Updates the Algolia index with all records
5. **Reports Status**: Shows success message with count

## 📊 Data Mapping

| SQL Column | Algolia Field | Notes |
|------------|---------------|-------|
| RuleID | objectID | Algolia's unique identifier |
| ProductKeyword | keyword | Searchable keyword |
| RuleType | type | Type of rule |
| ActionDetails | details | Parsed from JSON string |
| ConfidenceScore | confidence | Numeric score |
| Priority | priority | Rule priority |
| ApprovedBy | approvedBy | Approver username |
| UpdatedAt | updatedAt | Timestamp |

## 🔐 Security Notes

- **Never commit** `dbConfig.json` - it contains sensitive credentials
- The file is already added to `.gitignore`
- Use environment variables for Algolia keys
- Keep your ALGOLIA_API_KEY secret (admin key)

## 📅 Scheduling Options

### Option 1: Manual Execution
Run when you make changes to rules:
```bash
cd rules-engine && node sync/algoliaSync.js
```

### Option 2: Cron Job (Linux/Mac)
Add to crontab:
```bash
# Every 2 hours
0 */2 * * * cd /path/to/qiq-chat/rules-engine && node sync/algoliaSync.js >> /tmp/algolia-sync.log 2>&1
```

### Option 3: Windows Task Scheduler
1. Open Task Scheduler
2. Create New Task
3. Set trigger (e.g., every 2 hours)
4. Action: Start Program
   - Program: `node`
   - Arguments: `sync/algoliaSync.js`
   - Start in: `C:\path\to\qiq-chat\rules-engine`

### Option 4: Vercel Cron Jobs
Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/sync-algolia",
    "schedule": "0 */2 * * *"
  }]
}
```
Then create an API endpoint that calls the sync module.

## 🐛 Troubleshooting

### "Cannot find module 'mssql'"
Solution: Install dependencies from project root
```bash
cd /path/to/qiq-chat
npm install
```

### "Login failed for user"
Solution: Check your `dbConfig.json` credentials
- Verify username and password
- Ensure server address is correct
- Check if firewall allows your IP

### "ALGOLIA_APP_ID is undefined"
Solution: Set environment variables
- In Vercel: Go to Settings > Environment Variables
- Locally: Create `.env` file in project root
- Ensure variables are loaded with `dotenv`

### "Table 'Rules_Item' does not exist"
Solution: Create the table or adjust the table name in `algoliaSync.js`

### JSON Parse Error in ActionDetails
Solution: Ensure `ActionDetails` column contains valid JSON strings

## 🔮 Future Enhancements

1. **Incremental Sync**
   - Track last sync time
   - Only sync records updated since last sync
   - Reduces API calls and improves performance

2. **Multiple Indexes**
   - Separate indexes for different rule types
   - Better organization and search performance

3. **Real-time Sync**
   - Trigger sync automatically after rule approval
   - No need for scheduled jobs

4. **Sync Logging**
   - Database table to track sync history
   - Monitor success/failure rates
   - Audit trail for compliance

5. **Error Recovery**
   - Retry failed syncs
   - Email notifications on failures
   - Graceful degradation

## 📞 Support

For issues or questions:
1. Check the main README: `rules-engine/README.md`
2. Review sync documentation: `sync/README.md`
3. Verify environment variables are set correctly
4. Check console output for specific error messages

## ✅ Verification Checklist

- [ ] `dbConfig.json` created and configured
- [ ] Environment variables set (ALGOLIA_APP_ID, ALGOLIA_API_KEY, ALGOLIA_INDEX_NAME)
- [ ] SQL table `Rules_Item` exists with required columns
- [ ] Dependencies installed (`npm install` from project root)
- [ ] Sync script runs without errors
- [ ] Data appears in Algolia dashboard
- [ ] Search functionality works in your application

## 🎉 Success Indicators

When everything is working correctly, you should see:

```
🔄 Starting Algolia Sync...
✅ Synced 42 rules to Algolia
```

Check your Algolia dashboard to verify:
- Index `rules_engine` exists
- Records are present
- Fields are properly mapped
- Search works as expected
