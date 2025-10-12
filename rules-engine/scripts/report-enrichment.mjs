#!/usr/bin/env node
// Generate a report of products and which fields were enriched
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

// CLI args
const ARGS = Object.fromEntries(process.argv.slice(2).map(a=>{
  const [k,...rest] = a.replace(/^--/,'').split('=');
  return [k, rest.join('=') || true];
}));

const BRAND = (ARGS.brand || 'Kaspersky').toString();
const LIST = (ARGS.list || '12').toString();
const LIMIT = Math.max(1, Number(ARGS.limit || 1000));

function csvEscape(v){
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
  return s;
}

async function main(){
  const pool = await sql.connect(config);
  const table = `dbo.Products_${LIST}_Products`;
  const esc = (t)=> t.replace(/'/g,"''");
  const q = `SELECT TOP (${LIMIT})
    ManufacturerPartNumber, Description,
    CustomMemo01, CustomMemo02, CustomMemo03, CustomMemo04, CustomMemo05,
    CustomText01, CustomText02, CustomText03, CustomText04, CustomText05,
    CustomText06, CustomText07, CustomText08, CustomText09, CustomText10,
    CustomText11, CustomText12, CustomText13
  FROM ${table}
  WHERE Manufacturer LIKE '${esc(BRAND)}%'
    AND CustomText11 = 'TRUE'
  ORDER BY LastModified DESC`;
  const rs = await pool.request().query(q);
  await pool.close();

  const rows = rs.recordset.map(r=>{
    const enrichedFields = [];
    if (r.CustomMemo01) enrichedFields.push('shortDescription');
    if (r.CustomMemo02) enrichedFields.push('features');
    if (r.CustomMemo03) enrichedFields.push('specs');
    if (r.CustomMemo04) enrichedFields.push('faq');
    if (r.CustomMemo05) enrichedFields.push('whyBuy');
    if (r.CustomText01) enrichedFields.push('manufacturer');
    if (r.CustomText02) enrichedFields.push('category');
    if (r.CustomText03) enrichedFields.push('tags');
    if (r.CustomText04) enrichedFields.push('seoKeywords');
    if (r.CustomText05) enrichedFields.push('imageUrl');
    if (r.CustomText06) enrichedFields.push('datasheetUrl');
    if (r.CustomText07) enrichedFields.push('prerequisites');
    if (r.CustomText08) enrichedFields.push('related');
    if (r.CustomText09) enrichedFields.push('productRule/scope');
    if (r.CustomText10) enrichedFields.push('categoryRule');
    if (r.CustomText13) enrichedFields.push('scopeOfWork');
    return {
      partNumber: r.ManufacturerPartNumber,
      name: r.Description,
      enrichedFields: enrichedFields.join(', ')
    };
  });

  const outJson = path.join(process.cwd(), `enrichment-report-${BRAND.toLowerCase()}-list${LIST}.json`);
  const outCsv = path.join(process.cwd(), `enrichment-report-${BRAND.toLowerCase()}-list${LIST}.csv`);
  fs.writeFileSync(outJson, JSON.stringify({ brand: BRAND, list: LIST, count: rows.length, items: rows }, null, 2));

  const header = ['PartNumber','Name','EnrichedFields'];
  const csv = [header.join(',')]
    .concat(rows.map(r=> [csvEscape(r.partNumber), csvEscape(r.name), csvEscape(r.enrichedFields)].join(',')))
    .join('\n');
  fs.writeFileSync(outCsv, csv);
  console.log(`[report] Wrote:\n- ${outJson}\n- ${outCsv}\nCount=${rows.length}`);
}

main().catch(e=>{ console.error('report failed', e); process.exit(1); });
