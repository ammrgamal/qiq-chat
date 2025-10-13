#!/usr/bin/env node
// Batch-fix Kaspersky media filenames in SQL (filenames only, no URLs)
import 'dotenv/config';
import sql from 'mssql';
import fs from 'fs';
import path from 'path';
// no-op: keep dependencies minimal

function parseArgs(){
  const args = {};
  for (const a of process.argv.slice(2)){
    const [k, ...rest] = a.replace(/^--/,'').split('=');
    args[k] = rest.join('=') || true;
  }
  return args;
}

function isFilenameOnly(v){
  if (!v) return false;
  const s = String(v).trim();
  return !/^https?:\/\//i.test(s) && !s.includes('://');
}

function kaspImageFromDescription(desc){
  const d = (desc||'').toLowerCase();
  if (d.includes('optimum')) return 'KasperskyNextEDROptimum.jpg';
  if (d.includes('foundations')) return 'KasperskyNextEDRFoundations.jpg';
  if (d.includes('expert')) return 'KasperskyNextEDRExpert.jpg';
  if (d.includes('core')) return 'KasperskyNextEDRCore.jpg';
  if (d.includes('edr')) return 'KasperskyNextEDROptimum.jpg';
  return 'KasperskyNextEDRFoundations.jpg';
}

function kaspSpecFromDescription(desc){
  const d = (desc||'').toLowerCase();
  if (d.includes('next edr')) return 'kaspersky-next-datasheet-0224-en.pdf';
  if (d.includes('endpoint security')) return 'kaspersky-endpoint-security-for-business-datasheet.pdf';
  return 'kaspersky-next EDR-datasheet.pdf';
}

async function aiGuessVariant(desc){
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try{
    const body = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Classify Kaspersky product to one of: Optimum, Foundations, Expert, Core. Answer only the single word.' },
        { role: 'user', content: `Description: ${desc}` }
      ],
      temperature: 0
    };
    const res = await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',
      headers:{ 'authorization': `Bearer ${key}`, 'content-type':'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) return null;
    const j = await res.json();
    const out = j?.choices?.[0]?.message?.content?.trim();
    if (!out) return null;
    const v = out.toLowerCase();
    if (['optimum','foundations','expert','core'].includes(v)) return v;
    return null;
  }catch{ return null; }
}

async function connectSQL(){
  const config = {
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DB,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    options: { encrypt:false, trustServerCertificate:true }
  };
  const pool = new sql.ConnectionPool(config);
  return pool.connect();
}

async function main(){
  const ARGS = parseArgs();
  const HEAL_AI = String(ARGS.healAi || 'false').toLowerCase() === 'true';
  const LIMIT = parseInt(ARGS.limit || '500',10) || 500;

  const pool = await connectSQL();
  // Detect columns
  const colsRs = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='DocumentItems'");
  const cols = new Set(colsRs.recordset.map(r=> r.COLUMN_NAME));
  const pnCol = cols.has('ManufacturerPartNumber') ? 'ManufacturerPartNumber' : (cols.has('ManufacturerPartNo') ? 'ManufacturerPartNo' : null);
  if (!pnCol){ console.error('No PN column'); process.exit(2); }

  // Select Kaspersky rows needing fix
  const mediaConds = [];
  if (cols.has('PictureFile')) mediaConds.push("(PictureFile IS NULL OR PictureFile = '' OR PictureFile LIKE 'http%')");
  if (cols.has('SpecSheetFile')) mediaConds.push("(SpecSheetFile IS NULL OR SpecSheetFile = '' OR SpecSheetFile LIKE 'http%')");
  if (!mediaConds.length){ console.log('No media columns to fix'); await pool.close(); return; }
  const where = mediaConds.join(' OR ');
  const selectCols = ['ID', `${pnCol} AS PN`, 'Manufacturer', 'Description'];
  if (cols.has('PictureFile')) selectCols.push('PictureFile');
  if (cols.has('SpecSheetFile')) selectCols.push('SpecSheetFile');
  const q = `SELECT TOP (${LIMIT}) ${selectCols.join(', ')} FROM dbo.DocumentItems WHERE Manufacturer = 'Kaspersky' AND (${where}) ORDER BY ID DESC`;
  const rs = await pool.request().query(q);

  let fixed=0, skipped=0; const events=[];
  for (const row of rs.recordset){
    let desiredPic = null, desiredSpec = null;
    // Heuristics first
    desiredPic = kaspImageFromDescription(row.Description||'');
    desiredSpec = kaspSpecFromDescription(row.Description||'');
    // Optional AI refinement
    if (HEAL_AI && process.env.OPENAI_API_KEY){
      if (!desiredPic || !desiredSpec){
        const v = await aiGuessVariant(row.Description||'');
        if (v){
          if (v==='optimum') desiredPic = 'KasperskyNextEDROptimum.jpg';
          if (v==='foundations') desiredPic = 'KasperskyNextEDRFoundations.jpg';
          if (v==='expert') desiredPic = 'KasperskyNextEDRExpert.jpg';
          if (v==='core') desiredPic = 'KasperskyNextEDRCore.jpg';
          // datasheet stays based on family
        }
      }
    }

    const toSet = [];
    const req = pool.request();
    if (cols.has('PictureFile')){
      const pf = row.PictureFile || '';
      if (!pf || !isFilenameOnly(pf)){
        toSet.push('PictureFile=@pf'); req.input('pf', sql.NVarChar(255), desiredPic);
      }
    }
    if (cols.has('SpecSheetFile')){
      const sf = row.SpecSheetFile || '';
      if (!sf || !isFilenameOnly(sf)){
        toSet.push('SpecSheetFile=@sf'); req.input('sf', sql.NVarChar(255), desiredSpec);
      }
    }
    if (!toSet.length){ skipped++; continue; }
    req.input('id', sql.Int, row.ID);
    const uq = `UPDATE dbo.DocumentItems SET ${toSet.join(', ')} WHERE ID=@id`;
    await req.query(uq);
    fixed++;
    events.push(`${row.PN} → PictureFile=${desiredPic||'-'} | SpecSheetFile=${desiredSpec||'-'}`);
  }
  await pool.close();

  const report = { ok:true, processed: rs.recordset.length, fixed, skipped, events };
  console.log(JSON.stringify(report, null, 2));
  try{
    const outPath = path.join(process.cwd(), 'kaspersky-media-fix-report.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`Report written: ${outPath}`);
  }catch{}
}

main().catch(e=>{ console.error('kaspersky-media-fix failed', e); process.exit(1); });
