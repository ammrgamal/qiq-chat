// storageAdapter.js - Unified abstraction over different persistence backends
import sqliteService from './sqliteService.js';
import dbService from './dbService.js';
import logger from './logger.js';

class StorageAdapter {
  constructor(){
    this.mode = null; // 'sqlite' | 'mssql'
  }

  async init(){
    // Preference order: MSSQL if env forces, else SQLite if available, else MSSQL fallback
    const force = process.env.ENRICH_STORAGE_MODE; // optional override
    if (force === 'mssql'){ this.mode = 'mssql'; return 'mssql'; }
    if (force === 'sqlite'){ await sqliteService.init(); this.mode = sqliteService.enabled?'sqlite':'mssql'; return this.mode; }
    // Auto-detect: try sqlite first for local dev
    await sqliteService.init();
    if (sqliteService.enabled){ this.mode = 'sqlite'; return 'sqlite'; }
    this.mode = 'mssql';
    return 'mssql';
  }

  isSQLite(){ return this.mode === 'sqlite'; }
  isMSSQL(){ return this.mode === 'mssql'; }

  async getByHash(hash){
    if (this.isSQLite()) return sqliteService.findByHash(hash);
    if (this.isMSSQL()){
      try {
        await this._ensureMSSQLTables();
        const q = await dbService.query(`SELECT TOP 1 * FROM dbo.EnrichedItems WHERE EnrichHash = @hash`, { hash });
        if (!q.recordset.length) return null;
        const row = q.recordset[0];
        return {
          id: row.ItemID,
          partNumber: row.PartNumber,
          manufacturer: row.Manufacturer,
          ai_version: row.AIVersion,
          enrich_hash: row.EnrichHash,
          raw: row.RawJson ? JSON.parse(row.RawJson) : null,
          enriched: row.EnrichedJson ? JSON.parse(row.EnrichedJson) : null,
          updated_at: row.UpdatedAt
        };
      } catch (e){ logger.warn('[storageAdapter] mssql getByHash failed', e); return null; }
    }
    return null;
  }

  async saveItem({ id, partNumber, manufacturer, raw, enriched, aiVersion, hash }){
    if (this.isSQLite()) return sqliteService.upsertItem({ id, partNumber, manufacturer, raw, enriched, aiVersion, hash });
    if (this.isMSSQL()){
      try {
        await this._ensureMSSQLTables();
        const existing = await dbService.query(`SELECT ItemID FROM dbo.EnrichedItems WHERE ItemID=@id`, { id });
        if (existing.recordset.length){
          await dbService.query(`UPDATE dbo.EnrichedItems SET PartNumber=@partNumber, Manufacturer=@manufacturer, RawJson=@raw, EnrichedJson=@enriched, AIVersion=@aiVersion, EnrichHash=@hash, UpdatedAt=GETDATE() WHERE ItemID=@id`, {
            id, partNumber, manufacturer, raw: raw?JSON.stringify(raw):null, enriched: enriched?JSON.stringify(enriched):null, aiVersion, hash
          });
        } else {
          await dbService.query(`INSERT INTO dbo.EnrichedItems (ItemID, PartNumber, Manufacturer, RawJson, EnrichedJson, AIVersion, EnrichHash, UpdatedAt)
            VALUES (@id, @partNumber, @manufacturer, @raw, @enriched, @aiVersion, @hash, GETDATE())`, {
            id, partNumber, manufacturer, raw: raw?JSON.stringify(raw):null, enriched: enriched?JSON.stringify(enriched):null, aiVersion, hash
          });
        }
      } catch (e){ logger.error('[storageAdapter] mssql saveItem failed', e); }
    }
  }

  async log(args){
    if (this.isSQLite()) return sqliteService.log(args);
    if (this.isMSSQL()){
      try {
        await this._ensureMSSQLTables();
        await dbService.query(`INSERT INTO dbo.EnrichLogs (ItemID, Status, AIVersion, DurationMs, CreatedAt, Error)
          VALUES (@itemId, @status, @aiVersion, @durationMs, GETDATE(), @error)`, {
          itemId: args.itemId||null,
          status: args.status||null,
          aiVersion: args.aiVersion||null,
          durationMs: args.durationMs||0,
          error: args.error||null
        });
      } catch (e){ logger.warn('[storageAdapter] mssql log insert failed', e); }
    }
  }

  async _ensureMSSQLTables(){
    if (!this._mssqlChecked){
      try {
        await dbService.connect();
        await dbService.query(`IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='EnrichedItems')
          CREATE TABLE dbo.EnrichedItems (
            ItemID NVARCHAR(100) PRIMARY KEY,
            PartNumber NVARCHAR(100),
            Manufacturer NVARCHAR(200),
            RawJson NVARCHAR(MAX),
            EnrichedJson NVARCHAR(MAX),
            AIVersion NVARCHAR(50),
            EnrichHash NVARCHAR(64) INDEXED NULL,
            UpdatedAt DATETIME2
          );`);
        await dbService.query(`IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='EnrichLogs')
          CREATE TABLE dbo.EnrichLogs (
            LogID INT IDENTITY(1,1) PRIMARY KEY,
            ItemID NVARCHAR(100),
            Status NVARCHAR(40),
            AIVersion NVARCHAR(50),
            DurationMs INT,
            CreatedAt DATETIME2,
            Error NVARCHAR(4000)
          );`);
        this._mssqlChecked = true;
      } catch (e){ logger.warn('[storageAdapter] ensure tables failed', e); }
    }
  }
}

const storageAdapter = new StorageAdapter();
export default storageAdapter;