-- Migration: Add AIVersion column to Rules_Item if not exists
IF COL_LENGTH('dbo.Rules_Item', 'AIVersion') IS NULL
BEGIN
    ALTER TABLE dbo.Rules_Item ADD AIVersion NVARCHAR(40) NULL;
    PRINT 'Added AIVersion column to Rules_Item';
END
ELSE
BEGIN
    PRINT 'AIVersion column already exists';
END
GO
