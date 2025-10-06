// /api/enrichment-summary.js - simple summary for enrichment results (sqlite only for now)
import sqliteService from '../rules-engine/src/sqliteService.js';
import storageAdapter from '../rules-engine/src/storageAdapter.js';
import dbService from '../rules-engine/src/dbService.js';

export default async function handler(req,res){
  try {
    await storageAdapter.init();
    if (storageAdapter.isSQLite()){
      const logs = await sqliteService.recentLogs(100);
      const totals = logs.reduce((acc,l)=>{ acc[l.status]=(acc[l.status]||0)+1; return acc; },{});
      return res.json({ ok:true, mode:'sqlite', totals, recent: logs.slice(0,20) });
    }
    if (storageAdapter.isMSSQL()){
      // Ensure connection
      await dbService.connect();
      // Aggregate totals
      const totalsQ = await dbService.query(`SELECT Status, COUNT(*) as Cnt FROM dbo.EnrichLogs GROUP BY Status`);
      const totals = {};
      for (const r of totalsQ.recordset){ totals[r.Status] = r.Cnt; }
      // Recent logs
      const recentQ = await dbService.query(`SELECT TOP 20 LogID, ItemID, Status, AIVersion, DurationMs, CreatedAt, Error FROM dbo.EnrichLogs ORDER BY LogID DESC`);
      return res.json({ ok:true, mode:'mssql', totals, recent: recentQ.recordset });
    }
    return res.json({ ok:true, mode:'unknown' });
  } catch (e){
    return res.status(500).json({ ok:false, error:e.message });
  }
}
