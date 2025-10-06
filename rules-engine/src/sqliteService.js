// sqliteService.js - Optional lightweight SQLite layer for enrichment (development / local fallback)
import fs from 'fs';
import path from 'path';
import logger from './logger.js';

let sqlite3;
try { sqlite3 = await import('sqlite3'); } catch { sqlite3 = null; }

class SQLiteService {
  constructor(){
    this.enabled = false;
    this.db = null;
    this.file = process.env.ENRICH_SQLITE_PATH || path.join(process.cwd(), 'rules-engine', '.enrich.db');
  }

  async init(){
    if (!sqlite3){
      logger.warn('[sqlite] sqlite3 package not installed; skipping SQLite layer. Run: npm install sqlite3');
      return false;
    }
    try {
      const { Database } = sqlite3.default || sqlite3;
      await fs.promises.mkdir(path.dirname(this.file), { recursive:true }).catch(()=>{});
      this.db = await new Promise((resolve,reject)=>{
        const db = new Database(this.file, (err)=> err?reject(err):resolve(db));
      });
      this.enabled = true;
      await this._migrate();
      logger.info(`[sqlite] Ready at ${this.file}`);
      return true;
    } catch (e){
      logger.error('[sqlite] init failed', e);
      return false;
    }
  }

  _run(sql, params=[]){
    return new Promise((resolve,reject)=>{
      this.db.run(sql, params, function(err){ if (err) reject(err); else resolve(this); });
    });
  }
  _all(sql, params=[]){
    return new Promise((resolve,reject)=>{
      this.db.all(sql, params, (err,rows)=> err?reject(err):resolve(rows));
    });
  }
  _get(sql, params=[]){
    return new Promise((resolve,reject)=>{
      this.db.get(sql, params, (err,row)=> err?reject(err):resolve(row));
    });
  }

  async _migrate(){
    await this._run(`CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      partNumber TEXT,
      manufacturer TEXT,
      raw_json TEXT,
      enriched_json TEXT,
      ai_version TEXT,
      enrich_hash TEXT,
      updated_at TEXT
    )`);
    await this._run(`CREATE TABLE IF NOT EXISTS enrich_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT,
      status TEXT,
      ai_version TEXT,
      duration_ms INTEGER,
      created_at TEXT,
      error TEXT
    )`);
    await this._run('CREATE INDEX IF NOT EXISTS idx_items_hash ON items(enrich_hash)');
  }

  async upsertItem({ id, partNumber, manufacturer, raw, enriched, aiVersion, hash }){
    const now = new Date().toISOString();
    await this._run(`INSERT INTO items (id, partNumber, manufacturer, raw_json, enriched_json, ai_version, enrich_hash, updated_at)
      VALUES (?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET partNumber=excluded.partNumber, manufacturer=excluded.manufacturer, raw_json=excluded.raw_json,
        enriched_json=excluded.enriched_json, ai_version=excluded.ai_version, enrich_hash=excluded.enrich_hash, updated_at=excluded.updated_at`,
      [id, partNumber, manufacturer, raw?JSON.stringify(raw):null, enriched?JSON.stringify(enriched):null, aiVersion, hash, now]);
  }

  async getItem(id){
    const row = await this._get('SELECT * FROM items WHERE id=?', [id]);
    if (!row) return null;
    return { ...row, raw: row.raw_json?JSON.parse(row.raw_json):null, enriched: row.enriched_json?JSON.parse(row.enriched_json):null };
  }

  async findByHash(hash){
    const row = await this._get('SELECT * FROM items WHERE enrich_hash=?', [hash]);
    if (!row) return null;
    return { ...row, raw: row.raw_json?JSON.parse(row.raw_json):null, enriched: row.enriched_json?JSON.parse(row.enriched_json):null };
  }

  async log({ itemId, status, aiVersion, durationMs, error }){
    await this._run('INSERT INTO enrich_logs (item_id, status, ai_version, duration_ms, created_at, error) VALUES (?,?,?,?,?,?)', [itemId, status, aiVersion, durationMs||0, new Date().toISOString(), error||null]);
  }

  async recentLogs(limit=50){
    return this._all('SELECT * FROM enrich_logs ORDER BY id DESC LIMIT ?', [limit]);
  }
}

const sqliteService = new SQLiteService();
export default sqliteService;