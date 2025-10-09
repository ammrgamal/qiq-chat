const { loadSQLiteService } = require('./adapters/sqliteService.adapter.cjs');
let sqliteService;
beforeAll(async () => { sqliteService = await loadSQLiteService(); try { await sqliteService.init(); } catch {} });

describe('Enrichment validation (CJS soft)', () => {
  test('first rows soft checks', async () => {
    if (!sqliteService.enabled) return;
    const rows = await new Promise((resolve,reject)=>{ sqliteService.db.all('SELECT partNumber, enriched_json FROM items LIMIT 20', (e,r)=> e?reject(e):resolve(r)); });
    if (!rows || rows.length < 5) return;
    let ok = 0;
    for (const row of rows) {
      if (!row.enriched_json) continue;
      const enriched = JSON.parse(row.enriched_json);
      if (enriched.sections?.identity?.name || enriched.sections?.identity?.partNumber) ok++;
      const syns = enriched.sections?.identity?.synonyms; if (syns) expect(syns.length).toBeLessThanOrEqual(20);
    }
    expect(ok).toBeGreaterThan(0);
  }, 15000);
});
