# Rules Engine with Algolia Sync Module

This directory contains the Rules Engine and its Algolia synchronization module. The architecture follows a clear separation:

- **Rules Engine (SQL)**: Single source of truth
- **Algolia**: Mirror/read replica for fast search

## Directory Structure

```
rules-engine/
│
├── db/                    # Database migrations and schemas
├── src/                   # Main Rules Engine source code
│   └── index.js          # Entry point
├── sync/                  # Algolia Sync Module
│   ├── algoliaSync.js    # Main sync script
│   ├── algoliaConfig.json # Algolia configuration reference
│   └── README.md         # Sync module documentation
├── config/                # Configuration files
│   ├── dbConfig.json     # SQL connection (gitignored)
│   └── dbConfig.example.json # Template for SQL config
└── package.json          # Package configuration with scripts
```

## Setup

### 1. Configure Database Connection

Copy the example configuration and fill in your SQL Server credentials:

```bash
cd rules-engine/config
cp dbConfig.example.json dbConfig.json
# Edit dbConfig.json with your actual credentials
```

### 2. Environment Variables

Set these variables in your environment (Vercel, .env, etc.):

```env
ALGOLIA_APP_ID=XXXXXXX
ALGOLIA_API_KEY=XXXXXXXX
ALGOLIA_INDEX_NAME=rules_engine
```

### 3. Install Dependencies

Dependencies are installed at the root project level. The following are required:
- `algoliasearch` - Algolia client library
- `mssql` - Microsoft SQL Server client
- `dotenv` - Environment variable management

## Usage

### Running the Sync Module

From the project root or from `rules-engine/` directory:

```bash
# From project root
cd rules-engine
node sync/algoliaSync.js

# Or using npm script
npm run sync
```

### What the Sync Does

1. Connects to your SQL Server database
2. Fetches records from `Rules_Item` table
3. Transforms data to Algolia format
4. Syncs records to Algolia index
5. Reports success/failure

## Data Flow

```
SQL Database (Rules_Item)
         ↓
   [Fetch Rules]
         ↓
   [Transform Data]
         ↓
   Algolia Index
```

## Fields Synced

The following fields are synced from `Rules_Item` to Algolia:

| SQL Field | Algolia Field | Description |
|-----------|---------------|-------------|
| RuleID | objectID | Unique identifier |
| ProductKeyword | keyword | Product keyword |
| RuleType | type | Type of rule |
| ActionDetails | details | Action details (JSON) |
| ConfidenceScore | confidence | Confidence score |
| Priority | priority | Rule priority |
| ApprovedBy | approvedBy | Approver name |
| UpdatedAt | updatedAt | Last update timestamp |

## Scheduling Options

### Manual Execution
Run the sync script manually when rules are updated:
```bash
node sync/algoliaSync.js
```

### Cron Job (Linux/Mac)
```bash
# Run every 2 hours
0 */2 * * * cd /path/to/qiq-chat/rules-engine && node sync/algoliaSync.js
```

### Task Scheduler (Windows)
Create a scheduled task to run the sync script periodically.

### Automated After Updates
Future enhancement: trigger sync automatically after rule approval.

## Future Enhancements

- **Incremental Sync**: Add `WHERE UpdatedAt > LastSync` to sync only changes
- **Separate Indexes**: Use different indexes for different rule types
- **Real-time Updates**: Auto-trigger after rule approval
- **Sync Logging**: Add database table to track sync history
- **Error Handling**: Enhanced error recovery and notifications

## Architecture Benefits

✅ **Single Source of Truth**: SQL database remains authoritative
✅ **Fast Search**: Algolia provides instant search capabilities
✅ **Separation of Concerns**: Sync module is independent
✅ **Scalable**: Easy to extend and enhance
✅ **Maintainable**: Clear separation between main code and sync logic

## Troubleshooting

### Connection Errors
- Verify `dbConfig.json` has correct SQL Server credentials
- Check network connectivity to SQL Server
- Ensure SQL Server accepts connections from your IP

### Environment Variable Issues
- Verify all Algolia environment variables are set
- Check `.env` file in project root (if used)
- Ensure variables are available in your runtime environment

### Sync Failures
- Check SQL table `Rules_Item` exists and has data
- Verify Algolia index exists or has permissions for creation
- Review error messages in console output

## Support

For issues or questions:
1. Check the sync module README: `sync/README.md`
2. Review environment variables configuration
3. Verify database connection settings
4. Check Algolia dashboard for index status
