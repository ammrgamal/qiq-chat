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
const BRAND_PRIMARY = process.env.PDF_BRAND_COLOR || '#3C52B2';
const BRAND_BG      = process.env.PDF_BG_COLOR || '#EDF0FC';
const CURRENCY_FALLBACK = process.env.DEFAULT_CURRENCY || 'USD';

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

async function tryLoadLocal(filePath){
  try{ const buf = await fs.readFile(filePath); return buf; }catch{ return null; }
}

async function fetchImageBuffer(url){
  try{
    if (!url) return null;
    const r = await fetch(url);
    if (!r.ok) return null;
    const ab = await r.arrayBuffer();
    return Buffer.from(ab);
  }catch{ return null; }
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
    const name = ensureString(it.description || it.description_enriched || it.name || '-');
    const qty = Number(it.qty||1);
    const unit = Number(it.unit_price||it.unit||it.price||0);
    const total = unit*qty;
    return [escapeCsv(name), qty, unit, total].join(',');
  }).join('\n');
  return header + rows + (rows? '\n' : '');
}

function computeTotals(items){
  let subtotal = 0;
  for (const it of (items||[])){
    const u = Number(it.unit_price||it.unit||it.price||0);
    const q = Number(it.qty||1);
    subtotal += u*q;
  }
  return { subtotal, grand: subtotal };
}

function gatherBrands(items){
  const set = new Set();
  for (const it of (items||[])){
    const b = it.brand || it.manufacturer || it.vendor || it.mfg || it.maker;
    if (b) set.add(String(b));
  }
  return Array.from(set);
}

function gatherSystems(payload, items){
  const set = new Set();
  // Prefer explicit project props if provided
  const ps = payload?.project?.proposedSystems || payload?.proposedSystems;
  if (Array.isArray(ps)) ps.forEach(s=> s && set.add(String(s)));
  for (const it of (items||[])){
    const s = it.system || it.category || it.type || it.family;
    if (s) set.add(String(s));
  }
  return Array.from(set);
}

function buildClientLetterHtml(payload, { subtotal, grand }, systems, brands){
  const clientName = (payload?.client?.name || 'Customer').trim();
  const projName = (payload?.project?.name || '').trim();
  const currency = payload?.currency || CURRENCY_FALLBACK;
  const totalLine = `Proposal Total Amount: ${currency} ${grand.toFixed(2)}`;
  const sysLine = systems && systems.length ? `Proposed Systems: ${systems.slice(0,6).join(', ')}` : '';
  const brandLine = brands && brands.length ? `Proposed Brands: ${brands.slice(0,6).join(', ')}` : '';
  const lines = [totalLine, sysLine, brandLine].filter(Boolean).map(s=>`<div style="margin:2px 0">${escapeHtml(s)}</div>`).join('');
  return `
    <div style="font-family:Segoe UI,Arial;line-height:1.5">
      <div style="font-size:13px;color:#111827">Dear ${escapeHtml(clientName)},</div>
      <p style="margin:8px 0 10px;color:#111827">I hope you are doing well. I'm reaching out on behalf of <strong>QuickITQuote</strong>, Egypt’s first AI-powered B2B quotation platform. We combine AI with verified catalogs to deliver proposals with exceptional speed, transparency, and consistency.</p>
      <p style="margin:8px 0 10px;color:#111827">We see a great opportunity to collaborate on <strong>${escapeHtml(projName)}</strong>. We prepared a concise proposal outlining scope, timeline, budget, and deliverables.</p>
      <div style="background:#F3F4F6;border:1px solid #E5E7EB;border-radius:8px;padding:10px 12px;margin:10px 0">${lines}</div>
      <p style="margin:8px 0 10px;color:#111827">We’re committed to delivering a tailored solution to your needs. We’d love to receive your feedback and discuss next steps. Please let us know your availability and preferred communication method.</p>
      <p style="margin:8px 0 0;color:#111827">Thank you for considering this opportunity.<br/>Best regards,<br/>QuickITQuote Team</p>
    </div>`;
}

// OpenAI helper
async function openaiComplete({ prompt, maxTokens = 180, temperature = 0.5 }){
  const key = process.env.OPENAI_API_KEY;
  if (!key) return '';
  try{
    const url = 'https://api.openai.com/v1/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type':'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: 'You write concise, professional sales copy for IT proposals.' },
          { role: 'user', content: prompt }
        ]
      })
    });
    if (!res.ok) return '';
    const j = await res.json();
    return j?.choices?.[0]?.message?.content?.trim() || '';
  }catch{ return ''; }
}

async function enrichItemsWithAI(items){
  const out = [];
  for (const it of (items||[])){
    const enriched = { ...it };
    if (!ensureString(enriched.description)){
      const name = ensureString(enriched.name || enriched.title || enriched.Description || enriched.sku || enriched.pn || 'the product');
      const prompt = `Generate a short, professional product description for ${name} that highlights its use case, benefits, and ideal customer. Keep it concise and business-focused.`;
      const desc = await openaiComplete({ prompt, maxTokens: 120, temperature: 0.4 });
      if (desc) enriched.description_enriched = desc;
    }
    out.push(enriched);
  }
  return out;
}

async function buildSolutionDescription({ client, project, items, currency }){
  const lines = (items||[]).slice(0,8).map((it,i)=>`- ${ensureString(it.name||it.description||'Item')} ${it.pn?`(${it.pn})`:''} x${it.qty||1} @ ${Number(it.unit_price||it.price||it.unit||0)} ${currency}`).join('\n');
  const prompt = [
    `Client: ${ensureString(client?.name||'')}`,
    `Project: ${ensureString(project?.name||'')} ${ensureString(project?.site||'')}`,
    `Items:\n${lines}`,
    '',
    'Write a concise solution overview (120-180 words) describing the business problem addressed, the proposed solution approach, and expected outcomes. Use clear, executive-friendly language.'
  ].join('\n');
  const text = await openaiComplete({ prompt, maxTokens: 220, temperature: 0.5 });
  return text || '';
}

function buildPresentationCards(solutionText){
  // Fallback local composition into four cards
  const brief = ensureString(solutionText);
  // Split to four focus areas
  return [
    { title: 'Overview', body: brief.slice(0, 600) },
    { title: 'Architecture', body: 'High-level components: Endpoint/Network/SaaS, Management console, Reporting & Alerts, Backup & DR, Security controls. Integrates with existing directory and mail systems.' },
    { title: 'Business Benefits', body: '• Faster procurement and validation\n• Lower risk via verified alternatives\n• Predictable budgets (USD/EGP)\n• Improved security posture and uptime\n• Local support & availability' },
    { title: 'Implementation Plan', body: '1) Requirements sign-off\n2) Final BOM & quotation\n3) Provisioning & deployment\n4) Testing & handover\n5) Training & support' }
  ];
}

function _stripHtml(html){
  try{
    return String(html||'')
      .replace(/<\s*br\s*\/?>/gi,'\n')
      .replace(/<\/(p|div|li)\s*>/gi,'\n')
      .replace(/<[^>]+>/g,'')
      .replace(/\n{3,}/g,'\n\n')
      .trim();
  }catch{ return String(html||''); }
}
function _fromMarkdown(md){
  const s = String(md||'');
  const parts = s.split(/\n(?=#+\s)/).filter(Boolean); // split by headings
  const cards = [];
  for (const part of parts){
    const m = part.match(/^(#+)\s+(.+)$/m);
    let title = m ? m[2].trim() : undefined;
    let body = part.replace(/^#+\s+.+$/m,'').trim();
    if (!title) title = 'Section';
    if (body.length > 1200) body = body.slice(0, 1200)+"\n…";
    cards.push({ title, body });
    if (cards.length >= 4) break;
  }
  return cards;
}
function _normalizeGammaJson(obj){
  const out = [];
  if (!obj) return out;
  // Common shapes: {cards:[{title,body,image}]}, {slides:[{title,content|body|bullets,image}]}
  const cards = obj.cards || obj.slides || obj.sections || [];
  for (const c of cards){
    if (!c) continue;
    let title = c.title || c.heading || 'Card';
    let body = c.body || c.content || (Array.isArray(c.bullets) ? c.bullets.map(b=>`• ${b}`).join('\n') : '');
    let image = c.image || c.thumbnail || c.img || undefined;
    if (typeof body === 'object') body = JSON.stringify(body);
    out.push({ title, body: _stripHtml(body), image });
    if (out.length >= 4) break;
  }
  return out;
}
async function trySendToGamma(solutionText){
  const gammaKey = process.env.GAMMA_APP_API || process.env.GAMMA_APP_APIS || process.env.GAMMA_API || process.env.GAMMA_KEY;
  const gammaUrl = process.env.GAMMA_ENDPOINT || process.env.GAMMA_API_URL;
  if (!gammaKey || !gammaUrl || !solutionText) return { ok:false, skipped:true };
  try{
    const res = await fetch(gammaUrl, { method:'POST', headers:{ 'authorization': `Bearer ${gammaKey}`, 'content-type':'application/json' }, body: JSON.stringify({ prompt: solutionText, slides: 4 }) });
    const txt = await res.text();
    let parsedCards = [];
    // Try JSON
    try{
      const j = JSON.parse(txt);
      parsedCards = _normalizeGammaJson(j);
    }catch{
      // Not JSON. Try to detect markdown or HTML heuristically
      const looksHtml = /<\w+[^>]*>/.test(txt);
      const looksMd = /(^|\n)#+\s+/.test(txt);
      if (looksHtml) {
        const cleaned = _stripHtml(txt);
        parsedCards = _fromMarkdown(cleaned) || [];
      } else if (looksMd) {
        parsedCards = _fromMarkdown(txt) || [];
      } else {
        // Plain text: chunk into ~4 cards
        const chunks = String(txt).split(/\n\n+/).filter(Boolean);
        const size = Math.ceil(chunks.length / 4) || 1;
        for (let i=0;i<4 && i*size < chunks.length;i++){
          const slice = chunks.slice(i*size, (i+1)*size).join('\n');
          parsedCards.push({ title: ['Overview','Architecture','Benefits','Plan'][i] || 'Card', body: slice });
        }
      }
    }
    return { ok: res.ok, status: res.status, text: txt, cards: parsedCards };
  }catch(e){ return { ok:false, error: String(e&&e.message||e) }; }
}

// Build a branded multi-page PDF with intro, items, presentation cards, and closing
async function readAdminPdfPrefs(){
  try{
    const STORAGE_DIR = process.env.NODE_ENV === 'production' ? '/tmp/qiq-storage' : path.join(__dirname, '../.storage');
    const CONFIG_FILE = path.join(STORAGE_DIR, 'admin-config.json');
    const txt = await fs.readFile(CONFIG_FILE,'utf8');
    const j = JSON.parse(txt);
    const pdf = j?.pdf || {};
    return {
      includeItemImages: pdf.includeItemImages ?? (process.env.NODE_ENV==='production'),
      includePartnerLogos: pdf.includePartnerLogos ?? (process.env.NODE_ENV==='production'),
      includeProServices: pdf.includeProServices !== false // default true
    };
  }catch{
    return { includeItemImages: process.env.NODE_ENV==='production', includePartnerLogos: process.env.NODE_ENV==='production', includeProServices: true };
  }
}

async function buildPdfBuffer({ number, date, currency, client, project, items, solutionText, cards }){
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

  // Intro page (branding)
  let __logoBuf = null;
  const headerH = 80;
  doc.rect(doc.page.margins.left, doc.page.margins.top, doc.page.width - doc.page.margins.left - doc.page.margins.right, headerH).fill(BRAND_BG).stroke(BRAND_BG);
    doc.fillColor(BRAND_PRIMARY).font(BOLD).fontSize(22).text(ARS(`Official Quotation`), { align: 'left' });
    doc.moveDown(0.2).font(REG).fillColor('#111827').fontSize(12).text(ARS('Smart IT Procurement powered by QuickITQuote.com'));
    doc.moveDown(0.8).font(REG).fillColor('#374151').text(ARS(`Quote: ${ensureString(number)}    Date: ${ensureString(date)}    Currency: ${ensureString(currency)}`));

    // Try draw logo if available
    try{
      const logoPath = path.join(__dirname, '../public/logo.png');
      const logo = await tryLoadLocal(logoPath);
      if (logo){
        __logoBuf = logo;
        const w = 96; const x = doc.page.width - doc.page.margins.right - w; const y = doc.page.margins.top + 6;
        try{ doc.image(logo, x, y, { width: w }); }catch{}
      }
    }catch{}

  // Client / Project blocks (more space below header/logo)
  doc.moveDown(1.2);
    const startX = doc.x, startY = doc.y;
    const boxW = (doc.page.width - doc.page.margins.left - doc.page.margins.right - 12) / 2;
    const lineH = 14;
    doc.save();
    doc.roundedRect(startX, startY, boxW, lineH*3.6, 6).stroke('#e5e7eb');
    doc.font(BOLD).fillColor('#111827').text('Client', startX+8, startY+6);
    doc.font(REG).fillColor('#374151');
    doc.text(ARS(`${ensureString(client?.name||'')}`), startX+8, startY+22);
    if (client?.email) doc.text(ARS(`${ensureString(client.email)}`), startX+8, startY+36);
    doc.restore();
    doc.save();
  const px = startX + boxW + 12;
  // Avoid overlapping the header logo on the right by shrinking the Project box if needed
  const rightSafe = __logoBuf ? 110 : 0; // reserve ~110px near right edge for logo whitespace
  const maxRight = doc.page.width - doc.page.margins.right - rightSafe;
  const projBoxWidth = Math.max(120, Math.min(boxW, maxRight - px));
  doc.roundedRect(px, startY, projBoxWidth, lineH*3.6, 6).stroke('#e5e7eb');
  doc.font(BOLD).fillColor('#111827').text('Project', px+8, startY+6);
  doc.font(REG).fillColor('#374151');
  doc.text(ARS(`${ensureString(project?.name||'')}`), px+8, startY+22, { width: projBoxWidth-16 });
  if (project?.site) doc.text(ARS(`${ensureString(project.site)}`), px+8, startY+36, { width: projBoxWidth-16 });
    doc.restore();

    // Solution overview (bold title if provided like **Title**)
    if (solutionText){
      function parseSolutionLines(txt){
        const raw = ensureString(txt);
        const lines = raw.split(/\r?\n/);
        let title = null;
        if (/^\s*\*\*.+\*\*\s*$/.test(lines[0]||'')){
          title = (lines.shift()||'').replace(/^\s*\*\*(.+)\*\*\s*$/, '$1').trim();
        }
        const body = lines.join('\n').replace(/\*\*(.+?)\*\*/g,'$1');
        return { title, body: body.trim() };
      }
      const { title, body } = parseSolutionLines(solutionText);
      doc.moveDown(2);
      doc.font(BOLD).fillColor(BRAND_PRIMARY).fontSize(13).text('Solution Overview');
      if (title){
        doc.moveDown(0.2).font(BOLD).fillColor('#111827').fontSize(11).text(ARS(title), { align:'left' });
      }
      doc.moveDown(0.1).font(REG).fillColor('#111827').fontSize(11).text(ARS(body || solutionText), { align:'left' });
    }

    // Prepare page numbering; the intro page is page 1
    let __pageNum = 1;
    const drawFooter = () => {
      try{
        if (__pageNum < 2) return; // only from page 2+
        // Keep footer within printable area
        const footerY = doc.page.height - doc.page.margins.bottom - 12;
        // Page number left
        doc.save();
        doc.font(REG).fillColor('#6b7280').fontSize(9).text(`Page ${__pageNum}`, doc.page.margins.left, footerY, { align:'left' });
        doc.restore();
        // Logo right
        try{
          if (__logoBuf){
            const w2 = 44;
            const x2 = doc.page.width - doc.page.margins.right - w2;
            doc.image(__logoBuf, x2, footerY-8, { width: w2 });
          }
        }catch{}
      }catch{}
    };

  // Client letter page (visual/branding) — page 2
    __pageNum = 2;
    doc.addPage();
    try{
      const totalsTmp = computeTotals(items);
      const systemsTmp = gatherSystems({ client, project }, items);
      const brandsTmp = gatherBrands(items);
  // Letter heading + subtle divider
  doc.font(BOLD).fillColor(BRAND_PRIMARY).fontSize(14).text('Client Letter', { align:'left' });
  const headY = doc.y + 4;
  doc.moveTo(doc.page.margins.left, headY).lineTo(doc.page.width - doc.page.margins.right, headY).stroke('#e5e7eb');
      doc.moveDown(0.6);
      // Dear ... and paragraphs
      const dear = `Dear ${ensureString(client?.name||'Customer')},`;
      doc.font(REG).fillColor('#111827').fontSize(11).text(ARS(dear));
      doc.moveDown(0.4);
      const p1 = 'I hope you are doing well. I\'m reaching out on behalf of QuickITQuote, Egypt\'s first AI-powered B2B quotation platform. We combine AI with verified catalogs to deliver proposals with exceptional speed, transparency, and consistency.';
      doc.text(ARS(p1), { align:'left' });
      doc.moveDown(0.4);
      const p2 = `We see a great opportunity to collaborate on ${ensureString(project?.name||'your project')}. We prepared a concise proposal outlining scope, timeline, budget, and deliverables.`;
      doc.text(ARS(p2));
      doc.moveDown(0.6);
      // Info box
      const bxX = doc.page.margins.left, bxW = doc.page.width - doc.page.margins.left - doc.page.margins.right; let bxY = doc.y; const bxH = 64;
      doc.roundedRect(bxX, bxY, bxW, bxH, 8).fill('#F3F4F6').stroke('#E5E7EB');
      doc.fillColor('#111827').font(BOLD).fontSize(11).text(ARS(`Proposal Total Amount: ${ensureString(currency)} ${Number(totalsTmp.grand).toFixed(2)}`), bxX+12, bxY+10, { width: bxW-24 });
      const sys = systemsTmp && systemsTmp.length ? `Proposed Systems: ${systemsTmp.slice(0,6).join(', ')}` : '';
      const brs = brandsTmp && brandsTmp.length ? `Proposed Brands: ${brandsTmp.slice(0,6).join(', ')}` : '';
      if (sys) doc.font(REG).fontSize(10).fillColor('#374151').text(ARS(sys), bxX+12, bxY+28, { width: bxW-24 });
      if (brs) doc.font(REG).fontSize(10).fillColor('#374151').text(ARS(brs), bxX+12, bxY+42, { width: bxW-24 });
      doc.fillColor('#111827');
      doc.moveDown(4);
      const p3 = 'We\'re committed to delivering a tailored solution to your needs. We\'d love to receive your feedback and discuss next steps. Please let us know your availability and preferred communication method.';
      doc.font(REG).fontSize(11).text(ARS(p3));
      doc.moveDown(0.6);
      doc.text(ARS('Thank you for considering this opportunity.')); doc.moveDown(0.2);
      doc.text(ARS('Best regards,')); doc.text(ARS('QuickITQuote Team'));
    }catch{}

    // Next page (items table)
    drawFooter();
    __pageNum++;
    doc.addPage();

  // Items table grid
    const cols = [
      { key:'#', label:'#', w:24 },
      { key:'desc', label:'Description', w:230 },
      { key:'pn', label:'MPN', w:80 },
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
  const norm = (items||[]);
  const prefs = await readAdminPdfPrefs();
  const includeImages = prefs.includeItemImages || /^(1|true|yes)$/i.test(String(process.env.PDF_INCLUDE_IMAGES || ''));
    // Prefetch image buffers to avoid awaits inside drawing function
    const imgBuffers = new Map();
    if (includeImages){
      for (const it of norm){
        try{
          const key = it && (it.image || it["Image URL"] || it.thumbnail || it.img || '');
          if (key && !imgBuffers.has(key)){
            const buf = await fetchImageBuffer(key);
            if (buf) imgBuffers.set(key, buf);
          }
        }catch{}
      }
    }

    // Helper: render text with **bold** segments inline
    function renderFormattedText(text, x, y, width, alignLeft){
      const raw = ensureString(text || '');
      const hasBold = /\*\*(.+?)\*\*/.test(raw);
      if (!hasBold){
        doc.font(REG).fontSize(10).fillColor('#111827');
        doc.text(ARS(raw), x, y, { width, align: alignLeft ? 'left' : 'right' });
        return;
      }
      const rx = /\*\*(.+?)\*\*/g;
      let last = 0; let first = true; let m;
      while ((m = rx.exec(raw))){
        const before = raw.slice(last, m.index);
        if (before){
          doc.font(REG).fontSize(10).fillColor('#111827');
          doc.text(ARS(before), first ? x : undefined, first ? y : undefined, { width, align: alignLeft ? 'left' : 'right', continued: true });
          first = false;
        }
        const boldSeg = m[1] || '';
        if (boldSeg){
          doc.font(BOLD).fontSize(10).fillColor('#111827');
          doc.text(ARS(boldSeg), { width, align: alignLeft ? 'left' : 'right', continued: true });
          first = false;
        }
        last = rx.lastIndex;
      }
      const tail = raw.slice(last);
      doc.font(REG).fontSize(10).fillColor('#111827');
      doc.text(ARS(tail), first ? x : undefined, first ? y : undefined, { width, align: alignLeft ? 'left' : 'right', continued: false });
    }
    function drawRow(i, it){
      const qty = Number(it.qty||1); const unit = Number(it.unit_price||it.unit||it.price||0); const line = unit*qty;
      const desc = ensureString(it.description||it.description_enriched||it.name||'-');
      const pn = ensureString(it.pn||'');
      const heights = [];
      let descWidth = cols[1].w-8;
      let imgH = 0; let imgBuf = null;
      if (includeImages){
        const imgUrl = it.image || it["Image URL"] || it.thumbnail || it.img || '';
        imgBuf = imgBuffers.get(imgUrl) || null;
        if (imgBuf) { imgH = 48; descWidth -= 52; }
      }
      heights.push(doc.heightOfString(String(i+1), { width: cols[0].w-8 }));
  const linkUrlForHeight = ensureString(it.spec_sheet || it.link || it.datasheet || it['Spec'] || it['Specs Link'] || it['Data Sheet'] || it['DataSheet'] || '');
      heights.push(doc.heightOfString(desc + (linkUrlForHeight ? '\n' : ''), { width: descWidth }));
      heights.push(doc.heightOfString(pn, { width: cols[2].w-8 }));
      const rowH = Math.max(20, ...heights, imgH? imgH+8 : 0);
      // page break
      if (y + rowH > maxY){
        drawFooter();
        __pageNum++;
        doc.addPage();
        x = doc.page.margins.left; y = doc.page.margins.top; drawHeader();
      }
      // text cells
      let cx = x;
      doc.font(REG).fontSize(10).fillColor('#111827');
      doc.text(String(i+1), cx+4, y+4, { width: cols[0].w-8, align:'right' }); cx += cols[0].w;
      // description cell with optional image + optional spec sheet link
      if (imgBuf){
        try{ doc.image(imgBuf, cx+4, y+4, { fit: [46, 46] }); }catch{}
        renderFormattedText(desc, cx+54, y+4, (cols[1].w-8)-50, true);
  const linkUrl = ensureString(it.spec_sheet || it.link || it.datasheet || it['Spec'] || it['Specs Link'] || it['Data Sheet'] || it['DataSheet'] || '');
        if (linkUrl){
          const ly = y + Math.max(24, Math.min(rowH-14, 44));
          const lx = cx+54;
          const label = 'Spec sheet';
          doc.fillColor(BRAND_PRIMARY).font(REG).fontSize(9).text(label, lx, ly, { width: (cols[1].w-8)-50, align:'left', underline: true });
          const wlab = doc.widthOfString(label);
          try{ doc.link(lx, ly, wlab, 12, linkUrl); }catch{}
          doc.fillColor('#111827');
        }
      } else {
        renderFormattedText(desc, cx+4, y+4, cols[1].w-8, true);
  const linkUrl = ensureString(it.spec_sheet || it.link || it.datasheet || it['Spec'] || it['Specs Link'] || it['Data Sheet'] || it['DataSheet'] || '');
        if (linkUrl){
          const ly = y + Math.max(20, Math.min(rowH-14, 40));
          const lx = cx+4;
          const label = 'Spec sheet';
          doc.fillColor(BRAND_PRIMARY).font(REG).fontSize(9).text(label, lx, ly, { width: cols[1].w-8, align:'left', underline: true });
          const wlab = doc.widthOfString(label);
          try{ doc.link(lx, ly, wlab, 12, linkUrl); }catch{}
          doc.fillColor('#111827');
        }
      }
      cx += cols[1].w;
  doc.text(ARS(pn), cx+4, y+4, { width: cols[2].w-8, align:'left' }); cx += cols[2].w;
      doc.text(String(qty), cx+4, y+4, { width: cols[3].w-8, align:'right' }); cx += cols[3].w;
      doc.text(unit.toFixed(2), cx+4, y+4, { width: cols[4].w-8, align:'right' }); cx += cols[4].w;
      doc.text(line.toFixed(2), cx+4, y+4, { width: cols[5].w-8, align:'right' });
      // row line
      doc.moveTo(x, y+rowH).lineTo(x+tableW, y+rowH).stroke('#f1f5f9');
      y += rowH;
    }

    drawHeader();
  let subtotal = 0;
  norm.forEach((it,i)=>{ const u = Number(it.unit_price||it.unit||it.price||0); const q = Number(it.qty||1); subtotal += u*q; drawRow(i,it); });
  const grand = subtotal;

  // Optional Professional Services line (5% with minimum USD 200 equivalent) — not included in grand
  const prefs3 = prefs;
  if (prefs3.includeProServices) {
    const psMinUSD = 200;
    const currencyCode = ensureString(currency||CURRENCY_FALLBACK).toUpperCase();
    let rate = 1; // USD->USD
    try{
      if (currencyCode !== 'USD'){
        // tiny server-side FX using a public CDN; failure falls back to 1
        const fxUrl = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json`;
        const r = await fetch(fxUrl);
        if (r.ok){
          const j = await r.json();
          const map = j && j.usd;
          if (map && typeof map[currencyCode.toLowerCase()] === 'number'){
            rate = Number(map[currencyCode.toLowerCase()]) || 1;
          }
        }
      }
    }catch{}
    const minEquivalent = psMinUSD * rate;
    const psValue = Math.max(grand * 0.05, minEquivalent);
    // Render as a separate highlighted row before totals
    const rowHps = 20;
    if (y + rowHps > maxY){ drawFooter(); __pageNum++; doc.addPage(); x = doc.page.margins.left; y = doc.page.margins.top; drawHeader(); }
    let cxps = x;
    doc.save();
    // light highlight background across the row
    doc.rect(x, y, tableW, rowHps).fill(BRAND_BG);
    doc.fillColor('#0f172a').font(BOLD).fontSize(10);
    doc.text('#', cxps+4, y+4, { width: cols[0].w-8, align:'right' }); cxps += cols[0].w;
    const labelPs = 'Optional – Professional Services (5% min $200 eqv.)';
    doc.text(ARS(labelPs), cxps+4, y+4, { width: cols[1].w-8, align:'left' }); cxps += cols[1].w;
    doc.text('', cxps+4, y+4, { width: cols[2].w-8, align:'left' }); cxps += cols[2].w; // MPN empty
    doc.text('1', cxps+4, y+4, { width: cols[3].w-8, align:'right' }); cxps += cols[3].w;
    doc.text(psValue.toFixed(2), cxps+4, y+4, { width: cols[4].w-8, align:'right' }); cxps += cols[4].w;
    doc.text(psValue.toFixed(2), cxps+4, y+4, { width: cols[5].w-8, align:'right' });
    doc.restore();
    // separator line
    doc.moveTo(x, y+rowHps).lineTo(x+tableW, y+rowHps).stroke('#dbeafe');
    y += rowHps;
  }

    // Totals box (right aligned) with stronger contrast
  y += 12; if (y > maxY) { drawFooter(); __pageNum++; doc.addPage(); x = doc.page.margins.left; y = doc.page.margins.top; }
    const tw = 260; const tx = x + tableW - tw; const ty = y;
    doc.roundedRect(tx, ty, tw, 64, 6).stroke('#e5e7eb');
    // Subtotal row
    doc.font(BOLD).fontSize(11).fillColor('#374151');
    doc.text(ARS('Subtotal'), tx+12, ty+10, { width: tw-140, align:'left' });
    doc.font(BOLD).fillColor('#111827').text(ARS(subtotal.toFixed(2)), tx+12, ty+10, { width: tw-24, align:'right' });
    // Grand Total highlighted
    const gtY = ty+32;
    doc.rect(tx+1, gtY, tw-2, 28).fill(BRAND_BG).stroke(BRAND_BG);
    doc.fillColor(BRAND_PRIMARY).font(BOLD).fontSize(12).text(ARS('Grand Total'), tx+12, gtY+8, { width: tw-140, align:'left' });
    doc.fillColor('#0f172a').font(BOLD).text(ARS(grand.toFixed(2)), tx+12, gtY+8, { width: tw-24, align:'right' });

  // Note under totals to clarify it is optional and not included
  y = gtY + 36;
  doc.moveTo(x, y+10).lineTo(x+tableW, y+10).stroke('#f1f5f9');
  doc.font(REG).fillColor('#6b7280').fontSize(10).text(ARS(`Note: Professional Services is optional and not included in the Grand Total.`), x, y+16, { width: tableW, align:'left' });

    // Presentation cards page(s)
    if (Array.isArray(cards) && cards.length){
  drawFooter();
  __pageNum++;
  doc.addPage();
      doc.font(BOLD).fillColor(BRAND_PRIMARY).fontSize(14).text('Solution Presentation', { align:'left' });
      doc.moveDown(0.4);
      let cx = doc.page.margins.left; let cy = doc.y; const cw = (doc.page.width - doc.page.margins.left - doc.page.margins.right - 12)/2; const ch = 180;

      // Prefetch any card images
      const cardImgs = new Map();
      try{
        for (const c of cards){
          const u = c && c.image;
          if (u && !cardImgs.has(u)){
            const b = await fetchImageBuffer(u);
            if (b) cardImgs.set(u, b);
          }
        }
      }catch{}

      const drawCard = (card)=>{
  if (cy + ch > doc.page.height - doc.page.margins.bottom){ drawFooter(); __pageNum++; doc.addPage(); cx = doc.page.margins.left; cy = doc.page.margins.top; }
        doc.save();
        doc.roundedRect(cx, cy, cw, ch, 10).fill(BRAND_BG).stroke('#dbe4ff');
        doc.fillColor(BRAND_PRIMARY).font(BOLD).fontSize(12).text(ARS(card.title||'Card'), cx+12, cy+10, { width: cw-24 });
        // optional image top-right
        try{
          const u = card && card.image;
          const buf = u ? cardImgs.get(u) : null;
          if (buf){ doc.image(buf, cx+cw-52, cy+12, { fit: [40,40] }); }
        }catch{}
        doc.fillColor('#111827').font(REG).fontSize(10).text(ARS(card.body||''), cx+12, cy+34, { width: cw-24 });
        doc.restore();
        // advance
        if (cx + cw + 12 + cw <= doc.page.width - doc.page.margins.right){ cx += cw + 12; }
        else { cx = doc.page.margins.left; cy += ch + 12; }
      };
      cards.slice(0,4).forEach(drawCard);
    }

    // Closing page
  drawFooter();
  __pageNum++;
  doc.addPage();
    doc.font(BOLD).fillColor(BRAND_PRIMARY).fontSize(14).text('About QuickITQuote');
    doc.moveDown(0.4).font(REG).fillColor('#111827').fontSize(11).text(ARS('Egypt’s First AI-Powered B2B IT Quotation Platform. We deliver accurate BOQs, AI-assisted alternatives, verified solutions, real-time pricing, and local availability across industries (Healthcare, Finance, Education, Government).'));
    doc.moveDown(0.6).font(BOLD).fillColor('#111827').text('Contact');
    doc.font(REG).fillColor('#374151').text('https://quickitquote.com  •  sales@quickitquote.com');
    // Partner logos row if enabled
    try{
      const prefs2 = prefs; // already read
      if (prefs2.includePartnerLogos){
        const logosDir = path.join(__dirname, '../public/partners');
        let files = [];
        try{ files = await fs.readdir(logosDir); }catch{}
        const imgs = (files||[]).filter(f=>/\.(png|jpg|jpeg|gif|webp)$/i.test(f)).slice(0,8);
        if (imgs.length){
          doc.moveDown(0.8);
          let cx = doc.page.margins.left; const gap = 10; const h = 28;
          for (const f of imgs){
            try{
              const p = path.join(logosDir, f); const buf = await fs.readFile(p);
              doc.image(buf, cx, doc.y, { height: h });
              cx += 80;
              if (cx > doc.page.width - doc.page.margins.right - 60){ cx = doc.page.margins.left; doc.moveDown(h/10 + 0.6); }
            }catch{}
          }
        }
      }
    }catch{}

  drawFooter();
  doc.end();
  });
}

function buildSummaryHtml(payload, action){
  const items = payload.items||[];
  const rows = items.slice(0,50).map((it,i)=>{
    const descHtml = formatBoldHtml(it.description||it.name||'-');
    const link = it.spec_sheet || it.link || it.datasheet || it['Spec'] || it['Specs Link'] || it['Data Sheet'] || it['DataSheet'] || '';
    const linkHtml = link ? `<div><a href="${escapeHtml(link)}" style="color:${escapeHtml(BRAND_PRIMARY)};text-decoration:underline">Spec sheet</a></div>` : '';
    return `
    <tr>
      <td style="padding:6px;border-bottom:1px solid #eee">${i+1}</td>
      <td style="padding:6px;border-bottom:1px solid #eee">${descHtml}${linkHtml}</td>
      <td style="padding:6px;border-bottom:1px solid #eee">${escapeHtml(it.pn||'')}</td>
      <td style="padding:6px;border-bottom:1px solid #eee;text-align:right">${Number(it.qty||1)}</td>
      <td style="padding:6px;border-bottom:1px solid #eee;text-align:right">${Number(it.unit_price||it.unit||it.price||0)}</td>
    </tr>`;
  }).join('');
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
          <th style="text-align:right;border-bottom:1px solid #ddd;padding:6px">MPN</th>
          <th style="text-align:right;border-bottom:1px solid #ddd;padding:6px">Qty</th>
          <th style="text-align:right;border-bottom:1px solid #ddd;padding:6px">Unit</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:10px;color:#6b7280">Automated message from QuickITQuote</div>
    </div>`;
}

function escapeHtml(s){ return (s==null?'':String(s)).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]||c)); }

// Safely render **bold** segments in HTML while escaping other content
function formatBoldHtml(v){
  const safe = escapeHtml(v==null?'':String(v));
  return safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

export default async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });
  try{
    const body = req.body || {};
    const action = (body.action||'').toLowerCase();
    const payload = body;

    // Phase 1: Enrich items and build solution description
    const currency = payload.currency || CURRENCY_FALLBACK;
    const enrichedItems = await enrichItemsWithAI(payload.items||[]);
    const solutionText = await buildSolutionDescription({ client: payload.client, project: payload.project, items: enrichedItems, currency });
    let cards = buildPresentationCards(solutionText);
    // Optionally get Gamma cards. If env prefers Gamma, replace when available.
    try {
      // preferGamma: admin true forces on; admin false forces off; otherwise auto-enable if Gamma keys exist or env flag true
      const hasGamma = !!(process.env.GAMMA_APP_API || process.env.GAMMA_APP_APIS || process.env.GAMMA_API || process.env.GAMMA_KEY) && !!(process.env.GAMMA_ENDPOINT || process.env.GAMMA_API_URL);
      let adminPref;
      try{
        const STORAGE_DIR = process.env.NODE_ENV === 'production' ? '/tmp/qiq-storage' : path.join(__dirname, '../.storage');
        const CONFIG_FILE = path.join(STORAGE_DIR, 'admin-config.json');
        const t = await fs.readFile(CONFIG_FILE,'utf8');
        const j = JSON.parse(t);
        if (j?.ai && typeof j.ai.preferGammaCards === 'boolean') adminPref = j.ai.preferGammaCards;
      }catch{}
      let preferGamma = adminPref === true ? true : (adminPref === false ? false : (hasGamma || /^(1|true|yes)$/i.test(String(process.env.PREFER_GAMMA_CARDS||''))));
      const g = await trySendToGamma(solutionText);
      if (g && g.ok && Array.isArray(g.cards) && g.cards.length){
        if (preferGamma) cards = g.cards;
        else {
          // mix: take first two local and first two gamma
          const mixed = [];
          mixed.push(...cards.slice(0,2));
          mixed.push(...g.cards.slice(0,2));
          cards = mixed.slice(0,4);
        }
      }
    } catch {}

    // Build CSV and PDF
    const csv = buildCsv(enrichedItems);
    const csvB64 = b64(csv);
    const pdfBuf = await buildPdfBuffer({ ...payload, currency, items: enrichedItems, solutionText, cards });
    const pdfB64 = pdfBuf.toString('base64');

    const baseName = sanitizeName(`${payload.number||'quotation'}${payload?.project?.name ? ' - ' + sanitizeName(payload.project.name) : ''}`) || 'quotation';
    const attachments = [
      { filename: `${baseName}.pdf`, type: 'application/pdf', content: pdfB64 },
      { filename: `${baseName}.csv`, type: 'text/csv', content: csvB64 }
    ];

  // Always notify admin (configurable via env with fallback)
  const adminEmail = process.env.QUOTE_NOTIFY_EMAIL || process.env.EMAIL_TO || 'ammr.gamal@gmail.com';
    const subject = `QIQ – ${action||'action'} — ${payload.number||''}`;
  const html = buildSummaryHtml({ ...payload, items: enrichedItems }, action);
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
        // Tailored client letter
        const { subtotal, grand } = computeTotals(enrichedItems);
        const systems = gatherSystems(payload, enrichedItems);
        const brands = gatherBrands(enrichedItems);
        const clientHtml = buildClientLetterHtml({ ...payload, items: enrichedItems }, { subtotal, grand }, systems, brands);
        clientRes = await sendEmail({ to, subject: `Your quotation ${payload.number||''}`, html: clientHtml, attachments });
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
