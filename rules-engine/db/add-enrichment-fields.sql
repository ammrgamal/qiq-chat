-- ========================================
-- Add AI Enrichment Fields to Products Table
-- ========================================
-- This script adds the necessary fields to the Products table
-- for AI enrichment tracking
-- ========================================

USE QuoteWerksDB;
GO

PRINT 'Adding AI enrichment fields to Products table...';

-- Add AIProcessed field if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Products') AND name = 'AIProcessed')
BEGIN
    ALTER TABLE dbo.Products ADD AIProcessed BIT NULL DEFAULT 0;
    PRINT '✓ Added AIProcessed field';
END
ELSE
BEGIN
    PRINT '○ AIProcessed field already exists';
END

-- Add AIConfidence field if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Products') AND name = 'AIConfidence')
BEGIN
    ALTER TABLE dbo.Products ADD AIConfidence DECIMAL(5,2) NULL;
    PRINT '✓ Added AIConfidence field';
END
ELSE
BEGIN
    PRINT '○ AIConfidence field already exists';
END

-- Add AIProcessedDate field if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Products') AND name = 'AIProcessedDate')
BEGIN
    ALTER TABLE dbo.Products ADD AIProcessedDate DATETIME NULL;
    PRINT '✓ Added AIProcessedDate field';
END
ELSE
BEGIN
    PRINT '○ AIProcessedDate field already exists';
END

GO

-- Create index on AIProcessed for faster queries
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Products_AIProcessed')
BEGIN
    CREATE INDEX IX_Products_AIProcessed ON dbo.Products(AIProcessed);
    PRINT '✓ Created index on AIProcessed';
END
ELSE
BEGIN
    PRINT '○ Index on AIProcessed already exists';
END

GO

PRINT '';
PRINT 'Migration completed successfully!';
PRINT 'Products table is ready for AI enrichment.';
GO
