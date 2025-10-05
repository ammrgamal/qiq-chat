# Algolia Sync Module

This module mirrors the SQL-based Rules Engine into an Algolia index.

## How It Works
1. Connects to the same SQL database as the Rules Engine.
2. Reads approved rules from `Rules_Item`.
3. Pushes or updates the corresponding Algolia records.

## Run Command
```bash
node sync/algoliaSync.js
```

## Environment Variables

- `ALGOLIA_APP_ID`
- `ALGOLIA_API_KEY`
- `ALGOLIA_INDEX_NAME`
- SQL credentials (from `../config/dbConfig.json`)

## Suggested Schedule

Run this script:
- manually (when rules are updated)
- or automatically via a CRON job every few hours.

## Future Enhancements

| Enhancement | Purpose |
|------------|---------|
| 🔹 Add `WHERE UpdatedAt > LastSync` | Incremental sync instead of Full Sync |
| 🔹 Index CategoryRules in another Index | Better separation between rule types |
| 🔹 Auto-call after Auto-Approval | Real-time update without CRON |
| 🔹 Add Logging Table for Sync | Track sync time and details |

## Configuration Files

- `algoliaConfig.json` - Algolia connection settings (reference only, uses env vars)
- `../config/dbConfig.json` - SQL database connection settings

## Notes

- The sync module is designed to be independent and can be extended later
- It uses the same SQL database as the main Rules Engine
- Algolia serves as a mirror/read replica for fast search
- The Rules Engine code remains the single source of truth
