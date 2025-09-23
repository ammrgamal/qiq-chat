// Parse BOQ files (XLSX/CSV/TSV) sent as base64 or inline rows
// Input:
// { filename?: string, content?: string (base64), rows?: string[][] }
// Output:
// { items: Array<{ pn:string, qty:number, description?:string, price?:number }>, notes?: string[] }

import Joi from 'joi';
import * as XLSX from 'xlsx';

const schema = Joi.object({
  filename: Joi.string().optional(),
  content: Joi.string().base64().optional(),
  rows: Joi.array().items(Joi.array().items(Joi.alternatives(Joi.string(), Joi.number()).allow(null))).optional()
}).or('content','rows');

function fromRows(rows){
  const out = [];
  const notes = [];
  if (!Array.isArray(rows) || rows.length === 0) return { items: [], notes: ['BOQ: no rows'] };
  const header = rows[0].map(x => String(x||'').toLowerCase());
  const col = { pn:-1, qty:-1, desc:-1, price:-1 };
  header.forEach((h,i)=>{
    if (col.pn<0 && /(pn|mpn|sku|part|رقم|كود|موديل)/i.test(h)) col.pn=i;
    if (col.qty<0 && /(qty|quantity|عدد|كمية)/i.test(h)) col.qty=i;
    if (col.price<0 && /(price|unit|cost|سعر)/i.test(h)) col.price=i;
    if (col.desc<0 && /(desc|name|وصف|البند|item)/i.test(h)) col.desc=i;
  });
  const probe = rows.slice(1,4);
  function likelyPn(v){ const s=String(v||''); return /[a-z]{1,3}?\d|\d+[a-z]/i.test(s) && /[a-z0-9]/i.test(s) && s.length>=3; }
  function likelyQty(v){ const n=Number(String(v||'').replace(/[^\d.]/g,'')); return Number.isFinite(n)&&n>0&&Math.floor(n)===n; }
  function likelyPrice(v){ const s=String(v||''); return /(usd|sar|egp|aed|eur|\$)/i.test(s) || (Number(String(s).replace(/[^\d.]/g,''))>0 && s.includes('.')); }
  if (col.pn<0 || col.qty<0){
    for (let i=0;i<(rows[1]?.length||0);i++){
      const vals = probe.map(r=>r[i]);
      if (col.pn<0 && vals.filter(likelyPn).length>=2) col.pn=i;
      if (col.qty<0 && vals.filter(likelyQty).length>=2) col.qty=i;
    }
  }
  if (col.price<0){
    for (let i=0;i<(rows[1]?.length||0);i++){
      const vals = probe.map(r=>r[i]);
      if (vals.filter(likelyPrice).length>=1){ col.price=i; break; }
    }
  }
  if (col.desc<0){ for (let i=0;i<(rows[1]?.length||0);i++){ if(i!==col.pn && i!==col.qty){ col.desc=i; break; } } }
  if (col.pn<0 || col.qty<0) notes.push('لم نتمكن من تحديد PN/QTY بدقة — سيتم الافتراض (أول عمود PN والثاني QTY).');
  if (col.pn<0) col.pn=0; if (col.qty<0) col.qty=1;
  for (let i=1;i<rows.length;i++){
    const r = rows[i]; if (!r) continue;
    const pn   = r[col.pn] ?? '';
    const qty  = r[col.qty] ?? 1;
    const desc = col.desc>=0 ? r[col.desc] : '';
    const priceRaw = col.price>=0 ? r[col.price] : '';
    const price = priceRaw ? Number(String(priceRaw).replace(/[^\d.]/g,'')) : undefined;
    if (!pn && !desc) continue;
    const q = Number(String(qty).replace(/[^\d.]/g,'')) || 1;
    out.push({ pn: String(pn||'').toString(), qty: q, description: desc? String(desc) : undefined, price });
  }
  return { items: out, notes };
}

export default async function handler(req, res){
  if (req.method !== 'POST') {
    res.setHeader('Allow','POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try{
    const { value, error } = schema.validate(req.body || {}, { abortEarly:false, allowUnknown:true });
    if (error) return res.status(400).json({ error: 'Invalid payload', details: error.details });

    // Parse input
    if (value.rows) {
      const { items, notes } = fromRows(value.rows);
      return res.status(200).json({ items, notes });
    }

    // If base64 content is provided, detect XLSX/CSV
    const filename = value.filename || '';
    const buf = Buffer.from(value.content, 'base64');
    // Attempt to read as XLSX first
    try{
      const wb = XLSX.read(buf, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
      const { items, notes } = fromRows(aoa);
      return res.status(200).json({ items, notes });
    }catch{
      // Fallback: treat as text CSV/TSV
      const txt = buf.toString('utf8');
      const rows = txt.split(/\r?\n/).map(r=> r.split(/[;\t,]/).map(c=> String(c||'').trim().replace(/^"|"$/g,'')) ).filter(r=> r.some(c=>c && c.length));
      const { items, notes } = fromRows(rows);
      return res.status(200).json({ items, notes, warning: 'parsed as text' });
    }
  }catch(e){
    console.error('boq-parse error', e);
    return res.status(500).json({ error: 'Server error' });
  }
}
