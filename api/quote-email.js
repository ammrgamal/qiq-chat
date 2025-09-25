// api/quote-email.js
// Generates PDF & CSV from a simple payload and emails notifications with attachments.
// Expected body: { action: 'download'|'send'|'custom', adminNotify: true, client: {...}, project: {...}, items: [...], number, date, currency }
// Returns { ok, pdfBase64, csvBase64 } (pdfBase64 only for download action)

import { sendEmail } from './_lib/email.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FONT_DIRS = [
  path.join(__dirname, '../assets/fonts'),
  path.join(__dirname, '../public/fonts'),
  path.join(__dirname, '../../public/fonts')
];

// ============ Lightweight Arabic shaping helpers (optional deps) ============
let __arShapeFn = null;
function hasArabic(s){ return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(String(s||'')); }
function reverseArabicRuns(str){
  // Reverse only Arabic script runs, leave other segments (numbers/latin) intact
  return String(str||'').replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+/g, seg => seg.split('').reverse().join(''));
}
async function getArabicShaper(){
  if (__arShapeFn) return __arShapeFn;
  let reshape = null;
  try{
    const mod = await import('arabic-persian-reshaper');
    reshape = (mod && (mod.reshape || mod.default?.reshape)) || null;
  }catch{}
  __arShapeFn = (input)=>{
    const s = String(input==null?'':input);
    if (!hasArabic(s)) return s;
    let t = s;
    try{ if (typeof reshape === 'function') t = reshape(t); }catch{}
    // Naive visual ordering for Arabic runs (satisfies most simple cases in PDFKit)
    t = reverseArabicRuns(t);
    return t;
  };
  return __arShapeFn;
}

async function tryAccess(p){ try{ await fs.access(p); return true; }catch{ return false; } }
async function ensureArabicFonts(doc){
  // Look for common Arabic font families inside assets/fonts
  const families = [
    { reg: 'NotoNaskhArabic-Regular.ttf', bold: 'NotoNaskhArabic-Bold.ttf' },
    { reg: 'NotoSansArabic-Regular.ttf', bold: 'NotoSansArabic-Bold.ttf' },
    { reg: 'NotoKufiArabic-Regular.ttf', bold: 'NotoKufiArabic-Bold.ttf' },
    { reg: 'Amiri-Regular.ttf', bold: 'Amiri-Bold.ttf' }
  ];
  for (const dir of FONT_DIRS){
    for (const f of families){
      const regPath = path.join(dir, f.reg);
      const boldPath = path.join(dir, f.bold);
      const hasReg = await tryAccess(regPath);
      const hasBold = await tryAccess(boldPath);
      if (hasReg){
        try{ doc.registerFont('AR_REG', regPath); }catch{}
      }
      if (hasBold){
        try{ doc.registerFont('AR_BOLD', boldPath); }catch{}
      }
      if (hasReg || hasBold){
        return { reg: hasReg ? 'AR_REG' : null, bold: hasBold ? 'AR_BOLD' : null };
      }
    }
  }
  return { reg: null, bold: null };
}

function sanitizeName(s){
  return (s==null?'':String(s))
    .replace(/[\\/:*?"<>|\n\r]+/g,' ') // remove invalid filename chars
    .replace(/\s+/g,' ') // collapse whitespace
    .trim()
    .slice(0, 80); // keep it short
}

function ensureString(v){ return (v==null?'':String(v)); }
function b64(s){ return Buffer.from(s).toString('base64'); }
function escapeCsv(v){ const s = ensureString(v); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; }

function buildCsv(items){
  const header = 'Item,Quantity,Unit Price,Total\n';
  const rows = (items||[]).map(it=>{
    const name = ensureString(it.description || it.name || '-');
    const qty = Number(it.qty||1);
    const unit = Number(it.unit_price||it.unit||it.price||0);
    const total = unit*qty;
    return [escapeCsv(name), qty, unit, total].join(',');
  }).join('\n');
  return header + rows + (rows? '\n' : '');
}

// Build a minimalist PDF as text-based for now (many email providers accept simple base64 PDFs)
// For richer PDFs use client-side pdfmake; here we just deliver a simple fallback server PDF.
async function buildPdfBuffer({ number, date, currency, client, project, items }){
  // Lazy import to avoid hard dependency during build steps
  const { default: PDFDocument } = await import('pdfkit');
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Quotation ${ensureString(number)} - ${ensureString(project?.name||'')}` }});
  const chunks = [];
  return await new Promise(async (resolve, reject)=>{
    doc.on('data', c=>chunks.push(c));
    doc.on('error', reject);
    doc.on('end', ()=> resolve(Buffer.concat(chunks)));

    // Fonts (register Arabic if available)
    const fonts = await ensureArabicFonts(doc);
    const REG = fonts.reg || 'Helvetica';
    const BOLD = fonts.bold || 'Helvetica-Bold';
    const ar = await getArabicShaper();
    const ARS = (s)=> ar(String(s==null?'':s));

    // Header
  doc.fontSize(18).fillColor('#111827').font(BOLD).text(ARS(`QuickITQuote — Quotation ${ensureString(number)}`), { align: 'left' });
  doc.moveDown(0.3).fontSize(11).font(REG).fillColor('#374151').text(ARS(`Date: ${ensureString(date)}    Currency: ${ensureString(currency)}`));

    // Optional product image (first item)
    (async ()=>{
      try{
        const first = (items||[])[0] || {};
        const imgUrl = first.image || first["Image URL"] || first.thumbnail || first.img || '';
        if (imgUrl && typeof fetch === 'function'){
          const resp = await fetch(imgUrl);
          if (resp.ok){ const buf = Buffer.from(await resp.arrayBuffer());
            const x = doc.page.width - doc.page.margins.right - 70;
            const y = 50; // near top
            try{ doc.image(buf, x, y, { fit:[64,64] }); }catch{}
          }
        }
      }catch{}
    })();

    // Client / Project boxes
    doc.moveDown(0.6);
    const startX = doc.x, startY = doc.y;
    const boxW = (doc.page.width - doc.page.margins.left - doc.page.margins.right - 12) / 2;
    const lineH = 14;
    // Client
    doc.save();
    doc.roundedRect(startX, startY, boxW, lineH*3.6, 6).stroke('#e5e7eb');
  doc.font(BOLD).fillColor('#111827').text('Client', startX+8, startY+6);
  doc.font(REG).fillColor('#374151');
  doc.text(ARS(`${ensureString(client?.name||'')}`), startX+8, startY+22);
  if (client?.email) doc.text(ARS(`${ensureString(client.email)}`), startX+8, startY+36);
    doc.restore();
    // Project
    doc.save();
    const px = startX + boxW + 12;
    doc.roundedRect(px, startY, boxW, lineH*3.6, 6).stroke('#e5e7eb');
  doc.font(BOLD).fillColor('#111827').text('Project', px+8, startY+6);
  doc.font(REG).fillColor('#374151');
  doc.text(ARS(`${ensureString(project?.name||'')}`), px+8, startY+22);
  if (project?.site) doc.text(ARS(`${ensureString(project.site)}`), px+8, startY+36);
    doc.restore();
    doc.moveDown(3.2);

    // Table grid
    const cols = [
      { key:'#', label:'#', w:24 },
      { key:'desc', label:'Description', w:180 },
      { key:'pn', label:'PN', w:100 },
      { key:'qty', label:'Qty', w:45 },
      { key:'unit', label:'Unit', w:60 },
      { key:'total', label:'Total', w:70 }
    ];
    let x = doc.x; let y = doc.y + 4;
    const tableW = cols.reduce((a,c)=>a+c.w,0);
    const maxY = doc.page.height - doc.page.margins.bottom - 120;

    function drawHeader(){
      doc.save();
      doc.rect(x, y, tableW, 20).fill('#f3f4f6');
      let cx = x;
  cols.forEach(c=>{ doc.fillColor('#111827').font(BOLD).fontSize(10).text(ARS(c.label), cx+4, y+6, { width:c.w-8, align: c.key==='desc'?'left':'right' }); cx += c.w; });
      doc.restore();
      y += 20;
      // header bottom line
      doc.moveTo(x, y).lineTo(x+tableW, y).stroke('#e5e7eb');
    }
    function drawRow(i, it){
      const qty = Number(it.qty||1); const unit = Number(it.unit_price||it.unit||it.price||0); const line = unit*qty;
      const desc = ensureString(it.description||it.name||'-');
      const pn = ensureString(it.pn||'');
      const heights = [];
      heights.push(doc.heightOfString(String(i+1), { width: cols[0].w-8 }));
      heights.push(doc.heightOfString(desc, { width: cols[1].w-8 }));
      heights.push(doc.heightOfString(pn, { width: cols[2].w-8 }));
      const rowH = Math.max(20, ...heights);
      // page break
      if (y + rowH > maxY){
        doc.addPage();
        x = doc.page.margins.left; y = doc.page.margins.top; drawHeader();
      }
      // text cells
      let cx = x;
  doc.font(REG).fontSize(10).fillColor('#111827');
  doc.text(String(i+1), cx+4, y+4, { width: cols[0].w-8, align:'right' }); cx += cols[0].w;
  doc.text(ARS(desc), cx+4, y+4, { width: cols[1].w-8, align:'left' }); cx += cols[1].w;
  doc.text(ARS(pn), cx+4, y+4, { width: cols[2].w-8, align:'left' }); cx += cols[2].w;
      doc.text(String(qty), cx+4, y+4, { width: cols[3].w-8, align:'right' }); cx += cols[3].w;
      doc.text(unit.toFixed(2), cx+4, y+4, { width: cols[4].w-8, align:'right' }); cx += cols[4].w;
      doc.text(line.toFixed(2), cx+4, y+4, { width: cols[5].w-8, align:'right' });
      // row line
      doc.moveTo(x, y+rowH).lineTo(x+tableW, y+rowH).stroke('#f1f5f9');
      y += rowH;
    }

    drawHeader();
    const norm = (items||[]);
    let subtotal = 0;
    norm.forEach((it,i)=>{ const u = Number(it.unit_price||it.unit||it.price||0); const q = Number(it.qty||1); subtotal += u*q; drawRow(i,it); });
    const grand = subtotal;

    // Totals box (right aligned)
    y += 12; if (y > maxY) { doc.addPage(); x = doc.page.margins.left; y = doc.page.margins.top; }
    const tw = 220; const tx = x + tableW - tw; const ty = y;
    doc.roundedRect(tx, ty, tw, 44, 6).stroke('#e5e7eb');
  doc.font(REG).fontSize(11).fillColor('#111827');
  doc.text(ARS(`Subtotal: ${subtotal.toFixed(2)}`), tx+10, ty+8, { width: tw-20, align:'right' });
  doc.text(ARS(`Grand Total: ${grand.toFixed(2)}`), tx+10, ty+24, { width: tw-20, align:'right' });

    doc.end();
  });
}

function buildSummaryHtml(payload, action){
  const items = payload.items||[];
  const rows = items.slice(0,50).map((it,i)=>`
    <tr>
      <td style="padding:6px;border-bottom:1px solid #eee">${i+1}</td>
      <td style="padding:6px;border-bottom:1px solid #eee">${escapeHtml(it.description||it.name||'-')}</td>
      <td style="padding:6px;border-bottom:1px solid #eee">${escapeHtml(it.pn||'')}</td>
      <td style="padding:6px;border-bottom:1px solid #eee;text-align:right">${Number(it.qty||1)}</td>
      <td style="padding:6px;border-bottom:1px solid #eee;text-align:right">${Number(it.unit_price||it.unit||it.price||0)}</td>
    </tr>
  `).join('');
  const titleMap = { download:'Download PDF', send:'Send by Email', custom:'Get Custom Quote' };
  return `
    <div style="font-family:Segoe UI,Arial">
      <h3 style="margin:0 0 8px">${titleMap[action]||'Quote Action'} — ${escapeHtml(payload.number||'')}</h3>
      <div style="margin-bottom:8px;color:#374151">Date: ${escapeHtml(payload.date||'')} • Currency: ${escapeHtml(payload.currency||'USD')}</div>
      <div style="display:flex;gap:16px;margin-bottom:12px">
        <div>
          <div style="font-weight:600">Client</div>
          <div>${escapeHtml(payload.client?.name||'')}</div>
          <div>${escapeHtml(payload.client?.email||'')}</div>
        </div>
        <div>
          <div style="font-weight:600">Project</div>
          <div>${escapeHtml(payload.project?.name||'')}</div>
          <div>${escapeHtml(payload.project?.site||'')}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr>
          <th style="text-align:right;border-bottom:1px solid #ddd;padding:6px">#</th>
          <th style="text-align:right;border-bottom:1px solid #ddd;padding:6px">Description</th>
          <th style="text-align:right;border-bottom:1px solid #ddd;padding:6px">PN</th>
          <th style="text-align:right;border-bottom:1px solid #ddd;padding:6px">Qty</th>
          <th style="text-align:right;border-bottom:1px solid #ddd;padding:6px">Unit</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:10px;color:#6b7280">Automated message from QuickITQuote</div>
    </div>`;
}

function escapeHtml(s){ return (s==null?'':String(s)).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]||c)); }

export default async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });
  try{
    const body = req.body || {};
    const action = (body.action||'').toLowerCase();
    const payload = body;

    // Build CSV and PDF
    const csv = buildCsv(payload.items||[]);
    const csvB64 = b64(csv);
    const pdfBuf = await buildPdfBuffer(payload);
    const pdfB64 = pdfBuf.toString('base64');

    const baseName = sanitizeName(`${payload.number||'quotation'}${payload?.project?.name ? ' - ' + sanitizeName(payload.project.name) : ''}`) || 'quotation';
    const attachments = [
      { filename: `${baseName}.pdf`, type: 'application/pdf', content: pdfB64 },
      { filename: `${baseName}.csv`, type: 'text/csv', content: csvB64 }
    ];

  // Always notify admin (configurable via env with fallback)
  const adminEmail = process.env.QUOTE_NOTIFY_EMAIL || process.env.EMAIL_TO || 'ammr.gamal@gmail.com';
    const subject = `QIQ – ${action||'action'} — ${payload.number||''}`;
    const html = buildSummaryHtml(payload, action);
    const adminRes = await sendEmail({ to: adminEmail, subject, html, attachments });
    if (!adminRes?.ok) {
      console.warn('Admin email failed', adminRes);
    } else {
      try { console.log('Admin email sent', { provider: adminRes.provider, id: adminRes.id||null, usedOnboarding: !!adminRes.usedOnboarding }); } catch {}
    }

    // If sending to customer ('send' action), email the client too
    let clientRes = null;
    if (action === 'send'){
      const to = (payload?.client?.email || '').trim();
      if (to) {
        clientRes = await sendEmail({ to, subject: `Your quotation ${payload.number||''}`, html, attachments });
        if (!clientRes?.ok) console.warn('Client email failed', clientRes);
        else { try { console.log('Client email sent', { provider: clientRes.provider, id: clientRes.id||null, usedOnboarding: !!clientRes.usedOnboarding }); } catch {} }
      }
    }

    // Respond with base64s for download
  return res.status(200).json({ ok:true, pdfBase64: pdfB64, csvBase64: csvB64, email: { admin: adminRes||null, client: clientRes } });
  }catch(e){
    console.error('quote-email error', e);
    return res.status(500).json({ ok:false, error:'Server error' });
  }
}
