#!/usr/bin/env node
// Discover product tables and candidate list columns in SQL Server
import sql from 'mssql';
import fs from 'fs';
import path from 'path';

const cfgPath = path.join(process.cwd(), 'config', 'dbConfig.json');
if (!fs.existsSync(cfgPath)){
	console.error(`Missing DB config at ${cfgPath}`);
	process.exit(2);
}
const config = JSON.parse(fs.readFileSync(cfgPath,'utf8'));
if (process.env.SQL_SERVER) config.server = process.env.SQL_SERVER;
if (process.env.SQL_DB) config.database = process.env.SQL_DB;
if (process.env.SQL_USER) config.user = process.env.SQL_USER;
if (process.env.SQL_PASSWORD) config.password = process.env.SQL_PASSWORD;

async function main(){
	const pool = await sql.connect(config);
	const tablesQ = await pool.request().query(`
		SELECT TABLE_SCHEMA, TABLE_NAME
		FROM INFORMATION_SCHEMA.TABLES
		WHERE TABLE_TYPE='BASE TABLE'
			AND (TABLE_NAME LIKE '%Product%' OR TABLE_NAME LIKE '%Item%' OR TABLE_NAME LIKE '%Inventory%')
		ORDER BY TABLE_SCHEMA, TABLE_NAME
	`);

	const candidates = [];
	for (const t of tablesQ.recordset){
		const cols = await pool.request().query(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='${t.TABLE_SCHEMA}' AND TABLE_NAME='${t.TABLE_NAME}'`);
		const hasPn = cols.recordset.some(c=> /PartNo|PartNumber|ManufacturerPartNo|SKU/i.test(c.COLUMN_NAME));
		const hasDesc = cols.recordset.some(c=> /Description|Name|Title/i.test(c.COLUMN_NAME));
		const listCols = cols.recordset.filter(c=> /ListID|PriceListID|List|SourceListID|CustomNumber01/i.test(c.COLUMN_NAME)).map(c=>c.COLUMN_NAME);
		if (hasPn && hasDesc){ candidates.push({ table: `${t.TABLE_SCHEMA}.${t.TABLE_NAME}`, listColumns: listCols }); }
	}
	console.log(JSON.stringify({ ok:true, candidates }, null, 2));
	await pool.close();
}

main().catch(e=>{ console.error('discover failed', e); process.exit(1); });

