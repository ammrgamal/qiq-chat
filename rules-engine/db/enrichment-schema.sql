-- ========================================
-- QuickITQuote Product Enrichment Schema Extension
-- ========================================
-- This schema extends the Rules Engine database with tables for
-- AI-powered product enrichment including descriptions, specs,
-- images, and intelligent recommendations.
--
-- New Tables:
-- 1. Product_Enrichment: Stores AI-generated enriched product data
-- ========================================

-- Drop existing table if it exists (for clean reinstall)
IF OBJECT_ID('dbo.Product_Enrichment', 'U') IS NOT NULL DROP TABLE dbo.Product_Enrichment;
GO

-- ========================================
-- Table: Product_Enrichment
-- Purpose: Stores AI-enriched product data including descriptions,
--          specifications, images, and recommendations
-- ========================================
CREATE TABLE dbo.Product_Enrichment (
    EnrichmentID INT IDENTITY(1,1) PRIMARY KEY,
    ProductID NVARCHAR(200) NOT NULL,           -- Links to Products.ID or PartNumber
    PartNumber NVARCHAR(200) NULL,              -- Duplicate for quick lookup
    
    -- Enhanced Descriptions
    AIShortDescription NVARCHAR(500) NULL,      -- Marketing-ready short description (150-200 chars)
    AILongDescription NVARCHAR(MAX) NULL,       -- Comprehensive description with HTML styling
    
    -- Technical Specifications
    AISpecsTable NVARCHAR(MAX) NULL,            -- JSON object {field: value}
    AIFeatures NVARCHAR(MAX) NULL,              -- JSON array of key features
    
    -- Professional Services & Requirements
    AIPrerequisites NVARCHAR(MAX) NULL,         -- JSON array of prerequisites
    AIServicesScope NVARCHAR(MAX) NULL,         -- Professional services description
    AIFAQ NVARCHAR(MAX) NULL,                   -- JSON array [{question, answer}]
    
    -- Product Intelligence
    AIUpsells NVARCHAR(MAX) NULL,               -- JSON array of upsell product IDs/names
    AIBundles NVARCHAR(MAX) NULL,               -- JSON array of bundle suggestions
    AIValueStatement NVARCHAR(1000) NULL,       -- Customer value proposition
    AIProductRules NVARCHAR(MAX) NULL,          -- JSON array of product-specific rules
    AICategoryRules NVARCHAR(MAX) NULL,         -- JSON array of category-level rules
    
    -- Enhanced Images
    AIImageURL NVARCHAR(1000) NULL,             -- Google Custom Search product image URL
    AIImageSource NVARCHAR(1000) NULL,          -- Image source attribution
    
    -- AI Processing Metadata
    AIProcessed BIT NOT NULL DEFAULT 0,         -- Enrichment completion flag
    AIProcessedDate DATETIME NULL,              -- Timestamp of last enrichment
    AIConfidence DECIMAL(5, 2) NULL,            -- Overall confidence score (0-100)
    AIProvider NVARCHAR(50) NULL,               -- OpenAI, Gemini, etc.
    AIModel NVARCHAR(100) NULL,                 -- Model used (gpt-4, gemini-1.5-flash, etc.)
    
    -- Approval & Quality Control
    RequiresReview BIT NOT NULL DEFAULT 0,      -- Manual review required flag
    ReviewedBy NVARCHAR(100) NULL,              -- Reviewer username
    ReviewedDate DATETIME NULL,                 -- Review timestamp
    ApprovalStatus NVARCHAR(20) NULL,           -- Pending, Approved, Rejected
    
    -- Audit Fields
    CreatedDate DATETIME NOT NULL DEFAULT GETDATE(),
    ModifiedDate DATETIME NOT NULL DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    
    -- Logging Reference
    LogID INT NULL,                             -- Reference to AI_Log.LogID
    
    CONSTRAINT UQ_Product_Enrichment_ProductID UNIQUE (ProductID)
);
GO

-- Indexes for performance
CREATE INDEX IX_Product_Enrichment_PartNumber ON dbo.Product_Enrichment(PartNumber);
CREATE INDEX IX_Product_Enrichment_AIProcessed ON dbo.Product_Enrichment(AIProcessed);
CREATE INDEX IX_Product_Enrichment_RequiresReview ON dbo.Product_Enrichment(RequiresReview);
CREATE INDEX IX_Product_Enrichment_ApprovalStatus ON dbo.Product_Enrichment(ApprovalStatus);
CREATE INDEX IX_Product_Enrichment_AIConfidence ON dbo.Product_Enrichment(AIConfidence);
CREATE INDEX IX_Product_Enrichment_AIProcessedDate ON dbo.Product_Enrichment(AIProcessedDate DESC);
GO

-- ========================================
-- Sample Data for Testing
-- ========================================

-- Insert sample enriched data
INSERT INTO dbo.Product_Enrichment 
(ProductID, PartNumber, AIShortDescription, AILongDescription, AISpecsTable, AIFeatures, 
 AIImageURL, AIProcessed, AIProcessedDate, AIConfidence, AIProvider, AIModel, 
 RequiresReview, ApprovalStatus, IsActive)
VALUES 
(
    'PROD-001', 
    'WS-C2960-24TT-L',
    'Cisco Catalyst 2960 24-Port Managed Switch - Enterprise-grade Layer 2 switching with enhanced security and QoS capabilities.',
    '<span style="color:#0055A4">Overview:</span> The Cisco Catalyst 2960-24TT-L delivers intelligent Layer 2 switching with 24 10/100 ports and 2 dual-purpose uplink ports.<br><br><span style="color:#0055A4">Key Features:</span><br>• 24 Fast Ethernet ports with PoE capability<br>• Advanced security with 802.1X authentication<br>• Quality of Service (QoS) for voice and video<br>• Energy-efficient with Cisco EnergyWise<br><br><span style="color:#0055A4">Ideal For:</span> Small to medium businesses requiring reliable, secure network infrastructure.',
    '{"Ports": "24 x 10/100", "Uplinks": "2 x dual-purpose", "Throughput": "13.6 Gbps", "Power": "50W", "Dimensions": "17.5 x 10.9 x 1.73 inches", "Weight": "8.4 lbs"}',
    '["24 Fast Ethernet ports", "Layer 2 switching", "802.1X security", "QoS support", "Energy efficient", "Fanless design"]',
    'https://example.com/images/cisco-catalyst-2960.jpg',
    1,
    GETDATE(),
    95.5,
    'OpenAI',
    'gpt-4o-mini',
    0,
    'Approved',
    1
);
GO

PRINT 'Product Enrichment schema created successfully!';
PRINT 'Tables created: Product_Enrichment';
PRINT 'Sample enrichment data inserted for testing';
GO
