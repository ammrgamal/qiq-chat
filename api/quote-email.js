// api/quote-email.js
// Generates PDF & CSV from a simple payload and emails notifications with attachments.
// Expected body: { action: 'download'|'send'|'custom', adminNotify: true, client: {...}, project: {...}, items: [...], number, date, currency }
// Returns { ok, pdfBase64, csvBase64 } (pdfBase64 only for download action)

import { sendEmail } from './_lib/email.js';
import { createLead, hasHelloLeads } from './_lib/helloleads.js';
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

// Translate to English when Arabic is detected (used to keep PDFs English-only)
async function translateToEnglishIfArabic(text){
  const s = String(text==null?'':text).trim();
  if (!hasArabic(s)) return s;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return s; // if no key, leave as-is
  const translated = await openaiComplete({
    prompt: `Translate to concise business English (no transliteration, no extra commentary):\n\n${s}`,
    maxTokens: 160,
    temperature: 0.2
  });
  return translated || s;
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
async function ensureArabicFonts(doc){ /* No-op: PDF is English-only using Latin fonts */ }

// Centralized spec-sheet link resolver (allows overrides and fallbacks)
function resolveSpecLink(it){
  try{
    const pn = String(it?.pn||'').trim();
    // Hard override for specific PN requested by admin
    if (/^CO11192-01F006$/i.test(pn)){
      return 'https://pub-02eff5b467804c8ebe56285681eba9a0.r2.dev/specs/Commscope/706144-p360-co11192-external.pdf';
    }
  }catch{}
  return ensureString(
    it?.spec_sheet || it?.link || it?.datasheet || it?.Spec || it?.['Specs Link'] || it?.['Data Sheet'] || it?.DataSheet || ''
  );
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
    const existingDesc = ensureString(enriched.description);
    if (!existingDesc){
      const name = ensureString(enriched.name || enriched.title || enriched.Description || enriched.sku || enriched.pn || 'the product');
      const prompt = `Generate a short, professional product description for ${name} that highlights its use case, benefits, and ideal customer. Keep it concise and business-focused.`;
      const desc = await openaiComplete({ prompt, maxTokens: 120, temperature: 0.4 });
      if (desc) enriched.description_enriched = desc;
    } else {
      // If provided description is Arabic, translate it to English for PDF/email use
      try{
        if (hasArabic(existingDesc)){
          const en = await translateToEnglishIfArabic(existingDesc);
          if (en && en !== existingDesc) enriched.description_en = en;
        }
      }catch{}
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

async function buildInstallationScope({ client, project, items }){
  const lines = (items||[]).slice(0,30).map((it,i)=>{
    const name = ensureString(it.name||it.description||'-');
    const pn = ensureString(it.pn||'');
    const qty = Number(it.qty||1);
    return `- ${name}${pn?` (${pn})`:''} x${qty}`;
  }).join('\n');
  const prompt = [
    `Client: ${ensureString(client?.name||'')}`,
    `Project: ${ensureString(project?.name||'')}`,
    `Items/BOQ:\n${lines}`,
    '',
    'Write a detailed installation & commissioning scope tailored to the listed items. Use concise bullet points grouped by phases: Preparation, Installation, Configuration, Testing & Validation, Documentation & Handover, Training (if relevant). Mention standards, best practices, cable management, labeling, safety, and acceptance criteria. Keep it 200-350 words.'
  ].join('\n');
  const text = await openaiComplete({ prompt, maxTokens: 380, temperature: 0.4 });
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

// --- Authoritative server-side conversion (USD is the base) ---
async function getUsdToRate(target){
  const code = String(target||'USD').toUpperCase();
  if (code === 'USD') return 1;
  try{
    const r = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
    if (!r.ok) return 1;
    const j = await r.json();
    const map = j && j.usd;
    const fx = map && map[code.toLowerCase()];
    return typeof fx === 'number' && fx>0 ? fx : 1;
  }catch{ return 1; }
}

// Basic totals and categorization helpers used in client letter and PDF
function computeTotals(items){
  let subtotal = 0;
  for (const it of (items||[])){
    const u = Number(it.unit_price||it.unit||it.price||0);
    const q = Number(it.qty||1);
    subtotal += (u*q);
  }
  return { subtotal, grand: subtotal };
}
function gatherSystems(payload, items){
  const set = new Set();
  for (const it of (items||[])){
    const cand = it.system || it.category || it.family || it.type || '';
    if (cand) set.add(String(cand));
    if (set.size>=8) break;
  }
  return Array.from(set);
}
function gatherBrands(items){
  const set = new Set();
  for (const it of (items||[])){
    const b = it.brand || it.manufacturer || it.vendor || it.maker || '';
    if (b) set.add(String(b));
    if (set.size>=8) break;
  }
  return Array.from(set);
}

// Optional: Algolia stats provider (safe no-op if not configured)
async function getAlgoliaCatalogStats(){ return null; }

async function convertItemsToCurrency(items, targetCurrency){
  const rate = await getUsdToRate(targetCurrency);
  const arr = Array.isArray(items) ? items : [];
  return arr.map(it=>{
    const out = { ...it };
    // Prefer explicit base USD value when present
    let baseUSD = Number(out.base_usd || out.baseUSD || out.base_price_usd || out.usd || 0);
    if (!baseUSD){
      // Assume incoming unit is USD if no explicit base provided
      baseUSD = Number(out.unit_price||out.unit||out.price||0);
    }
    if (!isFinite(baseUSD)) baseUSD = 0;
    out.base_usd = baseUSD;
    const conv = Number((baseUSD * rate).toFixed(2));
    out.unit = conv; out.unit_price = conv; out.price = conv;
    return out;
  });
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

    // Fonts: keep standard Latin fonts; avoid Arabic shaping entirely per requirements
    const REG = 'Helvetica';
    const BOLD = 'Helvetica-Bold';
    const ARS = (s)=> String(s==null?'':s);
    const clientNameEn = await translateToEnglishIfArabic(client?.name||'');
    const projectNameEn = await translateToEnglishIfArabic(project?.name||'');
    const projectSiteEn = await translateToEnglishIfArabic(project?.site||'');

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
  doc.text(ARS(`${ensureString(clientNameEn)}`), startX+8, startY+22);
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
  doc.text(ARS(`${ensureString(projectNameEn||'')}`), px+8, startY+22, { width: projBoxWidth-16 });
  if (project?.site) doc.text(ARS(`${ensureString(projectSiteEn)}`), px+8, startY+36, { width: projBoxWidth-16 });
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
  const dear = `Dear ${ensureString(clientNameEn||'Customer')},`;
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
  // Translate systems/brands lines to English if Arabic appears
  let sys = systemsTmp && systemsTmp.length ? `Proposed Systems: ${systemsTmp.slice(0,6).join(', ')}` : '';
  let brs = brandsTmp && brandsTmp.length ? `Proposed Brands: ${brandsTmp.slice(0,6).join(', ')}` : '';
  try{ if (hasArabic(sys)) sys = await translateToEnglishIfArabic(sys); }catch{}
  try{ if (hasArabic(brs)) brs = await translateToEnglishIfArabic(brs); }catch{}
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

    // Installation scope page — page 3
    drawFooter();
    __pageNum++;
    doc.addPage();
    try{
      const scopeText = await buildInstallationScope({ client, project, items });
      doc.font(BOLD).fillColor(BRAND_PRIMARY).fontSize(14).text('Installation & Commissioning Scope', { align:'left' });
      doc.moveDown(0.4);
      const raw = scopeText || 'Scope will be provided upon request.';
      const lines = String(raw).split(/\r?\n/);
      const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      let sx = doc.page.margins.left; let sy = doc.y; const sw = pageW;

      function writeHeading(text){
        const clean = text.replace(/^#+\s*/, '').replace(/\*\*/g,'').trim();
        if (!clean) return; doc.font(BOLD).fillColor('#111827').fontSize(12).text(ARS(clean), sx, sy, { width: sw }); sy = doc.y + 4;
      }
      function writeBullet(text){
        const body = text.replace(/^\s*[-*]\s+/, '').trim();
        const content = `• ${body}`; doc.save(); doc.font(REG).fillColor('#111827').fontSize(11); renderFormattedText(content, sx, sy, sw, true); doc.restore(); sy = doc.y + 2;
      }
      function writePara(text){
        const t = text.replace(/^\*\s+/, '').replace(/^#+\s*/,'').trim(); if (!t){ sy += 4; return; }
        doc.save(); doc.font(REG).fillColor('#111827').fontSize(11); renderFormattedText(t, sx, sy, sw, true); doc.restore(); sy = doc.y + 4;
      }

      for (const ln of lines){
        if (/^\s*#{1,6}\s+/.test(ln)) { writeHeading(ln); continue; }
        if (/^\s*[-*]\s+/.test(ln)) { writeBullet(ln); continue; }
        writePara(ln);
      }
    }catch{}

    // Next page (items table)
    drawFooter();
    __pageNum++;
    doc.addPage();

  // Items table grid (clean implementation)
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
      doc.moveTo(x, y).lineTo(x+tableW, y).stroke('#e5e7eb');
    }
    const norm = (items||[]);
    const prefs = await readAdminPdfPrefs();
    const includeImages = prefs.includeItemImages || /^(1|true|yes)$/i.test(String(process.env.PDF_INCLUDE_IMAGES || ''));
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

    function renderFormattedText(text, x1, y1, width, alignLeft){
      const raw = ensureString(text || '');
      const hasBold = /\*\*(.+?)\*\*/.test(raw);
      if (!hasBold){
        doc.font(REG).fontSize(10).fillColor('#111827');
        doc.text(ARS(raw), x1, y1, { width, align: alignLeft ? 'left' : 'right' });
        return;
      }
      const rx = /\*\*(.+?)\*\*/g;
      let last = 0; let first = true; let m;
      while ((m = rx.exec(raw))){
        const before = raw.slice(last, m.index);
        if (before){
          doc.font(REG).fontSize(10).fillColor('#111827');
          doc.text(ARS(before), first ? x1 : undefined, first ? y1 : undefined, { width, align: alignLeft ? 'left' : 'right', continued: true });
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
      doc.text(ARS(tail), first ? x1 : undefined, first ? y1 : undefined, { width, align: alignLeft ? 'left' : 'right', continued: false });
    }

    function drawRow(i, it){
      const qty = Number(it.qty||1); const unit = Number(it.unit_price||it.unit||it.price||0); const line = unit*qty;
      const desc = ensureString(it.description_en || it.description || it.description_enriched || it.name || '-');
      const pn = ensureString(it.pn||'');
      const colDescW = cols[1].w - 8;
      let imgBuf = null;
      if (includeImages){
        const imgUrl = it.image || it["Image URL"] || it.thumbnail || it.img || '';
        imgBuf = imgBuffers.get(imgUrl) || null;
      }
      const linkUrl = resolveSpecLink(it);
      const descPlain = desc.replace(/\*\*(.+?)\*\*/g,'$1');
      const widthLeft = imgBuf ? (colDescW - 50) : colDescW;
      const widthTop = colDescW;
      const textHLeft = doc.heightOfString(descPlain, { width: widthLeft });
      const textHTop = doc.heightOfString(descPlain, { width: widthTop });
      const useStackTop = !!imgBuf && (textHLeft > 60 && (textHTop + 46 < textHLeft + 20));
      const descTextHeight = useStackTop ? textHTop : textHLeft;
      const linkSpace = linkUrl ? 16 : 0;
      const padding = 6;
      const imgBlockH = imgBuf ? 46 + (useStackTop ? 4 : 0) : 0;
      let rowH = Math.max(22, descTextHeight + linkSpace + padding, imgBlockH + (useStackTop ? descTextHeight + linkSpace + padding : 0));
      if (y + rowH > maxY){ drawFooter(); __pageNum++; doc.addPage(); x = doc.page.margins.left; y = doc.page.margins.top; drawHeader(); }
      let cx = x;
      doc.font(REG).fontSize(10).fillColor('#111827');
      doc.text(String(i+1), cx+4, y+4, { width: cols[0].w-8, align:'right' }); cx += cols[0].w;
      doc.save();
      doc.rect(cx+4, y+2, colDescW, rowH-4).clip();
      let textStartY = y + 4;
      if (imgBuf){
        if (useStackTop){
          try{ doc.image(imgBuf, cx+4, y+4, { fit: [Math.min(colDescW, 120), 46] }); }catch{}
          textStartY += 50;
          renderFormattedText(desc, cx+4, textStartY, widthTop, true);
        } else {
          try{ doc.image(imgBuf, cx+4, y+4, { fit: [46,46] }); }catch{}
          renderFormattedText(desc, cx+54, y+4, widthLeft, true);
        }
      } else {
        renderFormattedText(desc, cx+4, y+4, widthTop, true);
      }
      if (linkUrl){
        const usedWidth = (imgBuf && !useStackTop) ? widthLeft : widthTop;
        const usedX = (imgBuf && !useStackTop) ? (cx+54) : (cx+4);
        const dH = doc.heightOfString(descPlain, { width: usedWidth });
        let ly = (imgBuf && useStackTop ? textStartY : (y+4)) + dH + 8;
        if (ly > y + rowH - 14) ly = y + rowH - 14;
        const iconSize = 6;
        doc.fillColor(BRAND_PRIMARY).rect(usedX, ly+3, iconSize, iconSize).fill();
        const labelTxt = 'Spec sheet';
        doc.fillColor(BRAND_PRIMARY).font(REG).fontSize(9).text(labelTxt, usedX + iconSize + 4, ly, { width: usedWidth - (iconSize+6), align:'left', underline: true });
        const wlab = doc.widthOfString(labelTxt) + iconSize + 6;
        try{ doc.link(usedX, ly, wlab, 12, linkUrl); }catch{}
        doc.fillColor('#111827');
      }
      doc.restore();
      cx += cols[1].w;
      doc.text(ARS(pn), cx+4, y+4, { width: cols[2].w-8, align:'left' }); cx += cols[2].w;
      doc.text(String(qty), cx+4, y+4, { width: cols[3].w-8, align:'right' }); cx += cols[3].w;
      doc.text(unit.toFixed(2), cx+4, y+4, { width: cols[4].w-8, align:'right' }); cx += cols[4].w;
      doc.text(line.toFixed(2), cx+4, y+4, { width: cols[5].w-8, align:'right' });
      doc.moveTo(x, y+rowH).lineTo(x+tableW, y+rowH).stroke('#f1f5f9');
      y += rowH;
    }

    // Run table
    drawHeader();
    let subtotal = 0;
    norm.forEach((it,i)=>{ const u = Number(it.unit_price||it.unit||it.price||0); const q = Number(it.qty||1); subtotal += u*q; drawRow(i,it); });
    const grand = subtotal; // Pro Services excluded from grand by policy

    // Optional Professional Services row (excluded from Grand Total)
    if (prefs.includeProServices){
      const psValue = Math.max(grand * 0.05, 200);
      const rowHps = 22;
      if (y + rowHps > maxY){ drawFooter(); __pageNum++; doc.addPage(); x = doc.page.margins.left; y = doc.page.margins.top; drawHeader(); }
      let cxps = x;
      doc.save();
      doc.rect(x, y, tableW, rowHps).fill(BRAND_BG);
      doc.fillColor('#0f172a').font(BOLD).fontSize(10);
      doc.text('#', cxps+4, y+4, { width: cols[0].w-8, align:'right' }); cxps += cols[0].w;
      const labelPs = 'Optional – Professional Services (Installation & Commissioning)';
      doc.text(ARS(labelPs), cxps+4, y+4, { width: cols[1].w-8, align:'left' }); cxps += cols[1].w;
      doc.text('', cxps+4, y+4, { width: cols[2].w-8, align:'left' }); cxps += cols[2].w;
      doc.text('1', cxps+4, y+4, { width: cols[3].w-8, align:'right' }); cxps += cols[3].w;
      doc.text(psValue.toFixed(2), cxps+4, y+4, { width: cols[4].w-8, align:'right' }); cxps += cols[4].w;
      doc.text(psValue.toFixed(2), cxps+4, y+4, { width: cols[5].w-8, align:'right' });
      doc.restore();
      doc.moveTo(x, y+rowHps).lineTo(x+tableW, y+rowHps).stroke('#dbeafe');
      y += rowHps;
    }

    // Totals box
    y += 12; if (y > maxY) { drawFooter(); __pageNum++; doc.addPage(); x = doc.page.margins.left; y = doc.page.margins.top; }
    const tw = 260; const tx = x + tableW - tw; const ty = y;
    doc.roundedRect(tx, ty, tw, 64, 6).stroke('#e5e7eb');
    doc.font(BOLD).fontSize(11).fillColor('#374151');
    doc.text(ARS('Subtotal'), tx+12, ty+10, { width: tw-140, align:'left' });
    doc.font(BOLD).fillColor('#111827').text(ARS(subtotal.toFixed(2)), tx+12, ty+10, { width: tw-24, align:'right' });
    const gtY = ty+32;
    doc.rect(tx+1, gtY, tw-2, 28).fill(BRAND_BG).stroke(BRAND_BG);
    doc.fillColor(BRAND_PRIMARY).font(BOLD).fontSize(12).text(ARS('Grand Total'), tx+12, gtY+8, { width: tw-140, align:'left' });
    doc.fillColor('#0f172a').font(BOLD).text(ARS(grand.toFixed(2)), tx+12, gtY+8, { width: tw-24, align:'right' });

    // Notes and commercial terms
    y = gtY + 36;
    doc.moveTo(x, y+10).lineTo(x+tableW, y+10).stroke('#f1f5f9');
    doc.font(REG).fillColor('#6b7280').fontSize(10).text(ARS(`Note: Professional Services covers installation, configuration, testing, documentation, and handover by a specialized, certified team. It is optional and not included in the Grand Total.`), x, y+16, { width: tableW, align:'left' });
    y = y + 48;
    const ctW = tableW; const ctX = x; const ctY = y;
    doc.font(BOLD).fillColor('#111827').fontSize(11).text('Commercial Terms', ctX, ctY, { width: ctW, align:'left' });
    doc.font(REG).fillColor('#111827').fontSize(10);
    const ctLines = [
      '• Typical lead time: 10–12 weeks.',
      '• For urgent requirements, we can provide equivalent alternatives upon client confirmation.',
      '• Prices are indicative; final pricing will be confirmed after final quantities and project commitment.'
    ];
    let cty = doc.y + 4; for (const l of ctLines){ doc.text(l, ctX, cty, { width: ctW }); cty = doc.y + 2; }

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
    // Optional Algolia stats (brands with >=1000 items and total items)
    try{
      const stats = await getAlgoliaCatalogStats?.();
      if (stats && (stats.total || (stats.primaryBrands && stats.primaryBrands.length))){
        if (stats.primaryBrands && stats.primaryBrands.length){
          doc.moveDown(0.4).font(BOLD).fillColor('#111827').fontSize(11).text(ARS('Primary Partners'));
          doc.font(REG).fillColor('#111827').fontSize(10).text(ARS(stats.primaryBrands.join(', ')));
        }
        if (stats.total){
          doc.moveDown(0.2).font(REG).fillColor('#111827').fontSize(10).text(ARS(`Catalog coverage: ${Number(stats.total).toLocaleString()}+ products indexed.`));
        }
      }
    }catch{}
    doc.moveDown(0.4).font(REG).fillColor('#111827').fontSize(11).text(ARS('QuickITQuote is Egypt’s first AI-powered B2B IT Quotation Platform. We combine AI with curated catalogs to deliver: accurate BOQs, AI-assisted alternatives, verified solutions, real-time pricing, and local availability. Our service accelerates procurement, reduces risk, and improves budget predictability across sectors (Healthcare, Finance, Education, Government).'));
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
  <div style="margin-bottom:8px;color:#374151">Date: ${escapeHtml(payload.date||'')} • Currency: ${escapeHtml(payload.currency||CURRENCY_FALLBACK)}</div>
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

// ===== Visitor Tracking & Lead Source Helpers =====
function extractVisitorInfo(req, payload) {
  const headers = req.headers || {};
  const userAgent = headers['user-agent'] || '';
  const referer = headers['referer'] || headers['referrer'] || '';
  const forwardedFor = headers['x-forwarded-for'] || '';
  const realIp = headers['x-real-ip'] || '';
  const cfConnectingIp = headers['cf-connecting-ip'] || '';
  
  // Extract IP address (prioritize CF/proxy headers)
  let ipAddress = cfConnectingIp || realIp || forwardedFor.split(',')[0]?.trim() || 
                  req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
  
  // Extract browser/device info
  const browserInfo = parseBrowserInfo(userAgent);
  
  // Extract UTM parameters or referrer info if available in payload
  const utmData = extractUtmParameters(payload, referer);
  
  return {
    ipAddress: ipAddress,
    userAgent: userAgent,
    referer: referer,
    browser: browserInfo.browser,
    os: browserInfo.os,
    device: browserInfo.device,
    timestamp: new Date().toISOString(),
    utm: utmData,
    sessionId: payload.sessionId || generateSessionId()
  };
}

function parseBrowserInfo(userAgent) {
  const ua = userAgent.toLowerCase();
  
  let browser = 'unknown';
  let os = 'unknown';
  let device = 'desktop';
  
  // Browser detection
  if (ua.includes('chrome') && !ua.includes('edg')) browser = 'chrome';
  else if (ua.includes('firefox')) browser = 'firefox';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'safari';
  else if (ua.includes('edg')) browser = 'edge';
  else if (ua.includes('opera')) browser = 'opera';
  
  // OS detection
  if (ua.includes('windows')) os = 'windows';
  else if (ua.includes('mac')) os = 'macos';
  else if (ua.includes('linux')) os = 'linux';
  else if (ua.includes('android')) os = 'android';
  else if (ua.includes('ios')) os = 'ios';
  
  // Device type detection
  if (ua.includes('mobile') || ua.includes('android')) device = 'mobile';
  else if (ua.includes('tablet') || ua.includes('ipad')) device = 'tablet';
  
  return { browser, os, device };
}

function extractUtmParameters(payload, referer) {
  const utm = {};
  
  // Try to extract UTM from payload if provided by frontend
  if (payload.utm) {
    Object.assign(utm, payload.utm);
  }
  
  // Try to extract from referer URL
  try {
    const url = new URL(referer);
    const searchParams = url.searchParams;
    
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(param => {
      if (searchParams.has(param)) {
        utm[param] = searchParams.get(param);
      }
    });
  } catch (e) {
    // Invalid referer URL, ignore
  }
  
  // Determine source from referer if no UTM
  if (!utm.utm_source && referer) {
    try {
      const refererHost = new URL(referer).hostname;
      if (refererHost.includes('google')) utm.utm_source = 'google';
      else if (refererHost.includes('facebook')) utm.utm_source = 'facebook';
      else if (refererHost.includes('linkedin')) utm.utm_source = 'linkedin';
      else if (refererHost.includes('twitter')) utm.utm_source = 'twitter';
      else utm.utm_source = refererHost;
    } catch (e) {
      utm.utm_source = 'direct';
    }
  } else if (!utm.utm_source) {
    utm.utm_source = 'direct';
  }
  
  return utm;
}

function determineLeadSource(payload, visitorInfo) {
  // Priority order for determining lead source
  
  // 1. Explicit source in payload
  if (payload.source) return payload.source;
  
  // 2. UTM source if available
  if (visitorInfo.utm?.utm_source) {
    const source = visitorInfo.utm.utm_source;
    const medium = visitorInfo.utm?.utm_medium || '';
    
    if (medium) {
      return `${source}/${medium}`;
    }
    return source;
  }
  
  // 3. Referer-based source
  if (visitorInfo.referer) {
    try {
      const refererHost = new URL(visitorInfo.referer).hostname;
      if (refererHost.includes('quickitquote')) return 'qiq-website';
      if (refererHost.includes('google')) return 'google-organic';
      return `referral/${refererHost}`;
    } catch (e) {
      // Invalid referer URL
    }
  }
  
  // 4. Default based on context
  return 'qiq-quote-direct';
}

function generateSessionId() {
  return `qiq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeName(s){ return String(s||'').replace(/[^a-zA-Z0-9\-_ ]/g, '').replace(/\s+/g, '_').slice(0, 120); }

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

  // Phase 1: Authoritative conversion (USD base) then enrich items and build solution description
  const currency = payload.currency || CURRENCY_FALLBACK;
  const convertedItems = await convertItemsToCurrency(payload.items||[], currency);
  const enrichedItems = await enrichItemsWithAI(convertedItems);
    const solutionText = await buildSolutionDescription({ client: payload.client, project: payload.project, items: enrichedItems, currency });
    let cards = buildPresentationCards(solutionText);
    // Optionally get Gamma cards. If env prefers Gamma, replace when available.
    try {
      // Force prefer Gamma unconditionally when keys+endpoint exist
      const hasGamma = !!(process.env.GAMMA_APP_API || process.env.GAMMA_APP_APIS || process.env.GAMMA_API || process.env.GAMMA_KEY) && !!(process.env.GAMMA_ENDPOINT || process.env.GAMMA_API_URL);
      const preferGamma = !!hasGamma;
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
        // Emails can remain in Arabic; do not translate here
        const clientHtml = buildClientLetterHtml({ ...payload, items: enrichedItems }, { subtotal, grand }, systems, brands);
        clientRes = await sendEmail({ to, subject: `Your quotation ${payload.number||''}`, html: clientHtml, attachments });
        if (!clientRes?.ok) console.warn('Client email failed', clientRes);
        else { try { console.log('Client email sent', { provider: clientRes.provider, id: clientRes.id||null, usedOnboarding: !!clientRes.usedOnboarding }); } catch {} }
      }
    }

    // Respond with base64s for download
    
    // ===== HelloLeads Integration =====
    // Send quotation data to HelloLeads for lead tracking
    let helloLeadsResult = null;
    if (hasHelloLeads()) {
      try {
        // Extract visitor/session information from headers or payload
        const visitorInfo = extractVisitorInfo(req, payload);
        
        // Prepare lead data for HelloLeads
        const leadData = {
          client: payload.client || {},
          project: payload.project || {},
          items: enrichedItems || [],
          number: payload.number || '',
          date: payload.date || new Date().toISOString().slice(0, 10),
          source: determineLeadSource(payload, visitorInfo),
          visitor: visitorInfo,
          quotation: {
            id: payload.number,
            action: action,
            currency: currency,
            total: computeTotals(enrichedItems).grand,
            itemCount: enrichedItems.length
          }
        };
        
        helloLeadsResult = await createLead(leadData);
        
        if (helloLeadsResult.ok) {
          console.log('✅ HelloLeads: Lead created successfully', {
            quotationId: payload.number,
            leadSource: leadData.source,
            clientEmail: payload?.client?.email || 'N/A'
          });
        } else {
          console.warn('⚠️ HelloLeads: Failed to create lead', helloLeadsResult);
        }
      } catch (error) {
        console.error('❌ HelloLeads: Error creating lead', error);
        helloLeadsResult = { ok: false, error: error.message };
      }
    } else {
      console.log('ℹ️ HelloLeads: Not configured, skipping lead creation');
    }

  return res.status(200).json({ 
    ok: true, 
    pdfBase64: pdfB64, 
    csvBase64: csvB64, 
    email: { admin: adminRes||null, client: clientRes },
    helloleads: helloLeadsResult
  });
  }catch(e){
    console.error('quote-email error', e);
    return res.status(500).json({ ok:false, error:'Server error' });
  }
}
