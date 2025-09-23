(function(){
  'use strict';

  async function imageUrlToDataURL(url){
    try{
      if (!url) return null;
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve)=>{
        const reader = new FileReader();
        reader.onload = ()=> resolve(reader.result);
        reader.onerror = ()=> resolve(null);
        reader.readAsDataURL(blob);
      });
    }catch{ return null; }
  }

  const fmt = (v, cur) => {
    const n = Number(v || 0);
    try {
      return new Intl.NumberFormat('en-US', { style:'currency', currency: cur||'USD', maximumFractionDigits: 2 }).format(n);
    } catch { return `${n.toFixed(2)} ${cur||''}`.trim(); }
  };

  // --- PDF text sanitization helpers (match quote.js behavior) ---
  const PLACEHOLDER_PAT = /^(?:\s*[-–—]?\s*|\s*(?:N\/?A|Unknown|غير\s*معروف)\s*)$/i;
  const STRIP_PAT = /\b(?:N\/?A|Unknown|غير\s*معروف)\b/ig;
  const collapseSpaces = (s) => s.replace(/[\t \u00A0\u200F\u200E]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
  const hasArabic = (s) => /[\u0600-\u06FF]/.test(s);
  const hasLatinOrDigits = (s) => /[A-Za-z0-9]/.test(s);
  const wrapLatinWithLRM = (s) => s.replace(/([A-Za-z0-9][A-Za-z0-9\-_.\/+]*)/g, '\u200E$1\u200E');
  function sanitizeForPdf(input, opts){
    let t = String(input ?? '').replace(STRIP_PAT, '').trim();
    if (!t || PLACEHOLDER_PAT.test(t)) return '';
    t = collapseSpaces(t);
    if (opts?.rtl && hasArabic(t) && hasLatinOrDigits(t)) t = wrapLatinWithLRM(t);
    return t;
  }
  // English-only filter for PDF output
  const englishOnly = (s) => collapseSpaces(String(s||'').replace(/[^A-Za-z0-9\s\.,;:\/\-\+_\(\)\[\]&@#%\'"!\?]/g, ''));

  function payloadFromQuotation(q){
    const p = q?.payload || {};
    const items = Array.isArray(p.items) ? p.items : (Array.isArray(q.items) ? q.items : []);
    const currency = p.currency || q.currency || 'USD';
    const number = q.id || p.number || 'quotation';
    const date = q.date || (q.savedAt||'').slice(0,10) || new Date().toISOString().slice(0,10);
    const client = p.client || { name: q.clientName || '', email: q.userEmail || '' };
    const project = p.project || { name: q.projectName || '', site: '' };
    const include_installation_5pct = Boolean(p.include_installation_5pct || q.include_installation_5pct || p.include_install || q.include_install);
    const terms = (p.terms || '• Prices exclude VAT unless stated.\n• Offer valid for 14 days.');
    const paymentTerms = (p.payment_terms || '50% advance, 50% on delivery.');
    return { number, date, currency, client, project, items, include_installation_5pct, terms, paymentTerms };
  }

  function computeTotals(items, includeInstall){
    const subtotal = (items||[]).reduce((s,it)=> s + (Number(it.unit || it.unit_price || it.price || 0) * Number(it.qty || 1)), 0);
    const install = includeInstall ? subtotal * 0.05 : 0;
    const grand = subtotal + install;
    return { subtotal, install, grand };
  }

  async function buildAndDownload(q, opts){
    try{ await window.ensureArabicFonts?.(); }catch{}
    const payload = payloadFromQuotation(q);
    // Server-assisted translation to English for fields that may contain Arabic
    try{
      const tRes = await fetch('/api/pdf-ai', { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ translate: {
        client_name: payload.client?.name||'',
        client_contact: payload.client?.contact||'',
        client_email: payload.client?.email||'',
        client_phone: payload.client?.phone||'',
        project_name: payload.project?.name||'',
        project_site: payload.project?.site||'',
        payment_terms: payload.paymentTerms || '',
        terms: payload.terms || ''
      } }) });
      if (tRes.ok){
        const tj = await tRes.json().catch(()=>({}));
        const tr = tj?.translations || {};
        if (tr){
          if (tr.client_name) payload.client.name = tr.client_name;
          if (tr.client_contact) payload.client.contact = tr.client_contact;
          if (tr.client_email) payload.client.email = tr.client_email;
          if (tr.client_phone) payload.client.phone = tr.client_phone;
          if (tr.project_name) payload.project.name = tr.project_name;
          if (tr.project_site) payload.project.site = tr.project_site;
          if (tr.payment_terms) payload.paymentTerms = tr.payment_terms;
          if (tr.terms) payload.terms = tr.terms;
        }
      }
    }catch{}
  const includeImages = (opts?.includeImages !== false);
    const totals = computeTotals(payload.items, payload.include_installation_5pct);

    // Try embedding logo
    const logoDataUrl = await imageUrlToDataURL('/logo.png');

    // AI headings/letter/bullets
    let ai = null;
    try{
      const imageUrls = Array.from(new Set((payload.items||[]).map(it=>it?.image||'').filter(Boolean))).slice(0,5);
      const webUrls   = Array.from(new Set((payload.items||[]).map(it=>it?.link||'').filter(Boolean))).slice(0,5);
      const pdfUrls   = webUrls.filter(u => /\.pdf(\?|#|$)/i.test(u)).slice(0,3);
      const r = await fetch('/api/pdf-ai', { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ client: payload.client, project: payload.project, items: payload.items, currency: payload.currency, imageUrls, webUrls, pdfUrls }) });
      const j = await r.json(); ai = j?.data || null; if (j?.provider) console.info('PDF AI provider:', j.provider, j?.note?`(${j.note})`:'');
    }catch{}
    const headings = ai?.headings || { letter:'Cover Letter', boq:'Bill of Quantities', terms:'Terms & Conditions', productDetails:'Product Details' };
    const coverTitle = englishOnly(ai?.coverTitle || 'Quotation');
    const coverSubtitle = englishOnly(ai?.coverSubtitle || '');
    const letterEn = englishOnly(ai?.letter?.en || '');
    const letterBlocks = letterEn ? [ { text: letterEn } ] : [
      { text: `Dear ${englishOnly(payload.client?.contact || 'Sir/Madam')},\n\nThank you for the opportunity to submit our quotation for ${englishOnly(payload.project?.name || 'your project')}.` }
    ];

    // Optionally prefetch images for BOQ thumbnails (cap to 100)
    let itemsWithDataImages = [];
    if (includeImages) {
      itemsWithDataImages = [];
      const max = Math.min((payload.items||[]).length, 100);
      for (let i=0;i<max;i++){
        const it = payload.items[i];
        const durl = it && it.image ? await imageUrlToDataURL(it.image) : null;
        itemsWithDataImages.push({ ...it, _img: durl });
      }
    }

    const lines = (payload.items||[]).map((it,i)=>{
      const unit = Number(it.unit_price||it.unit||it.price||0);
      const qty = Number(it.qty||1);
      const line = unit * qty;
      const maybeImg = includeImages ? (itemsWithDataImages[i]?._img || null) : null;
  const descText = englishOnly(it.description||it.name||'-');
  const pnText = englishOnly(it.pn||it.sku||'');
      const descStack = maybeImg ? {
        columns:[
          { image: maybeImg, width: 24, height: 24, margin:[0,2,6,0] },
          { text: descText || '-' }
        ]
      } : { text: descText || '-' };
      return [
        { text: String(i+1), alignment:'right' },
        descStack,
        { text: pnText, alignment:'right' },
        { text: String(qty), alignment:'right' },
        { text: fmt(unit, payload.currency), alignment:'right' },
        { text: fmt(line, payload.currency), alignment:'right' },
      ];
    });

    const dd = {
      info: { title: `Quotation ${payload.number}` },
      pageMargins: [36, 84, 36, 48],
      defaultStyle: { fontSize: 10, lineHeight: 1.2, font: (window.pdfMake?.fonts && window.pdfMake.fonts.Roboto) ? 'Roboto' : undefined },
      header: function(currentPage, pageCount){
        if (currentPage === 1) {
          return { text:'', margin:[36,20,36,0] };
        }
        return { columns:[ logoDataUrl ? { image: logoDataUrl, width: 80 } : { text:'QuickITQuote', style:'small' }, { text:`Page ${currentPage} of ${pageCount}`, alignment:'right', style:'small' } ], margin:[36,20,36,0] };
      },
      styles: {
        title: { fontSize: 22, bold: true, color:'#111827' },
        subtitle: { fontSize: 12, color: '#6b7280' },
        h2: { fontSize: 16, bold: true, color:'#1f2937', margin:[0,12,0,6] },
        h3: { fontSize: 12, bold: true, color:'#111827', margin:[0,8,0,4] },
        label: { bold: true, color: '#374151' },
        tableHeader: { bold: true, fillColor: '#eef2ff', color:'#1f2937' },
        small: { fontSize: 9, color: '#6b7280' },
        tocTitle: { fontSize: 14, bold: true, margin:[0,0,0,8] },
        tocItem: { fontSize: 10 }
      },
      footer: function(currentPage, pageCount){
        return { columns:[ { text: 'QuickITQuote', style:'small' }, { text: `Page ${currentPage} of ${pageCount}`, alignment:'right', style:'small' } ], margin:[36, 8, 36, 0] };
      },
      content: [
        { tocItem: true, text: 'Cover', style: 'h2' },
        {
          columns: [
            logoDataUrl ? { image: logoDataUrl, width: 140, margin:[0,0,0,12] } : { text: 'QuickITQuote', style:'title' },
            { alignment: 'right', stack: [ { text: coverTitle, style:'title' }, { text: `Number: ${payload.number}`, style:'subtitle' }, { text: `Date: ${payload.date}` , style:'subtitle' }, { text: `Currency: ${payload.currency}`, style:'subtitle' } ] }
          ], margin:[0,0,0,12]
        },
        coverSubtitle ? { text: coverSubtitle, style:'subtitle', margin:[0,0,0,8] } : null,
  { columns:[ { width:'*', stack:[ { text:'Client', style:'h3' }, { text: englishOnly(payload.client?.name || '') }, { text: englishOnly(payload.client?.contact || '') }, { text: englishOnly(payload.client?.email || '') }, { text: englishOnly(payload.client?.phone || '') } ]}, { width:'*', stack:[ { text:'Project', style:'h3' }, { text: englishOnly(payload.project?.name || '') }, { text: englishOnly(payload.project?.site || '') }, { text: englishOnly(payload.project?.execution_date || '') } ]} ] },
        { text:'', pageBreak:'after' },

        { toc: { title: { text:'Table of Contents', style:'tocTitle' } } },
        { text:'', pageBreak:'after' },

  { tocItem:true, text: englishOnly(headings.letter || 'Cover Letter'), style:'h2' },
  { stack: letterBlocks, margin:[0,0,0,12] },
        { text:'Summary', style:'h3' },
        { ul:[ `Subtotal: ${fmt(totals.subtotal, payload.currency)}`, (payload.include_installation_5pct ? `Installation/Services: ${fmt(totals.install, payload.currency)}` : null), `Grand Total: ${fmt(totals.grand, payload.currency)}` ].filter(Boolean) },
        { text:'', pageBreak:'after' },

  { tocItem:true, text: englishOnly(headings.boq || 'Bill of Quantities'), style:'h2' },
        { table:{ headerRows:1, widths:['auto','*','auto','auto','auto','auto'], body:[ [ {text:'#',style:'tableHeader', alignment:'right'}, {text:'Description',style:'tableHeader'}, {text:'PN',style:'tableHeader', alignment:'right'}, {text:'Qty',style:'tableHeader', alignment:'right'}, {text:'Unit',style:'tableHeader', alignment:'right'}, {text:'Line',style:'tableHeader', alignment:'right'} ], ...lines ] }, layout:{ fillColor:(rowIndex)=> rowIndex===0?'#f3f4f6':(rowIndex%2===0?'#fafafa':null), hLineColor:'#e5e7eb', vLineColor:'#e5e7eb' } },
        { text:'', pageBreak:'after' },

  (ai?.products && ai.products.length) ? { tocItem:true, text: englishOnly(headings.productDetails || 'Product Details'), style:'h2' } : null,
        ...(ai?.products || []).flatMap(p => {
          const t = englishOnly(p.title || '');
          const bullets = Array.isArray(p.bullets) ? p.bullets.map(b=>englishOnly(b)).filter(Boolean) : [];
          return ([ { text: t, style:'h3' }, bullets.length ? { ul: bullets } : { text:'' } ]);
        }),
        ai?.products?.length ? { text:'', pageBreak:'after' } : null,

  { tocItem:true, text: englishOnly(headings.terms || 'Terms & Conditions'), style:'h2' },
        { text:'Payment Terms', style:'h3' },
        { text: englishOnly(payload.paymentTerms || ''), margin:[0,0,0,8] },
        { text:'Terms & Conditions', style:'h3' },
        { text: englishOnly(payload.terms || '') }
      ].filter(Boolean)
    };

    window.pdfMake?.createPdf(dd).download(`${payload.number || 'quotation'}.pdf`);
  }

  window.QiqAdminPdf = { buildAndDownload };
})();
