/* schema-verify.sql
   Idempotent verification & creation of required QuoteWerks enrichment structures.
   Run AFTER taking a full backup. Safe to re-run.
*/

PRINT '--- Checking Rules_Item required columns ---';

IF COL_LENGTH('dbo.Rules_Item','AIVersion') IS NULL ALTER TABLE dbo.Rules_Item ADD AIVersion INT NULL;
IF COL_LENGTH('dbo.Rules_Item','LeadTimeDays') IS NULL ALTER TABLE dbo.Rules_Item ADD LeadTimeDays INT NULL;
IF COL_LENGTH('dbo.Rules_Item','MinPrice') IS NULL ALTER TABLE dbo.Rules_Item ADD MinPrice DECIMAL(18,2) NULL;
IF COL_LENGTH('dbo.Rules_Item','MaxPrice') IS NULL ALTER TABLE dbo.Rules_Item ADD MaxPrice DECIMAL(18,2) NULL;
IF COL_LENGTH('dbo.Rules_Item','Keywords') IS NULL ALTER TABLE dbo.Rules_Item ADD Keywords NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.Rules_Item','AIGenerated') IS NULL ALTER TABLE dbo.Rules_Item ADD AIGenerated BIT NULL CONSTRAINT DF_Rules_Item_AIGenerated DEFAULT(0);
IF COL_LENGTH('dbo.Rules_Item','Confidence') IS NULL ALTER TABLE dbo.Rules_Item ADD Confidence DECIMAL(5,2) NULL;
IF COL_LENGTH('dbo.Rules_Item','Notes') IS NULL ALTER TABLE dbo.Rules_Item ADD Notes NVARCHAR(MAX) NULL;

PRINT '--- Creating/Updating EnrichedItems table ---';
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='EnrichedItems')
BEGIN
  CREATE TABLE dbo.EnrichedItems (
    ItemID NVARCHAR(100) NOT NULL PRIMARY KEY,
    PartNumber NVARCHAR(100) NULL,
    Manufacturer NVARCHAR(200) NULL,
    RawJson NVARCHAR(MAX) NULL,
    EnrichedJson NVARCHAR(MAX) NULL,
    AIVersion NVARCHAR(50) NULL,
    EnrichHash NVARCHAR(64) NULL,
    UpdatedAt DATETIME2 NOT NULL DEFAULT (SYSUTCDATETIME())
  );
  CREATE INDEX IX_EnrichedItems_PartNumber ON dbo.EnrichedItems(PartNumber);
  CREATE INDEX IX_EnrichedItems_EnrichHash ON dbo.EnrichedItems(EnrichHash);
END;

PRINT '--- Creating/Updating EnrichLogs table ---';
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='EnrichLogs')
BEGIN
  CREATE TABLE dbo.EnrichLogs (
    LogID INT IDENTITY(1,1) PRIMARY KEY,
    ItemID NVARCHAR(100) NULL,
    Status NVARCHAR(40) NULL,
    AIVersion NVARCHAR(50) NULL,
    DurationMs INT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT (SYSUTCDATETIME()),
    Error NVARCHAR(4000) NULL
  );
  CREATE INDEX IX_EnrichLogs_ItemID ON dbo.EnrichLogs(ItemID);
END;

PRINT '--- Creating Indexes on Rules_Item (if missing) ---';
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Rules_Item_Part_Manu' AND object_id=OBJECT_ID('dbo.Rules_Item'))
  CREATE NONCLUSTERED INDEX IX_Rules_Item_Part_Manu ON dbo.Rules_Item(PartNumber, Manufacturer);

/* Optional UNIQUE index (enable only if PartNumber unique)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Rules_Item_PartNumber' AND object_id=OBJECT_ID('dbo.Rules_Item'))
BEGIN
  -- Validate uniqueness first
  IF NOT EXISTS (
    SELECT PartNumber FROM dbo.Rules_Item GROUP BY PartNumber HAVING COUNT(*)>1
  )
    CREATE UNIQUE NONCLUSTERED INDEX IX_Rules_Item_PartNumber ON dbo.Rules_Item(PartNumber);
END;
*/

PRINT '--- Done schema verification ---';