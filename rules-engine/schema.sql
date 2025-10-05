-- ========================================
-- QuickITQuote Rules Engine Database Schema
-- ========================================
-- This schema defines tables for AI-powered product classification
-- and auto-approval rules management
--
-- Tables:
-- 1. AI_Log: Stores AI processing logs and results
-- 2. Rules_Item: Stores individual product classification rules
-- 3. Rules_Category: Stores product category definitions and rules
-- ========================================

-- Drop existing tables if they exist (for clean reinstall)
IF OBJECT_ID('dbo.AI_Log', 'U') IS NOT NULL DROP TABLE dbo.AI_Log;
IF OBJECT_ID('dbo.Rules_Item', 'U') IS NOT NULL DROP TABLE dbo.Rules_Item;
IF OBJECT_ID('dbo.Rules_Category', 'U') IS NOT NULL DROP TABLE dbo.Rules_Category;
GO

-- ========================================
-- Table: AI_Log
-- Purpose: Stores AI processing logs including input, output, and metadata
-- ========================================
CREATE TABLE dbo.AI_Log (
    LogID INT IDENTITY(1,1) PRIMARY KEY,
    ProcessDate DATETIME NOT NULL DEFAULT GETDATE(),
    InputText NVARCHAR(MAX) NULL,
    OutputText NVARCHAR(MAX) NULL,
    AIProvider NVARCHAR(50) NULL,  -- 'OpenAI', 'Gemini', etc.
    Model NVARCHAR(100) NULL,       -- Model name (e.g., 'gpt-4', 'gemini-1.5-flash')
    TokensUsed INT NULL,
    ProcessingTimeMs INT NULL,      -- Processing time in milliseconds
    Status NVARCHAR(20) NULL,       -- 'Success', 'Error', 'Partial'
    ErrorMessage NVARCHAR(MAX) NULL,
    UserID NVARCHAR(100) NULL,      -- Optional user identifier
    SessionID NVARCHAR(100) NULL,   -- Optional session identifier
    Metadata NVARCHAR(MAX) NULL     -- JSON field for additional metadata
);
GO

CREATE INDEX IX_AI_Log_ProcessDate ON dbo.AI_Log(ProcessDate DESC);
CREATE INDEX IX_AI_Log_Status ON dbo.AI_Log(Status);
CREATE INDEX IX_AI_Log_AIProvider ON dbo.AI_Log(AIProvider);
GO

-- ========================================
-- Table: Rules_Item
-- Purpose: Stores individual product classification rules
-- ========================================
CREATE TABLE dbo.Rules_Item (
    RuleID INT IDENTITY(1,1) PRIMARY KEY,
    ProductName NVARCHAR(500) NOT NULL,
    PartNumber NVARCHAR(200) NULL,
    Manufacturer NVARCHAR(200) NULL,
    Category NVARCHAR(200) NULL,
    SubCategory NVARCHAR(200) NULL,
    Classification NVARCHAR(100) NULL,  -- 'Standard', 'Custom', 'Special Order'
    AutoApprove BIT NOT NULL DEFAULT 0,
    MinPrice DECIMAL(18, 2) NULL,
    MaxPrice DECIMAL(18, 2) NULL,
    LeadTimeDays INT NULL,
    Keywords NVARCHAR(MAX) NULL,        -- Comma-separated keywords
    AIGenerated BIT NOT NULL DEFAULT 0,
    Confidence DECIMAL(5, 2) NULL,      -- AI confidence score (0-100)
    CreatedDate DATETIME NOT NULL DEFAULT GETDATE(),
    ModifiedDate DATETIME NOT NULL DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    Notes NVARCHAR(MAX) NULL
);
GO

CREATE INDEX IX_Rules_Item_PartNumber ON dbo.Rules_Item(PartNumber);
CREATE INDEX IX_Rules_Item_Category ON dbo.Rules_Item(Category);
CREATE INDEX IX_Rules_Item_AutoApprove ON dbo.Rules_Item(AutoApprove);
CREATE INDEX IX_Rules_Item_IsActive ON dbo.Rules_Item(IsActive);
GO

-- ========================================
-- Table: Rules_Category
-- Purpose: Stores product category definitions and approval rules
-- ========================================
CREATE TABLE dbo.Rules_Category (
    CategoryID INT IDENTITY(1,1) PRIMARY KEY,
    CategoryName NVARCHAR(200) NOT NULL UNIQUE,
    ParentCategoryID INT NULL,
    Description NVARCHAR(MAX) NULL,
    AutoApproveLimit DECIMAL(18, 2) NULL,  -- Max price for auto-approval
    RequiresReview BIT NOT NULL DEFAULT 0,
    LeadTimeDays INT NULL,
    VendorPreferences NVARCHAR(MAX) NULL,   -- JSON array of preferred vendors
    Rules NVARCHAR(MAX) NULL,               -- JSON field for complex rules
    AIPrompt NVARCHAR(MAX) NULL,            -- Custom AI prompt for this category
    CreatedDate DATETIME NOT NULL DEFAULT GETDATE(),
    ModifiedDate DATETIME NOT NULL DEFAULT GETDATE(),
    IsActive BIT NOT NULL DEFAULT 1,
    SortOrder INT NULL,
    FOREIGN KEY (ParentCategoryID) REFERENCES dbo.Rules_Category(CategoryID)
);
GO

CREATE INDEX IX_Rules_Category_ParentCategory ON dbo.Rules_Category(ParentCategoryID);
CREATE INDEX IX_Rules_Category_IsActive ON dbo.Rules_Category(IsActive);
CREATE INDEX IX_Rules_Category_SortOrder ON dbo.Rules_Category(SortOrder);
GO

-- ========================================
-- Sample Data for Testing
-- ========================================

-- Insert sample categories
INSERT INTO dbo.Rules_Category (CategoryName, Description, AutoApproveLimit, RequiresReview, LeadTimeDays, IsActive, SortOrder)
VALUES 
    ('Networking', 'Network infrastructure products including switches, routers, and cables', 5000.00, 0, 7, 1, 1),
    ('Servers', 'Server hardware and components', 15000.00, 1, 14, 1, 2),
    ('Storage', 'Storage devices and solutions', 10000.00, 0, 10, 1, 3),
    ('Software', 'Software licenses and subscriptions', 3000.00, 0, 1, 1, 4),
    ('Accessories', 'Cables, adapters, and other accessories', 1000.00, 0, 3, 1, 5);
GO

-- Insert sample rules
INSERT INTO dbo.Rules_Item (ProductName, PartNumber, Manufacturer, Category, SubCategory, Classification, AutoApprove, MinPrice, MaxPrice, LeadTimeDays, Keywords, AIGenerated, Confidence, IsActive)
VALUES 
    ('Cisco Catalyst 2960 Switch', 'WS-C2960-24TT-L', 'Cisco', 'Networking', 'Switches', 'Standard', 1, 500.00, 2000.00, 7, 'cisco,switch,2960,catalyst', 0, 95.00, 1),
    ('Dell PowerEdge R740 Server', 'R740-001', 'Dell', 'Servers', 'Rack Servers', 'Standard', 0, 5000.00, 20000.00, 14, 'dell,server,poweredge,r740', 0, 98.00, 1),
    ('NetApp FAS2750 Storage', 'FAS2750-BASE', 'NetApp', 'Storage', 'NAS', 'Standard', 0, 10000.00, 50000.00, 21, 'netapp,storage,nas,fas', 0, 90.00, 1);
GO

PRINT 'Rules Engine database schema created successfully!';
PRINT 'Tables created: AI_Log, Rules_Item, Rules_Category';
PRINT 'Sample data inserted for testing';
GO
