-- ========================================
-- QuickITQuote Rules Engine - Product Enrichment Schema
-- ========================================
-- This schema extends the Products table with AI enrichment fields
-- as defined in mapping-reference.md
-- ========================================

USE QuoteWerks;
GO

-- ========================================
-- Add Custom Fields to Products Table
-- ========================================

-- Check if columns exist before adding to avoid errors
-- CustomMemo fields (NVARCHAR(MAX)) for long text content

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Products') AND name = 'CustomMemo01')
    ALTER TABLE Products ADD CustomMemo01 NVARCHAR(MAX) NULL;  -- Short description

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Products') AND name = 'CustomMemo02')
    ALTER TABLE Products ADD CustomMemo02 NVARCHAR(MAX) NULL;  -- Long marketing description

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Products') AND name = 'CustomMemo03')
    ALTER TABLE Products ADD CustomMemo03 NVARCHAR(MAX) NULL;  -- Features (bullet list HTML)

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Products') AND name = 'CustomMemo04')
    ALTER TABLE Products ADD CustomMemo04 NVARCHAR(MAX) NULL;  -- Specs table (HTML)

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Products') AND name = 'CustomMemo05')
    ALTER TABLE Products ADD CustomMemo05 NVARCHAR(MAX) NULL;  -- FAQ

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Products') AND name = 'CustomMemo06')
    ALTER TABLE Products ADD CustomMemo06 NVARCHAR(MAX) NULL;  -- Prerequisites

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Products') AND name = 'CustomMemo07')
    ALTER TABLE Products ADD CustomMemo07 NVARCHAR(MAX) NULL;  -- Related items / accessories

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Products') AND name = 'CustomMemo08')
    ALTER TABLE Products ADD CustomMemo08 NVARCHAR(MAX) NULL;  -- Professional services scope

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Products') AND name = 'CustomMemo09')
    ALTER TABLE Products ADD CustomMemo09 NVARCHAR(MAX) NULL;  -- Upsell / bundle recommendations

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Products') AND name = 'CustomMemo10')
    ALTER TABLE Products ADD CustomMemo10 NVARCHAR(MAX) NULL;  -- Marketing "Why buy this" value

-- CustomText fields (NVARCHAR(200)) for short text

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Products') AND name = 'CustomText01')
    ALTER TABLE Products ADD CustomText01 NVARCHAR(200) NULL;  -- Category

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Products') AND name = 'CustomText02')
    ALTER TABLE Products ADD CustomText02 NVARCHAR(200) NULL;  -- Subcategory

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Products') AND name = 'CustomText03')
    ALTER TABLE Products ADD CustomText03 NVARCHAR(200) NULL;  -- Manufacturer

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Products') AND name = 'CustomText04')
    ALTER TABLE Products ADD CustomText04 NVARCHAR(200) NULL;  -- Product type

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Products') AND name = 'CustomText05')
    ALTER TABLE Products ADD CustomText05 NVARCHAR(MAX) NULL;  -- Rules Engine (Product-level) JSON

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Products') AND name = 'CustomText06')
    ALTER TABLE Products ADD CustomText06 NVARCHAR(MAX) NULL;  -- Rules Engine (Category-level) JSON

-- CustomNumber fields (FLOAT) for numeric values

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Products') AND name = 'CustomNumber01')
    ALTER TABLE Products ADD CustomNumber01 FLOAT NULL;  -- AI Confidence (0–100%)

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Products') AND name = 'CustomNumber02')
    ALTER TABLE Products ADD CustomNumber02 FLOAT NULL;  -- AIProcessed flag (0/1)

-- CustomDate fields (DATETIME) for timestamps

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Products') AND name = 'CustomDate01')
    ALTER TABLE Products ADD CustomDate01 DATETIME NULL;  -- AIProcessed Date

-- ImageFile field (if not already exists)

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Products') AND name = 'ImageFile')
    ALTER TABLE Products ADD ImageFile NVARCHAR(500) NULL;  -- Product image URL

GO

-- ========================================
-- Create Indexes for Performance
-- ========================================

-- Index on AIProcessed flag for quick filtering
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('Products') AND name = 'IX_Products_AIProcessed')
    CREATE INDEX IX_Products_AIProcessed ON Products(CustomNumber02);

-- Index on AI Confidence for filtering
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('Products') AND name = 'IX_Products_AIConfidence')
    CREATE INDEX IX_Products_AIConfidence ON Products(CustomNumber01);

-- Index on Category for grouping
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('Products') AND name = 'IX_Products_Category')
    CREATE INDEX IX_Products_Category ON Products(CustomText01);

-- Index on AIProcessed Date for sorting
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('Products') AND name = 'IX_Products_AIProcessedDate')
    CREATE INDEX IX_Products_AIProcessedDate ON Products(CustomDate01 DESC);

GO

-- ========================================
-- Create AI_Log Table (if not exists)
-- ========================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AI_Log')
BEGIN
    CREATE TABLE AI_Log (
        LogID INT IDENTITY(1,1) PRIMARY KEY,
        ProcessDate DATETIME NOT NULL DEFAULT GETDATE(),
        InputText NVARCHAR(MAX) NULL,
        OutputText NVARCHAR(MAX) NULL,
        AIProvider NVARCHAR(50) NULL,     -- 'OpenAI', 'Gemini', 'fallback'
        Model NVARCHAR(100) NULL,          -- Model name used
        TokensUsed INT NULL,
        ProcessingTimeMs INT NULL,         -- Processing duration in milliseconds
        Status NVARCHAR(20) NULL,          -- 'Success', 'Error', 'Partial'
        ErrorMessage NVARCHAR(MAX) NULL,
        UserID NVARCHAR(100) NULL,
        SessionID NVARCHAR(100) NULL,
        Metadata NVARCHAR(MAX) NULL
    );

    CREATE INDEX IX_AI_Log_ProcessDate ON AI_Log(ProcessDate DESC);
    CREATE INDEX IX_AI_Log_Status ON AI_Log(Status);
    CREATE INDEX IX_AI_Log_AIProvider ON AI_Log(AIProvider);
END
GO

-- ========================================
-- Sample Data for Testing (Optional)
-- ========================================

-- Initialize CustomNumber02 to 0 for all products if null
UPDATE Products
SET CustomNumber02 = 0
WHERE CustomNumber02 IS NULL;

GO

PRINT 'Product Enrichment Schema Applied Successfully!';
PRINT '';
PRINT 'Fields Added:';
PRINT '  - CustomMemo01 through CustomMemo10 (Long text fields)';
PRINT '  - CustomText01 through CustomText06 (Short text fields)';
PRINT '  - CustomNumber01 and CustomNumber02 (Numeric fields)';
PRINT '  - CustomDate01 (Date field)';
PRINT '  - ImageFile (if not existing)';
PRINT '';
PRINT 'Indexes Created:';
PRINT '  - IX_Products_AIProcessed';
PRINT '  - IX_Products_AIConfidence';
PRINT '  - IX_Products_Category';
PRINT '  - IX_Products_AIProcessedDate';
PRINT '';
PRINT 'Tables Created:';
PRINT '  - AI_Log (for enrichment logging)';
PRINT '';
PRINT 'Ready to run rules-engine.js for product enrichment!';
GO
