# Quick Reference - Algolia Sync Module

## 🚀 Common Commands

### Run Sync
```bash
# From rules-engine directory
node sync/algoliaSync.js

# Or using npm script
npm run sync

# From project root
cd rules-engine && node sync/algoliaSync.js
```

### Check Syntax
```bash
node --check sync/algoliaSync.js
```

## 📝 Required Environment Variables

```env
ALGOLIA_APP_ID=your_app_id
ALGOLIA_API_KEY=your_admin_api_key
ALGOLIA_INDEX_NAME=rules_engine
```

## 🗂️ Configuration Files

### dbConfig.json (SQL Connection)
```json
{
  "user": "username",
  "password": "password",
  "server": "server.database.windows.net",
  "database": "database_name",
  "options": {
    "encrypt": true,
    "trustServerCertificate": false
  }
}
```

### Expected SQL Table Structure
```sql
CREATE TABLE Rules_Item (
    RuleID INT PRIMARY KEY,
    ProductKeyword NVARCHAR(255),
    RuleType NVARCHAR(100),
    ActionDetails NVARCHAR(MAX),  -- JSON string
    ConfidenceScore DECIMAL(5,2),
    Priority INT,
    ApprovedBy NVARCHAR(100),
    UpdatedAt DATETIME
);
```

## 🔍 Verification Steps

1. **Check Config Files Exist**
   ```bash
   ls -la config/dbConfig.json
   ls -la sync/algoliaSync.js
   ```

2. **Verify Environment Variables**
   ```bash
   node -e "console.log(process.env.ALGOLIA_APP_ID)"
   ```

3. **Test Database Connection**
   ```bash
   # Create a test script if needed
   node -e "import('mssql').then(sql => sql.connect(require('./config/dbConfig.json')))"
   ```

4. **Check Algolia Index**
   - Login to Algolia Dashboard
   - Navigate to your index
   - Verify records are present

## 🐛 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Module not found | `npm install` from project root |
| Login failed | Check `dbConfig.json` credentials |
| Env vars undefined | Set in Vercel/`.env` file |
| Table doesn't exist | Create `Rules_Item` table in SQL |
| JSON parse error | Verify `ActionDetails` is valid JSON |

## 📊 Expected Output

### Success
```
🔄 Starting Algolia Sync...
✅ Synced 42 rules to Algolia
```

### Failure
```
🔄 Starting Algolia Sync...
❌ Sync failed: [Error details]
```

## 🔄 Sync Frequency Recommendations

- **Development**: Manual (on demand)
- **Staging**: Every 1-2 hours
- **Production**: Every 30 minutes or after updates

## 📁 File Locations

```
rules-engine/
├── config/dbConfig.json          ← SQL credentials
├── sync/algoliaSync.js           ← Main sync script
├── sync/README.md                ← Detailed docs
├── README.md                     ← Overview
└── SETUP_GUIDE.md                ← Setup instructions
```

## ⚡ One-Line Setup

```bash
cd rules-engine/config && cp dbConfig.example.json dbConfig.json && nano dbConfig.json
```

## 🔐 Security Checklist

- [ ] `dbConfig.json` is gitignored
- [ ] Never commit real credentials
- [ ] Use environment variables for Algolia keys
- [ ] Restrict database user permissions
- [ ] Use SSL/TLS for database connections

## 📞 Get Help

1. Read `SETUP_GUIDE.md` for detailed instructions
2. Check `sync/README.md` for sync-specific info
3. Review error messages in console
4. Verify all prerequisites are met
