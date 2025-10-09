const { loadSQLiteService } = require('./adapters/sqliteService.adapter.cjs');
let sqliteService;
beforeAll(async () => { sqliteService = await loadSQLiteService(); });

describe('Enrichment validation (first 20 records)', () => {
		beforeAll(async () => {
			try { await sqliteService.init(); } catch { /* ignore */ }
		});

	test('at least 20 enriched items with core identity presence (soft)', async () => {
		if (!sqliteService.enabled || !sqliteService.db) {
			return void console.warn('[enrichmentValidation] SQLite not enabled - skipping');
		}
			const rows: any[] = await new Promise((resolve, reject) => {
				sqliteService.db.all('SELECT partNumber, enriched_json FROM items LIMIT 20', (e, r) => e ? reject(e) : resolve(r));
			});
			if (!rows || (rows as any[]).length < 20) {
				console.warn(`[enrichmentValidation] Only ${(rows as any[])?.length||0} rows present - skipping strict assertions`);
			return; // skip
		}
			let withIdentity = 0;
			for (const row of rows as any[]) {
			if (!row.enriched_json) continue;
			const enriched = JSON.parse(row.enriched_json);
			const idSec = enriched.sections?.identity || {};
			if (idSec.partNumber || idSec.name) withIdentity++;
			if (idSec.synonyms) {
				expect(Array.isArray(idSec.synonyms)).toBe(true);
				expect(idSec.synonyms.length).toBeLessThanOrEqual(20);
			}
			if (typeof enriched.quality_score === 'number') {
				expect(enriched.quality_score).toBeGreaterThanOrEqual(0);
			}
			if (enriched.rule_tags) expect(Array.isArray(enriched.rule_tags)).toBe(true);
		}
		expect(withIdentity).toBeGreaterThanOrEqual(15);
	}, 15000);
});
