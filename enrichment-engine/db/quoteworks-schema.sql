-- ========================================
-- QuoteWerks Custom Fields Schema
-- Product Enrichment Engine
-- ========================================
-- This schema defines custom fields used for AI enrichment
-- in the QuoteWerks database
-- ========================================

-- Note: These fields are expected to exist in the QuoteWerks Products table
-- This script documents the field mapping and can be used to verify field existence

-- ========================================
-- CustomMemo Fields (Large Text)
-- ========================================
-- CustomMemo01: Short Description - Product summary
-- CustomMemo02: Features - Key product features
-- CustomMemo03: Specs Table - Technical specifications (formatted)
-- CustomMemo04: FAQs - Frequently asked questions
-- CustomMemo05: Why Buy / Value - Marketing value proposition
-- CustomMemo06: Prerequisites - Required items or conditions
-- CustomMemo07: Related / Bundles - Recommended related products
-- CustomMemo08: Product Rule Engine - Product-specific logic rules
-- CustomMemo09: Category Rule Engine - Category-level rules
-- CustomMemo10: AI Learning Feedback - Self-learning feedback data

-- ========================================
-- CustomText Fields (Short Text)
-- ========================================
-- CustomText01: Manufacturer - Brand name
-- CustomText02: Category - Product category
-- CustomText03: Tags - Keywords/Tags (comma-separated)
-- CustomText04: SEO Keywords - Search optimization keywords
-- CustomText05: Image URL - Product image URL
-- CustomText06: Datasheet URL - Technical datasheet URL
-- CustomText07: Brand Logo - Brand logo URL
-- CustomText08: Localization Notes - Regional/language notes
-- CustomText09: Scope of Work - Professional services description
-- CustomText10: AI Confidence - AI confidence score (0-100)
-- CustomText11: AIProcessed Flag - "TRUE" if processed by AI
-- CustomText12: AIProcessedAt - Timestamp of AI processing
-- CustomText19: AIProcessed Flag (legacy) - Alternative field
-- CustomText20: Approval Status - Auto/Manual approval status

-- ========================================
-- CustomNumber Fields (Numeric)
-- ========================================
-- CustomNumber01: Popularity - Product popularity rank
-- CustomNumber02: Sales Rank - Sales performance rank
-- CustomNumber03: Confidence Score - AI confidence (0-100)
-- CustomNumber04: Customer Rating - User rating (0-5)
-- CustomNumber05: Feedback Count - Number of feedbacks

-- ========================================
-- Core Product Fields (QuoteWerks Standard)
-- ========================================
-- Description: Primary product description
-- ManufacturerPartNo: Part number (primary key for Algolia)
-- Manufacturer: Brand/manufacturer name
-- UnitPrice: Product price
-- ImageFile: Local image file path

-- ========================================
-- Verification Query
-- ========================================
-- Use this to check if custom fields exist:
/*
SELECT 
    Description,
    ManufacturerPartNo,
    Manufacturer,
    UnitPrice,
    ImageFile,
    CustomMemo01, CustomMemo02, CustomMemo03, CustomMemo04, CustomMemo05,
    CustomMemo06, CustomMemo07, CustomMemo08, CustomMemo09, CustomMemo10,
    CustomText01, CustomText02, CustomText03, CustomText04, CustomText05,
    CustomText06, CustomText07, CustomText08, CustomText09, CustomText10,
    CustomText11, CustomText12, CustomText19, CustomText20,
    CustomNumber01, CustomNumber02, CustomNumber03, CustomNumber04, CustomNumber05
FROM Products
WHERE ManufacturerPartNo IS NOT NULL
ORDER BY ManufacturerPartNo
*/

-- ========================================
-- Enrichment Log Table
-- ========================================
IF OBJECT_ID('dbo.Enrichment_Log', 'U') IS NOT NULL DROP TABLE dbo.Enrichment_Log;
GO

CREATE TABLE dbo.Enrichment_Log (
    LogID INT IDENTITY(1,1) PRIMARY KEY,
    ProcessDate DATETIME NOT NULL DEFAULT GETDATE(),
    ProductID NVARCHAR(200) NULL,              -- ManufacturerPartNo
    ProductName NVARCHAR(500) NULL,             -- Product description
    OperationType NVARCHAR(50) NULL,            -- 'Enrichment', 'ImageFetch', 'AlgoliaSync'
    AIProvider NVARCHAR(50) NULL,               -- 'OpenAI', 'Gemini', 'Google'
    AIConfidence DECIMAL(5,2) NULL,             -- 0-100
    TimeTaken INT NULL,                         -- Milliseconds
    Status NVARCHAR(20) NULL,                   -- 'Success', 'Error', 'Skipped'
    ErrorMessage NVARCHAR(MAX) NULL,
    FieldsUpdated NVARCHAR(MAX) NULL,           -- JSON array of updated fields
    Metadata NVARCHAR(MAX) NULL                 -- Additional JSON metadata
);
GO

CREATE INDEX IX_Enrichment_Log_ProcessDate ON dbo.Enrichment_Log(ProcessDate DESC);
CREATE INDEX IX_Enrichment_Log_ProductID ON dbo.Enrichment_Log(ProductID);
CREATE INDEX IX_Enrichment_Log_Status ON dbo.Enrichment_Log(Status);
CREATE INDEX IX_Enrichment_Log_OperationType ON dbo.Enrichment_Log(OperationType);
GO

-- ========================================
-- Batch Processing Status Table
-- ========================================
IF OBJECT_ID('dbo.Enrichment_Batch', 'U') IS NOT NULL DROP TABLE dbo.Enrichment_Batch;
GO

CREATE TABLE dbo.Enrichment_Batch (
    BatchID INT IDENTITY(1,1) PRIMARY KEY,
    StartTime DATETIME NOT NULL DEFAULT GETDATE(),
    EndTime DATETIME NULL,
    TotalProducts INT NULL,
    ProcessedCount INT NULL,
    SkippedCount INT NULL,
    FailedCount INT NULL,
    SuccessRate DECIMAL(5,2) NULL,              -- Percentage
    AverageTimeMs INT NULL,
    Status NVARCHAR(20) NULL,                   -- 'Running', 'Completed', 'Failed'
    Notes NVARCHAR(MAX) NULL
);
GO

CREATE INDEX IX_Enrichment_Batch_StartTime ON dbo.Enrichment_Batch(StartTime DESC);
CREATE INDEX IX_Enrichment_Batch_Status ON dbo.Enrichment_Batch(Status);
GO

PRINT 'QuoteWerks enrichment schema created successfully!';
PRINT 'Tables created: Enrichment_Log, Enrichment_Batch';
GO
