(function () {
  // ===== Global variables =====
  let isLoading = false;
  let filteredRows = [];

  // ===== Helpers =====
  const $ = (id) => document.getElementById(id);
  const fmt = (v, cur) => {
    const n = Number(v || 0);
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: cur || getCurrency(),
        maximumFractionDigits: 2
      }).format(n);
    } catch {
      return `${n.toFixed(2)} ${cur || ""}`.trim();
    }
  };
  const getCurrency = () => $("currency").value || "USD";
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const uid = () => Math.random().toString(36).slice(2, 8).toUpperCase();

  // Text sanitization for PDF: remove placeholders and fix RTL/LTR mixing
  const PLACEHOLDER_PAT = /^(?:\s*[-–—]?\s*|\s*(?:N\/?A|Unknown|غير\s*معروف)\s*)$/i;
  const STRIP_PAT = /\b(?:N\/?A|Unknown|غير\s*معروف)\b/ig;
  const collapseSpaces = (s) => s.replace(/[\t \u00A0\u200F\u200E]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
  const hasArabic = (s) => /[\u0600-\u06FF]/.test(s);
  const hasLatinOrDigits = (s) => /[A-Za-z0-9]/.test(s);
  // Wrap Latin tokens with LRM when inside Arabic paragraphs to avoid direction confusion
  function wrapLatinWithLRM(s){
    return s.replace(/([A-Za-z0-9][A-Za-z0-9\-_.\/+]*)/g, '\u200E$1\u200E');
  }
  // English-only filter (remove non-ASCII Latin except digits/punct)
  function englishOnly(input){
    const raw = String(input ?? '');
    const filtered = raw.replace(/[^A-Za-z0-9\s\.,;:\/\-\+_\(\)\[\]&@#%\'"!\?]/g, '');
    return collapseSpaces(filtered);
  }
  function sanitizeForPdf(input, opts){
    let t = String(input ?? '').replace(STRIP_PAT, '').trim();
    if (!t || PLACEHOLDER_PAT.test(t)) return '';
    t = collapseSpaces(t);
    if (opts?.rtl && hasArabic(t) && hasLatinOrDigits(t)) {
      t = wrapLatinWithLRM(t);
    }
    // Force English-only as per requirement
    return englishOnly(t);
  }

  // Convert image URL to dataURL for pdfmake (same-origin recommended)
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

  // ===== Enhanced UI Helpers =====
  const showNotification = (message, type = 'info') => {
    // Use the global toast system if available
    if (window.QiqToast && window.QiqToast.show) {
      // enforce minimum duration 2000ms
      window.QiqToast.show(message, type, 2500);
    } else {
      // Fallback notification system
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10000;
        padding: 12px 16px; border-radius: 8px; color: white;
        background: ${type === 'success' ? '#059669' : type === 'error' ? '#dc2626' : '#2563eb'};
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      `;
      notification.textContent = message;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 3000);
    }
  };

  const updateEmptyState = () => {
    const emptyState = $("empty-state");
    const proceedCta = $("proceed-cta");
    const tableWrap = document.querySelector(".table-wrap");
    const rowCount = itemsBody.querySelectorAll("tr").length;
    
    if (rowCount === 0 || (rowCount === 1 && !hasValidData())) {
      if (emptyState) {
        emptyState.style.display = "block";
        tableWrap.style.display = "none";
      }
      if (proceedCta) proceedCta.style.display = "none";
    } else {
      if (emptyState) {
        emptyState.style.display = "none";
        tableWrap.style.display = "block";
      }
      if (proceedCta) proceedCta.style.display = "block";
    }
  };

  const hasValidData = () => {
    const rows = itemsBody.querySelectorAll("tr");
    for (let row of rows) {
      const desc = row.querySelector(".in-desc")?.value?.trim();
      const unit = row.querySelector(".in-unit")?.value?.trim();
      if (desc && desc !== "" && unit && parseFloat(unit) > 0) {
        return true;
      }
    }
    return false;
  };

  const setLoadingState = (button, loading = true) => {
    if (loading) {
      button.disabled = true;
      button.innerHTML = '<span class="loading-spinner"></span>' + button.textContent;
    } else {
      button.disabled = false;
      button.innerHTML = button.textContent.replace(/^.*?>/, '');
    }
  };

  const confirmAction = (message) => {
    return window.confirm(message);
  };

  // ===== Elements =====
  const logoEl = $("qo-logo");
  const quoteNoEl = $("qo-number");
  const quoteDateViewEl = $("qo-date");
  const currencyViewEl = $("qo-currency-view");

  const itemsBody = $("items-body");
  const subtotalCell = $("subtotal-cell");
  const installCell = $("install-cell");
  const grandCell = $("grand-cell");

  // ===== Init header =====
  const STATE_KEY = "qiq_quote_state_v1";
  const STAGED_KEY = "qiq_staged_items"; // توقعنا من صفحة الشات لو بتخزن العناصر

  const state = loadState() || {};
  const number = state.number || `Q-${new Date().getFullYear()}-${uid()}`;
  const dateISO = state.date || todayISO();

  quoteNoEl.textContent = number;
  $("quote-date").value = dateISO;
  quoteDateViewEl.textContent = dateISO;

  const defaultLogo = (state.logo || "/logo.png"); // غيّر المسار حسب مشروعك
  logoEl.src = defaultLogo;
  logoEl.onerror = () => (logoEl.src = "https://via.placeholder.com/200x80?text=LOGO");

  // Prefill currency
  $("currency").value = state.currency || "USD";
  currencyViewEl.textContent = $("currency").value;

  // Prefill client/project if saved
  $("client-name").value = state.client_name || "";
  $("client-contact").value = state.client_contact || "";
  $("client-email").value = state.client_email || "";
  $("client-phone").value = state.client_phone || "";
  $("project-name").value = state.project_name || "";
  $("project-owner").value = state.project_owner || "";
  $("main-contractor").value = state.main_contractor || "";
  $("site-location").value = state.site_location || "";
  $("need-assist").checked = !!state.need_assist;

  $("payment-terms").value = state.payment_terms || $("payment-terms").value;
  $("terms").value = state.terms || $("terms").value;

  $("include-install").checked = !!state.include_install;

  // ===== Items table =====
  const savedItems = state.items || [];
  if (savedItems.length) {
    savedItems.forEach(addRowFromData);
  } else {
    // Check for items from search page first
    try {
      const pendingItems = localStorage.getItem('pendingQuoteItems');
      if (pendingItems) {
        const items = JSON.parse(pendingItems);
        let imported = 0;
        const existingKeys = new Set();
        // Collect any existing keys (just in case)
        itemsBody.querySelectorAll('tr').forEach(tr=>{
          const k = (tr.querySelector('.in-pn')?.value || '').toString().toUpperCase();
          if (k) existingKeys.add(k);
        });
        items.forEach((item) => {
          const key = (item.pn || item.sku || '').toString().toUpperCase();
          if (key && existingKeys.has(key)) return; // skip duplicates
          addRowFromData({
            desc: item.name || "—",
            pn: item.pn || item.sku || "",
            unit: Number(item.price || 0),
            qty: Number(item.quantity || 1),
            manufacturer: item.manufacturer || "",
            image: item.image || ''
          });
          if (key) existingKeys.add(key);
          imported++;
        });
        if (imported > 0) {
          recalcTotals();
          updateEmptyState();
          showNotification(`تم استيراد ${imported} عنصر من صفحة البحث`, "success");
          saveState();
          // Clear pending items after import
          localStorage.removeItem('pendingQuoteItems');
        }
      } else {
        // لو مفيش pending items، جرّب تحميل العناصر اللى اتخزنت مؤقتًا من الشات
        const stagedRaw = localStorage.getItem(STAGED_KEY);
        const staged = stagedRaw ? JSON.parse(stagedRaw) : [];
        if (Array.isArray(staged) && staged.length) {
          let imported = 0;
          const existing = new Set();
          itemsBody.querySelectorAll('tr').forEach(tr=>{
            const k = (tr.querySelector('.in-pn')?.value || '').toString().toUpperCase();
            if (k) existing.add(k);
          });
          staged.forEach((it) => {
            const key = (it.PN_SKU || it.pn || it.sku || '').toString().toUpperCase();
            if (key && existing.has(key)) return; // avoid duplicates
            addRowFromData({
              desc: it.Name || it.name || "—",
              pn: it.PN_SKU || it.pn || it.sku || "",
              unit: num(it.UnitPrice || it.unitPrice || it.price || 0),
              qty: Number(it.Qty || it.qty || 1),
              manufacturer: it.manufacturer || it.brand || it.vendor || "",
              image: it.image || ''
            });
            if (key) existing.add(key);
            imported++;
          });
          if (imported > 0) {
            recalcTotals();
            updateEmptyState();
            showNotification(`تم استيراد ${imported} عنصر من صفحة الشات`, "success");
            // خزّن كمسوّدة فورًا حتى لا يحصل تكرار عند إعادة التحميل
            saveState();
          }
        }
        // Only add empty row if we still have no items at all
        if (itemsBody.querySelectorAll('tr').length === 0) {
          addRowFromData({ desc: "", pn: "", unit: 0, qty: 1 });
        }
      }
    } catch (err) {
      console.warn("Failed to auto-import staged items:", err);
      if (itemsBody.querySelectorAll('tr').length === 0){
        addRowFromData({ desc: "", pn: "", unit: 0, qty: 1 });
      }
    }
  }

  recalcTotals();
  updateEmptyState();

  // Load attached AI comparison if present
  try {
    const attRaw = localStorage.getItem('qiq_attached_comparison');
    if (attRaw) {
      const att = JSON.parse(attRaw);
      if (att && att.markdown) {
        const card = document.getElementById('ai-comparison-card');
        const content = document.getElementById('ai-comparison-content');
        if (card && content) {
          content.textContent = att.markdown;
          card.style.display = '';
        }
      }
    }
  } catch {}

  // ===== Events =====
  $("currency").addEventListener("change", async () => {
    currencyViewEl.textContent = getCurrency();
    await recalcTotals(); // Make it async
    saveState();
  });
  $("quote-date").addEventListener("change", () => {
    quoteDateViewEl.textContent = $("quote-date").value || todayISO();
    saveState();
  });
  ["client-name","client-contact","client-email","client-phone","project-name","project-owner","main-contractor","site-location"]
    .forEach(id => $(id).addEventListener("input", saveState));
  $("need-assist").addEventListener("change", saveState);

  $("payment-terms").addEventListener("input", saveState);
  $("terms").addEventListener("input", saveState);
  $("include-install").addEventListener("change", async () => { 
    await recalcTotals(); // Make it async
    saveState(); 
  });

  // Remove attachment
  document.getElementById('btn-remove-attachment')?.addEventListener('click', (e)=>{
    e.preventDefault();
    try { localStorage.removeItem('qiq_attached_comparison'); } catch {}
    const card = document.getElementById('ai-comparison-card');
    if (card) card.style.display = 'none';
  });

  // Theme toggle in topbar
  document.getElementById('themeToggleQuote')?.addEventListener('click', ()=>{
    try{
      const newTheme = window.QiqTheme?.toggle?.();
      const btn = document.getElementById('themeToggleQuote');
      if (btn) btn.textContent = (newTheme==='dark') ? '☀️' : '🌙';
    }catch{}
  });

  if ($("btn-add-row")) {
    $("btn-add-row").addEventListener("click", (e) => {
      e.preventDefault();
      addRowFromData({ desc: "", pn: "", unit: 0, qty: 1 });
      recalcTotals();
      showNotification("تمت إضافة بند جديد.", "success");
    });
  }

  $("btn-load-staged").addEventListener("click", (e) => {
    e.preventDefault();
    // دمج بدون مسح القديم
    try {
      const stagedRaw = localStorage.getItem(STAGED_KEY);
      if (!stagedRaw) return showNotification("لا يوجد عناصر Staged مخزنة", "error");
      const staged = JSON.parse(stagedRaw) || [];
      let loadedCount = 0;
      const existingKeys = new Set(
        Array.from(itemsBody.querySelectorAll('tr')).map(tr => tr.querySelector('.in-pn')?.value?.toUpperCase() || '')
      );
      staged.forEach((it) => {
        const pn = (it.PN_SKU || it.pn || it.sku || '').toString().toUpperCase();
        if (pn && existingKeys.has(pn)) return; // تجنب التكرار
        addRowFromData({
          desc: it.Name || it.name || "—",
          pn: it.PN_SKU || it.pn || it.sku || "",
          unit: num(it.UnitPrice || it.unitPrice || it.price || 0),
          qty: Number(it.Qty || it.qty || 1),
          manufacturer: it.manufacturer || it.brand || it.vendor || ""
        });
        if (pn) existingKeys.add(pn);
        loadedCount++;
      });
      recalcTotals();
      updateEmptyState();
      showNotification(`تم تحميل ${loadedCount} عنصر من الشات`, "success");
    } catch (err) {
      console.warn(err);
      showNotification("تعذر تحميل البنود من التخزين المحلي", "error");
    }
  });

  $("btn-generate").addEventListener("click", (e) => {
    e.preventDefault();
    recalcTotals();
  });

  $("btn-print").addEventListener("click", (e) => {
    e.preventDefault();
    if (!validateRequiredBeforePDF()) return;
    recalcTotals();
    logEvent('print-pdf', { currency: getCurrency() });
    window.print();
  });

  // Auto-print handler (when opened from account download)
  (function(){
    try{
      const u = new URL(window.location.href);
      if (u.searchParams.get('auto') === 'print') {
        // Attempt totals then trigger print after a short delay
        recalcTotals().then(()=>{
          setTimeout(()=> window.print(), 300);
        }).catch(()=>{
          setTimeout(()=> window.print(), 300);
        });
      }
    }catch{}
  })();

  $("btn-save").addEventListener("click", (e) => {
    e.preventDefault();
    // Require project name for better organization via modal
    if (!$("project-name").value.trim()){
      return openProjectInfoModal({ onDone: () => { saveState(true); showNotification("تم حفظ المسودة محليًا", "success"); } });
    }
    saveState(true);
    showNotification("تم حفظ المسودة محليًا", "success");
  });

  // Export PDF (pdfmake) — multi-page branded
  document.getElementById('btn-export-pdfmake')?.addEventListener('click', async (e)=>{
    e.preventDefault();
    if (!validateRequiredBeforePDF()) return;
    await recalcTotals();
    try{
      try{ await window.ensureArabicFonts?.(); }catch{}
      const payload = buildPayload({ reason: 'export-pdf' });
      // Auto-translate potentially Arabic fields to English via server (fallback to local filter inside API)
      try{
        const translateMap = {
          client_name: payload.client?.name||'',
          client_contact: payload.client?.contact||'',
          client_email: payload.client?.email||'',
          client_phone: payload.client?.phone||'',
          project_name: payload.project?.name||'',
          project_site: payload.project?.site||'',
          payment_terms: document.getElementById('payment-terms')?.value || '',
          terms: document.getElementById('terms')?.value || ''
        };
        // Include item descriptions (cap 100)
        const maxItems = Math.min((payload.items||[]).length, 100);
        for (let i=0;i<maxItems;i++){
          translateMap[`item_desc_${i}`] = payload.items[i]?.description || '';
        }
        const tRes = await fetch('/api/pdf-ai', { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ translate: translateMap }) });
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
            if (tr.payment_terms) document.getElementById('payment-terms').value = tr.payment_terms;
            if (tr.terms) document.getElementById('terms').value = tr.terms;
            // Map back item descriptions
            const max = Math.min((payload.items||[]).length, 100);
            for (let i=0;i<max;i++){
              const k = `item_desc_${i}`;
              if (tr[k]) payload.items[i].description = tr[k];
            }
          }
        }
      }catch{}
      // Collect live totals text from footer cells
      const totals = {
        subtotal: $("subtotal-cell").textContent,
        install: $("install-cell").textContent,
        grand: $("grand-cell").textContent
      };
  // Default to images ON if no preference saved
  const includeImages = !!document.getElementById('boq-images-toggle')?.checked;
  try{ localStorage.setItem('qiq_boq_images', includeImages ? '1' : '0'); }catch{}
      const itemsWithDataImages = [];
      if (includeImages) {
        // Cap to 100 images to avoid heavy PDFs
        for (let i=0; i<Math.min(payload.items.length, 100); i++){
          const it = payload.items[i];
          const durl = it.image ? await imageUrlToDataURL(it.image) : null;
          itemsWithDataImages.push({ ...it, _img: durl });
        }
      }
      const lines = (payload.items||[]).map((it,i)=>{
        const unit = Number(it.unit_price||0);
        const qty = Number(it.qty||1);
        const line = unit * qty;
        const maybeImg = includeImages ? (itemsWithDataImages[i]?._img || null) : null;
        const descText = englishOnly(it.description||'-');
        const brandText = englishOnly(it.brand||'');
        const availText = englishOnly(it.availability||'');
        const subLine = [brandText, availText].filter(Boolean).join(' • ');
        const pnText = englishOnly(it.pn||'');
        const specUrl = (it.spec_sheet || it.specsheet || '').toString();
        const specLink = specUrl ? { text:'Spec Sheet', link: specUrl, color:'#2563eb', style:'small' } : null;
        const descStack = maybeImg ? {
          columns:[
            { image: maybeImg, width: 24, height: 24, margin:[0,2,6,0] },
            { stack: [ { text: descText || '-' }, subLine ? { text: subLine, style:'small' } : null, specLink ].filter(Boolean) }
          ]
        } : { stack: [ { text: descText || '-' }, subLine ? { text: subLine, style:'small' } : null, specLink ].filter(Boolean) };
        return [
          { text: String(i+1), alignment:'right' },
          descStack,
          { text: pnText, alignment:'right' },
          { text: String(qty), alignment:'right' },
          { text: fmt(unit, payload.currency), alignment:'right' },
          { text: fmt(line, payload.currency), alignment:'right' },
        ];
      });

      // Try embedding logo
      const logoDataUrl = await imageUrlToDataURL(logoEl?.src);

      // Fetch AI-generated titles/headings and product details
      let ai = null;
      try{
        // Prepare optional media/link context for AI provider routing (Gemini for media)
        const allImgs = (payload.items||[]).map(it => it?.image || '').filter(Boolean);
        const allLinks = (payload.items||[]).map(it => it?.link || '').filter(Boolean);
        const pdfLinks = allLinks.filter(u => /\.pdf(\?|#|$)/i.test(u));
        const imageUrls = Array.from(new Set(allImgs)).slice(0,5);
        const webUrls   = Array.from(new Set(allLinks)).slice(0,5);
        const pdfUrls   = Array.from(new Set(pdfLinks)).slice(0,3);
        const r = await fetch('/api/pdf-ai', {
          method:'POST', headers:{'content-type':'application/json'},
          body: JSON.stringify({ client: payload.client, project: payload.project, items: payload.items, currency: payload.currency, imageUrls, webUrls, pdfUrls })
        });
        const j = await r.json();
        ai = j?.data || null;
        if (j?.provider) console.info('PDF AI provider:', j.provider, j?.note?`(${j.note})`:'' );
      }catch{}
      const headings = ai?.headings || { letter:'Cover Letter', boq:'Bill of Quantities', terms:'Terms & Conditions', productDetails:'Product Details' };
      const coverTitle = englishOnly(ai?.coverTitle || 'Quotation');
      const coverSubtitle = englishOnly(ai?.coverSubtitle || '');
      const letterEn = englishOnly(ai?.letter?.en || '');
      const letterBlocks = letterEn ? [ { text: letterEn } ] : [
        { text: `Dear ${englishOnly(payload.client?.contact || 'Sir/Madam')},\n\nThank you for the opportunity to submit our quotation for ${englishOnly(payload.project?.name || 'your project')}.` }
      ];

      const dd = {
        info: { title: `Quotation ${payload.number}` },
        pageMargins: [36, 84, 36, 48],
        defaultStyle: { fontSize: 10, lineHeight: 1.2, font: (window.pdfMake?.fonts && window.pdfMake.fonts.Roboto) ? 'Roboto' : undefined },
        header: function(currentPage, pageCount){
          // Hide small header logo on the first page to avoid overlap with cover content
          if (currentPage === 1) {
            return { text: '', margin: [36, 20, 36, 0] };
          }
          return {
            columns: [
              logoDataUrl ? { image: logoDataUrl, width: 80 } : { text: 'QuickITQuote', style: 'small' },
              { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', style: 'small' }
            ],
            // Increased bottom margin to push content down so it doesn't sit under the logo
            margin: [36, 20, 36, 12]
          };
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
          return { columns:[
            { text: 'QuickITQuote', style:'small' },
            { text: `Page ${currentPage} of ${pageCount}`, alignment:'right', style:'small' }
          ], margin:[36, 8, 36, 0] };
        },
        content: [
          // Cover Page
          { tocItem: true, text: 'Cover', style: 'h2' },
          {
            columns: [
              logoDataUrl ? { image: logoDataUrl, width: 140, margin:[0,0,0,12] } : { text: 'QuickITQuote', style:'title' },
              {
                alignment: 'right',
                stack: [
                  { text: coverTitle, style:'title' },
                  { text: `Number: ${payload.number}`, style:'subtitle' },
                  { text: `Date: ${payload.date}` , style:'subtitle' },
                  { text: `Currency: ${payload.currency}`, style:'subtitle' }
                ]
              }
            ], margin:[0,0,0,12]
          },
          coverSubtitle ? { text: coverSubtitle, style:'subtitle', margin:[0,0,0,8] } : null,
          { canvas:[{ type:'line', x1:0, y1:0, x2:515, y2:0, lineWidth:1, lineColor:'#e5e7eb' }] , margin:[0,8,0,12] },
          {
            columns:[
              { width:'*', stack:[
                { text:'Client', style:'h3' },
                { text: englishOnly(payload.client?.name || '') },
                { text: englishOnly(payload.client?.contact || '') },
                { text: englishOnly(payload.client?.email || '') },
                { text: englishOnly(payload.client?.phone || '') }
              ]},
              { width:'*', stack:[
                { text:'Project', style:'h3' },
                { text: englishOnly(payload.project?.name || '') },
                { text: englishOnly(payload.project?.site || '') },
                { text: englishOnly(payload.project?.execution_date || '') }
              ]}
            ]
          },
          { text:'', pageBreak:'after' },

          // Table of Contents
          { toc: { title: { text:'Table of Contents', style:'tocTitle' } } },
          { text:'', pageBreak:'after' },

          // Letter
          { tocItem:true, text: englishOnly(headings.letter || 'Cover Letter'), style:'h2' },
          { stack: letterBlocks, margin:[0,0,0,12] },
          { text:'Summary', style:'h3' },
          { ul:[
            `Subtotal: ${totals.subtotal}`,
            (payload.include_installation_5pct ? `Installation/Services: ${totals.install}` : null),
            `Grand Total: ${totals.grand}`
          ].filter(Boolean) },
          { text:'', pageBreak:'after' },

          // BOQ
          { tocItem:true, text: englishOnly(headings.boq || 'Bill of Quantities'), style:'h2' },
          {
            table:{
              headerRows:1,
              widths:['auto','*','auto','auto','auto','auto'],
              body:[
                [
                  {text:'#',style:'tableHeader', alignment:'right'},
                  {text:'Description',style:'tableHeader'},
                  {text:'PN',style:'tableHeader', alignment:'right'},
                  {text:'Qty',style:'tableHeader', alignment:'right'},
                  {text:'Unit',style:'tableHeader', alignment:'right'},
                  {text:'Line',style:'tableHeader', alignment:'right'}
                ],
                ...lines
              ]
            },
            layout: {
              fillColor: function (rowIndex, node, columnIndex) {
                if (rowIndex === 0) return '#f3f4f6';
                return (rowIndex % 2 === 0) ? '#fafafa' : null;
              },
              hLineColor: '#e5e7eb', vLineColor: '#e5e7eb'
            }
          },
          { text:'', pageBreak:'after' },

          // Product details (table with images, brand, availability)
          { tocItem:true, text: englishOnly(headings.productDetails || 'Product Details'), style:'h2' },
          {
            table:{
              headerRows:1,
              widths: includeImages ? ['auto','*','auto','auto'] : ['*','auto','auto'],
              body:[
                includeImages ? [ {text:'Image',style:'tableHeader'}, {text:'Description',style:'tableHeader'}, {text:'Brand',style:'tableHeader'}, {text:'Availability',style:'tableHeader'} ]
                              : [ {text:'Description',style:'tableHeader'}, {text:'Brand',style:'tableHeader'}, {text:'Availability',style:'tableHeader'} ],
                ...((payload.items||[]).map((it, idx)=>{
                  const img = includeImages ? (itemsWithDataImages[idx]?._img || null) : null;
                  const desc = englishOnly(it.description||'-');
                  const pn   = englishOnly(it.pn||'');
                  const brand= englishOnly(it.brand||'');
                  const avail= englishOnly(it.availability||'');
                  const specUrl = (it.spec_sheet || it.specsheet || '').toString();
                  const specLink = specUrl ? { text:'Spec Sheet', link: specUrl, color:'#2563eb', style:'small' } : null;
                  const descCell = { stack:[ { text: desc }, pn ? { text:`PN: ${pn}`, style:'small' } : null, specLink ].filter(Boolean) };
                  return includeImages
                    ? [ img ? { image: img, width:28, height:28, margin:[0,2,6,0] } : { text:'' }, descCell, { text: brand||'-' }, { text: avail||'-' } ]
                    : [ descCell, { text: brand||'-' }, { text: avail||'-' } ];
                }))
              ]
            },
            layout: { hLineColor:'#e5e7eb', vLineColor:'#e5e7eb' }
          },
          { text:'', margin:[0,6,0,0] },
          ...(ai?.products || []).flatMap(p => {
            const t = englishOnly(p.title || '');
            const bullets = Array.isArray(p.bullets) ? p.bullets.map(b=>englishOnly(b)).filter(Boolean) : [];
            return ([ { text: t, style:'h3' }, bullets.length ? { ul: bullets } : { text:'', margin:[0,0,0,0] } ]);
          }),
          { text:'', pageBreak:'after' },

          // Terms
          { tocItem:true, text: englishOnly(headings.terms || 'Terms & Conditions'), style:'h2' },
          { text:'Payment Terms', style:'h3' },
          { text: englishOnly($("payment-terms").value || ''), margin:[0,0,0,8] },
          { text:'Terms & Conditions', style:'h3' },
          { text: englishOnly($("terms").value || '') },

          // High-branding proposal pages at the end (AI-assisted)
          { text:'', pageBreak:'after' },
          { tocItem:true, text:'Proposal', style:'h2' },
          { stack:[
              { canvas:[{ type:'rect', x:0, y:0, w:515, h:40, color:'#2563eb' }] , margin:[0,0,0,12] },
              { text: englishOnly(ai?.proposal?.title || 'QuickITQuote — Solution Proposal'), style:'h3' },
              ...(Array.isArray(ai?.proposal?.sections) && ai.proposal.sections[0] ?
                [ { text: englishOnly(ai.proposal.sections[0].heading || 'Overview'), style:'h3' },
                  ...(ai.proposal.sections[0].paragraphs||[]).map(s=>({ text: englishOnly(s), margin:[0,0,0,6] })) ]
                : [ { text:'We deliver IT supply, installation, and support services tailored to your project with fast lead times and professional warranty.', margin:[0,0,0,6] } ])
            ]
          },
          { text:'', pageBreak:'after' },
          { stack:[
              { canvas:[{ type:'rect', x:0, y:0, w:515, h:40, color:'#2563eb' }] , margin:[0,0,0,12] },
              ...(Array.isArray(ai?.proposal?.sections) && ai.proposal.sections[1] ?
                [ { text: englishOnly(ai.proposal.sections[1].heading || 'Services'), style:'h3' },
                  ...(ai.proposal.sections[1].paragraphs||[]).map(s=>({ text: englishOnly(s), margin:[0,0,0,6] })) ]
                : [ { text:'Services we can provide', style:'h3' }, { ul:[ 'Supply & Installation', 'Maintenance Contracts', 'Network & Security', 'Cloud & Productivity', 'Support & Training' ] } ])
            ]
          }
        ].filter(Boolean)
      };

      window.pdfMake?.createPdf(dd).download(`${payload.number || 'quotation'}.pdf`);
      try{ window.QiqToast?.success?.('تم إنشاء PDF', 2000);}catch{}
    }catch(err){ console.warn(err); try{ window.QiqToast?.error?.('تعذر إنشاء PDF', 2000);}catch{} }
  });

  const savePdfAccountBtn = $("btn-save-pdf-account");
  if (savePdfAccountBtn){
    savePdfAccountBtn.addEventListener("click", async (e)=>{
      e.preventDefault();
      if (!validateRequiredBeforePDF()) return;
      // Require login
      const token = localStorage.getItem('qiq_token');
      if (!token){
        showNotification("يرجى تسجيل الدخول أولاً لحفظ PDF في حسابك.", 'error');
        // Optionally open /account.html in modal
        try { window.QiqModal ? QiqModal.open('/account.html', {title:'تسجيل الدخول'}) : window.open('/account.html','_blank'); } catch {}
        return;
      }
      try{
        // Ensure project name exists using modal first
        if (!$("project-name").value.trim()){
          return openProjectInfoModal({ onDone: async () => {
            if (!validateRequiredBeforePDF()) return; 
            await handleSaveToAccount();
          }});
        }
        if (!validateRequiredBeforePDF()) return;
        await handleSaveToAccount();
      }catch(err){
        console.warn(err);
        showNotification('تعذر الحفظ في الحساب.', 'error');
      }
    });
  }

  $("btn-request-special").addEventListener("click", async (e) => {
    e.preventDefault();
    const payload = buildPayload({ reason: "special-price" });
    showPayloadPreview(payload);
    setLoadingState(e.target, true);
    try {
      // Create lead first in HelloLeads
      try{
        const leadRes = await fetch('/api/hello-leads', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) });
        const leadJson = await leadRes.json().catch(()=>({}));
        console.info('HelloLeads:', leadRes.status, leadJson?.ok); // non-blocking
      }catch{}
      const r = await fetch("/api/special-quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (r.ok) {
        showNotification("تم إرسال طلب السعر المُخصّص. سنتواصل معك للتحقق", "success");
      } else {
        showNotification("تعذر الإرسال (API)", "error");
      }
    } catch (err) {
      showNotification("تعذر الاتصال بالخادم", "error");
    } finally {
      setLoadingState(e.target, false);
    }
  });

  // Request Maintenance Contract
  $("btn-request-maintenance").addEventListener("click", async (e) => {
    e.preventDefault();
    const payload = buildPayload({ reason: "maintenance-request" });
    // Trim payload: include items minimally, client, project, and meta
    const slim = {
      client: payload.client,
      project: payload.project,
      items: payload.items.map(it => ({ description: it.description, pn: it.pn, qty: it.qty })),
      meta: { number: payload.number, date: payload.date, currency: payload.currency }
    };
    setLoadingState(e.target, true);
    try {
      const r = await fetch('/api/maintenance', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(slim) });
      if (r.ok) {
        showNotification('تم إرسال طلب عقد الصيانة. سنتواصل معك قريبًا.', 'success');
      } else {
        showNotification('تعذر إرسال طلب عقد الصيانة.', 'error');
      }
    } catch(err){
      showNotification('تعذر الاتصال بالخادم', 'error');
    } finally {
      setLoadingState(e.target, false);
    }
  });

  $("btn-submit").addEventListener("click", async (e) => {
    e.preventDefault();
    const payload = buildPayload({ reason: "standard-quote" });
    showPayloadPreview(payload);
    setLoadingState(e.target, true);
    try {
      // Create lead first in HelloLeads
      try{
        const leadRes = await fetch('/api/hello-leads', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) });
        const leadJson = await leadRes.json().catch(()=>({}));
        console.info('HelloLeads:', leadRes.status, leadJson?.ok); // non-blocking
      }catch{}
      const r = await fetch("/api/special-quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (r.ok) {
        showNotification("تم إرسال طلب عرض السعر بنجاح", "success");
      } else {
        showNotification("تعذر الإرسال (API)", "error");
      }
    } catch (err) {
      showNotification("تعذر الاتصال بالخادم", "error");
    } finally {
      setLoadingState(e.target, false);
    }
  });

  // ===== New Event Handlers =====
  
  // Proceed to Request Quote CTA
  const proceedBtn = $("btn-proceed-quote");
  if (proceedBtn) {
    proceedBtn.addEventListener("click", (e) => {
      e.preventDefault();
      // Scroll to the actions section
      const actionsSection = document.querySelector(".card.no-print");
      if (actionsSection) {
        actionsSection.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      showNotification("Complete the client details above, then submit your quote request.", "info");
    });
  }
  
  // Clear All Button
  $("btn-clear-all").addEventListener("click", (e) => {
    e.preventDefault();
    if (confirmAction("هل أنت متأكد من حذف جميع البنود؟ هذا الإجراء لا يمكن التراجع عنه.")) {
      const tbody = $("items-body");
      tbody.innerHTML = '';
      addRowFromData({ desc: "", pn: "", unit: 0, qty: 1 }); // Add one empty row
      recalcTotals();
      saveState();
      updateEmptyState();
  showNotification("أضِف منتجات لبدء عرض السعر.", "info");
    }
  });

  // Export Excel Button
  $("btn-export-excel").addEventListener("click", (e) => {
    e.preventDefault();
    setLoadingState(e.target, true);
    try {
      exportToExcel();
      showNotification("تم تصدير الملف بنجاح", "success");
    } catch (error) {
      showNotification("حدث خطأ أثناء التصدير", "error");
    } finally {
      setLoadingState(e.target, false);
    }
  });

  // Export CSV Button
  $("btn-export-csv").addEventListener("click", (e) => {
    e.preventDefault();
    setLoadingState(e.target, true);
    try {
      exportToCSV();
      showNotification("تم تصدير الملف بنجاح", "success");
    } catch (error) {
      showNotification("حدث خطأ أثناء التصدير", "error");
    } finally {
      setLoadingState(e.target, false);
    }
  });

  // Import Excel Button
  $("btn-import-excel").addEventListener("click", (e) => {
    e.preventDefault();
    $("excel-file-input").click();
  });

  $("excel-file-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      setLoadingState($("btn-import-excel"), true);
      importFromExcel(file);
    }
  });

  // Search functionality
  $("search-input").addEventListener("input", (e) => {
    filterTable(e.target.value);
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey) {
      switch(e.key.toLowerCase()) {
        case 'e':
          e.preventDefault();
          $("btn-export-excel").click();
          break;
        case 's':
          e.preventDefault();
          $("btn-save").click();
          break;
        case 'p':
          e.preventDefault();
          $("btn-print").click();
          break;
      }
    }
  });

  // ===== Enhanced Functions =====
  function addRowFromData({ desc, pn, unit, qty, manufacturer, brand, image, spec_sheet }) {
    const tr = document.createElement("tr");
    const id = `row-${uid()}`;
    tr.id = id;
    tr.dataset.basePrice = unit || 0; // Store base price in USD

    // Create the enhanced product description combining name, brand, and PN
    const productName = desc || "";
  const productBrand = manufacturer || brand || "";
  const productImg = image || '';
  const productSpec = spec_sheet || '';
    const productPN = pn || "";
    
    let descriptionHTML = `<div class="product-desc">`;
    descriptionHTML += `<span class="product-name">${esc(productName)}</span>`;
    
    if (productBrand || productPN) {
      descriptionHTML += `<div class="product-details">`;
      if (productBrand && productPN) {
        descriptionHTML += `<span class="product-pn">(PN: ${esc(productPN)})</span> - <span class="product-brand">${esc(productBrand)}</span>`;
      } else if (productBrand) {
        descriptionHTML += `<span class="product-brand">${esc(productBrand)}</span>`;
      } else if (productPN) {
        descriptionHTML += `<span class="product-pn">PN: ${esc(productPN)}</span>`;
      }
      if (productSpec) {
        descriptionHTML += ` <a class="qiq-spec" href="${esc(productSpec)}" target="_blank" rel="noopener" title="Spec Sheet" aria-label="Spec Sheet" style="margin-left:6px;display:inline-flex;align-items:center;color:#2563eb">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <text x="7" y="17" font-size="8" fill="#dc2626" font-family="sans-serif">PDF</text>
          </svg>
        </a>`;
      }
      descriptionHTML += `</div>`;
    }
    descriptionHTML += `</div>`;
    
    tr.innerHTML = `
      <td class="desc-col">
        <div class="desc-flex">
          ${productImg ? `<img class="thumb" src="${esc(productImg)}" alt="thumb" onclick="openImagePreview('${esc(productImg)}')" onerror="this.style.display='none'"/>` : ''}
          ${descriptionHTML}
        </div>
        <input class="in-desc" type="hidden" value="${esc(desc)}" />
        <input class="in-pn" type="hidden" value="${esc(pn)}" />
        <input class="in-brand" type="hidden" value="${esc(productBrand)}" />
        <input class="in-image" type="hidden" value="${esc(productImg)}" />
        <input class="in-spec" type="hidden" value="${esc(productSpec)}" />
      </td>
      <td class="qty-col">
        <input class="in-qty qty-input" type="number" min="1" step="1" value="${Number(qty)||1}">
      </td>
      <td class="price-col numeric">
        <span class="unit-text">${fmt(Number(unit)||0)}</span>
        <input class="in-unit" type="hidden" value="${Number(unit)||0}">
      </td>
      <td class="total-col numeric line-total">-</td>
      <td class="actions-col no-print">
        <div class="action-icons">
          <button class="action-btn delete btn-del" title="Remove this item" type="button">🗑️</button>
        </div>
      </td>
    `;
    
    itemsBody.appendChild(tr);

    const inUnit = tr.querySelector(".in-unit");
    const inQty = tr.querySelector(".in-qty");
    const inputs = tr.querySelectorAll("input");
    inputs.forEach(inp => inp.addEventListener("input", () => { 
      recalcTotals(); 
      saveState();
      updateEmptyState();
    }));

    tr.querySelector(".btn-del").addEventListener("click", (e) => {
      e.preventDefault();
      const productName = tr.querySelector(".product-name")?.textContent || "Product";
      if (confirmAction(`هل أنت متأكد من حذف "${productName}"؟`)) {
        tr.remove();
        recalcTotals();
        saveState();
        updateEmptyState();
        showNotification("Product removed.", "success");
      }
    });
    
    // duplicate/edit removed: only qty and delete allowed

    updateEmptyState();
  }

  function editProductInline(tr) {
    const descCell = tr.querySelector(".desc-col");
    const currentDesc = tr.querySelector(".in-desc").value;
    const currentPN = tr.querySelector(".in-pn").value;
    const currentBrand = tr.querySelector(".in-brand").value;
    
    // Create inline editing form
    descCell.innerHTML = `
      <div class="inline-edit">
        <input class="edit-desc" placeholder="Product description" value="${esc(currentDesc)}" style="width:100%;margin-bottom:4px;padding:4px;border:1px solid #d1d5db;border-radius:4px;">
        <input class="edit-brand" placeholder="Brand/Manufacturer" value="${esc(currentBrand)}" style="width:100%;margin-bottom:4px;padding:4px;border:1px solid #d1d5db;border-radius:4px;font-size:12px;">
        <input class="edit-pn" placeholder="Part Number (PN)" value="${esc(currentPN)}" style="width:100%;margin-bottom:8px;padding:4px;border:1px solid #d1d5db;border-radius:4px;font-size:12px;">
        <div style="display:flex;gap:4px;">
          <button class="btn-save" style="background:#059669;color:white;border:none;padding:4px 8px;border-radius:4px;font-size:11px;cursor:pointer;">💾 Save</button>
          <button class="btn-cancel" style="background:#6b7280;color:white;border:none;padding:4px 8px;border-radius:4px;font-size:11px;cursor:pointer;">❌ Cancel</button>
        </div>
      </div>
    `;
    
    const saveBtn = descCell.querySelector(".btn-save");
    const cancelBtn = descCell.querySelector(".btn-cancel");
    
    const saveEdit = () => {
      const newDesc = descCell.querySelector(".edit-desc").value;
      const newBrand = descCell.querySelector(".edit-brand").value;
      const newPN = descCell.querySelector(".edit-pn").value;
      
      // Update hidden inputs
      tr.querySelector(".in-desc").value = newDesc;
      tr.querySelector(".in-pn").value = newPN;
      tr.querySelector(".in-brand").value = newBrand;
      
      // Rebuild the description display
      rebuildDescriptionDisplay(tr);
      saveState();
      showNotification("Product updated successfully!", "success");
    };
    
    const cancelEdit = () => {
      rebuildDescriptionDisplay(tr);
    };
    
    saveBtn.addEventListener("click", saveEdit);
    cancelBtn.addEventListener("click", cancelEdit);
    
    // Focus on description input
    descCell.querySelector(".edit-desc").focus();
  }

  function rebuildDescriptionDisplay(tr) {
    const descCell = tr.querySelector(".desc-col");
    const desc = tr.querySelector(".in-desc").value;
    const pn = tr.querySelector(".in-pn").value;
    const brand = tr.querySelector(".in-brand").value;
  const img = tr.querySelector(".in-image")?.value || '';
  const spec = tr.querySelector(".in-spec")?.value || '';
    
    let descriptionHTML = `<div class="product-desc">`;
    descriptionHTML += `<span class="product-name">${esc(desc)}</span>`;
    
    if (brand || pn) {
      descriptionHTML += `<div class="product-details">`;
      if (brand && pn) {
        descriptionHTML += `<span class="product-pn">(PN: ${esc(pn)})</span> - <span class="product-brand">${esc(brand)}</span>`;
      } else if (brand) {
        descriptionHTML += `<span class="product-brand">${esc(brand)}</span>`;
      } else if (pn) {
        descriptionHTML += `<span class="product-pn">PN: ${esc(pn)}</span>`;
      }
      if (spec) {
        descriptionHTML += ` <a class="qiq-spec" href="${esc(spec)}" target="_blank" rel="noopener" title="Spec Sheet" aria-label="Spec Sheet" style="margin-left:6px;display:inline-flex;align-items:center;color:#2563eb">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <text x="7" y="17" font-size="8" fill="#dc2626" font-family="sans-serif">PDF</text>
          </svg>
        </a>`;
      }
      descriptionHTML += `</div>`;
    }
    descriptionHTML += `</div>`;
    
    // Keep the hidden inputs
    descriptionHTML += `
      <input class="in-desc" type="hidden" value="${esc(desc)}" />
      <input class="in-pn" type="hidden" value="${esc(pn)}" />
      <input class="in-brand" type="hidden" value="${esc(brand)}" />
      <input class="in-spec" type="hidden" value="${esc(spec)}" />
    `;
    
    descCell.innerHTML = `
      <div class="desc-flex">
        ${img ? `<img class="thumb" src="${esc(img)}" alt="thumb" onclick="openImagePreview('${esc(img)}')" onerror="this.style.display='none'"/>` : ''}
        ${descriptionHTML}
      </div>
      <input class="in-desc" type="hidden" value="${esc(desc)}" />
      <input class="in-pn" type="hidden" value="${esc(pn)}" />
      <input class="in-brand" type="hidden" value="${esc(brand)}" />
      <input class="in-image" type="hidden" value="${esc(img)}" />
    `;
  }

  // ===== Currency Conversion =====
  let ratesCache = {};
  const RATES_CACHE_KEY = 'qiq_rates_cache_v1';
  const RATES_TTL_MS = 24 * 60 * 60 * 1000; // 24h
  // Load cached rates from localStorage
  (function(){
    try{
      const raw = localStorage.getItem(RATES_CACHE_KEY);
      if (raw){
        const obj = JSON.parse(raw);
        if (obj && obj.data && obj.savedAt && (Date.now() - obj.savedAt) < RATES_TTL_MS){
          ratesCache = obj.data || {};
        }
      }
    }catch{}
  })();
  const getExchangeRate = async (from, to) => {
    if (from === to) return 1;
    const rateKey = `${from}_${to}`;
    if (ratesCache[rateKey]) return ratesCache[rateKey];

    try {
      const response = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${from.toLowerCase()}.json`);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      const rate = data[from.toLowerCase()][to.toLowerCase()];
      if (!rate) throw new Error(`Rate for ${to} not found`);
      ratesCache[rateKey] = rate;
      try{ localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({ data: ratesCache, savedAt: Date.now() })); }catch{}
      return rate;
    } catch (error) {
      console.error("Could not fetch exchange rate:", error);
      showNotification(`Could not fetch exchange rate for ${to}. Using 1:1.`, 'error');
      // Fallback: if we have any cached previous rate for this pair, use it; else 1
      if (ratesCache[rateKey]) return ratesCache[rateKey];
      return 1;
    }
  };

  // Helper: find the install (professional service) row if any
  // (removed) install-as-row logic — we'll compute installation as a separate footer amount

  // ===== Recalculate Totals =====
  async function recalcTotals() {
    const toCurrency = getCurrency();
    const rate = await getExchangeRate('USD', toCurrency); // USD → selected currency

    // 1) Convert all item rows to selected currency and compute per-line totals
    let subtotalConverted = 0;
    itemsBody.querySelectorAll('tr').forEach((row)=>{
      const unitEl = row.querySelector('.in-unit');
      const qtyEl = row.querySelector('.in-qty');
      const totalEl = row.querySelector('.line-total');
      if(!unitEl || !qtyEl || !totalEl) return;
      const unitUSD = num(row.dataset.basePrice || unitEl.value);
      const qty = num(qtyEl.value);
      const unitConverted = unitUSD * rate;
      unitEl.value = unitConverted.toFixed(2);
      const unitText = row.querySelector('.unit-text');
      if (unitText) unitText.textContent = fmt(unitConverted, toCurrency);
      const line = unitConverted * qty;
      totalEl.textContent = fmt(line, toCurrency);
      subtotalConverted += line;
    });

    // 2) Optional installation: if subtotal (USD) < 4000 then flat $200; else 5% — converted to target currency
    let installAmount = 0;
    if ($("include-install").checked) {
      // Calculate against USD base to keep consistent thresholds
      const subtotalUSD = subtotalConverted / rate;
      const baseInstallUSD = subtotalUSD < 4000 ? 200 : (subtotalUSD * 0.05);
      installAmount = baseInstallUSD * rate;
    }

    // 3) Footer totals
    subtotalCell.textContent = fmt(subtotalConverted, toCurrency);
    installCell.textContent = fmt(installAmount, toCurrency);
    grandCell.textContent = fmt(subtotalConverted + installAmount, toCurrency);
  }

  function buildPayload(extra) {
    const items = [];
    itemsBody.querySelectorAll("tr").forEach(tr => {
      items.push({
        description: tr.querySelector(".in-desc")?.value || "",
        pn: tr.querySelector(".in-pn")?.value || "",
        unit_price: num(tr.querySelector(".in-unit")?.value),
        qty: Math.max(1, parseInt(tr.querySelector(".in-qty")?.value || "1", 10)),
        image: tr.querySelector(".in-image")?.value || "",
        brand: tr.querySelector(".in-brand")?.value || "",
        spec_sheet: tr.querySelector(".in-spec")?.value || ""
      });
    });
    const payload = {
      kind: extra?.reason || "standard-quote",
      number: quoteNoEl.textContent,
      date: $("quote-date").value || todayISO(),
      currency: getCurrency(),
      client: {
        name: $("client-name").value || "",
        contact: $("client-contact").value || "",
        email: $("client-email").value || "",
        phone: $("client-phone").value || ""
      },
      project: {
        name: $("project-name").value || "",
        requester_role: $("requester-role")?.value || "",
        owner: $("project-owner").value || "",
        main_contractor: $("main-contractor").value || "",
        site: $("site-location").value || "",
        execution_date: $("execution-date")?.value || "",
        expected_closing_date: $("expected-close")?.value || ""
      },
      need_assist: $("need-assist").checked,
      payment_terms: $("payment-terms").value || "",
      terms: $("terms").value || "",
      include_installation_5pct: $("include-install").checked,
      items
    };
    return payload;
  }

  function showPayloadPreview(payload) {
    try { $("payload-preview").textContent = JSON.stringify(payload, null, 2); } catch {}
  }

  function saveState(notify) {
    const items = [];
    itemsBody.querySelectorAll("tr").forEach(tr => {
      items.push({
        desc: tr.querySelector(".in-desc")?.value || "",
        pn: tr.querySelector(".in-pn")?.value || "",
        unit: num(tr.querySelector(".in-unit")?.value),
        qty: Math.max(1, parseInt(tr.querySelector(".in-qty")?.value || "1", 10)),
        image: tr.querySelector(".in-image")?.value || "",
        brand: tr.querySelector(".in-brand")?.value || "",
        spec_sheet: tr.querySelector(".in-spec")?.value || ""
      });
    });
    
    const s = {
      number: quoteNoEl.textContent,
      date: $("quote-date").value || todayISO(),
      currency: getCurrency(),
      logo: logoEl.src,
      client_name: $("client-name").value || "",
      client_contact: $("client-contact").value || "",
      client_email: $("client-email").value || "",
      client_phone: $("client-phone").value || "",
      project_name: $("project-name").value || "",
    requester_role: $("requester-role")?.value || "",
      project_owner: $("project-owner").value || "",
      main_contractor: $("main-contractor").value || "",
      site_location: $("site-location").value || "",
    execution_date: $("execution-date")?.value || "",
    expected_close: $("expected-close")?.value || "",
      need_assist: $("need-assist").checked,
      payment_terms: $("payment-terms").value || "",
      terms: $("terms").value || "",
      include_install: $("include-install").checked,
      items,
      // Enhanced draft metadata
      lastModified: new Date().toISOString(),
      userToken: localStorage.getItem("qiq_token") || null,
      isDraft: true,
      version: 1
    };
    
  // Save to localStorage (local draft)
  localStorage.setItem(STATE_KEY, JSON.stringify(s));
    // Also save to a separate drafts collection for the user
    saveDraftToCollection(s);
    
    if (notify) {
      console.log("Saved.");
    }
  }
  function saveDraftToCollection(quoteData) {
    try {
      const userToken = localStorage.getItem("qiq_token");
      if (!userToken) return; // Only save drafts for logged-in users
      
      const draftsKey = `qiq_drafts_${userToken.slice(-10)}`; // Use last 10 chars of token as key
      let drafts = [];
      try {
        drafts = JSON.parse(localStorage.getItem(draftsKey) || "[]");
      } catch { drafts = []; }
      
      // Find existing draft by quote number or create new
      const existingIndex = drafts.findIndex(d => d.number === quoteData.number);
      const draftData = {
        ...quoteData,
        id: existingIndex >= 0 ? drafts[existingIndex].id : uid(),
        lastModified: new Date().toISOString()
      };
      
      if (existingIndex >= 0) {
        drafts[existingIndex] = draftData;
      } else {
        drafts.unshift(draftData); // Add to beginning
      }
      
      // Keep only last 10 drafts
      if (drafts.length > 10) {
        drafts = drafts.slice(0, 10);
      }
      
      localStorage.setItem(draftsKey, JSON.stringify(drafts));
    } catch (error) {
      console.warn("Failed to save draft to collection:", error);
    }
  }

  // Simple local log for important events
  function logEvent(kind, details){
    try{
      const key = 'qiq_quote_events';
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.unshift({ kind, details, at: new Date().toISOString(), number: quoteNoEl.textContent });
      if (arr.length > 100) arr.length = 100;
      localStorage.setItem(key, JSON.stringify(arr));
    }catch{}
  }

  // Function to load user drafts
  function loadUserDrafts() {
    try {
      const userToken = localStorage.getItem("qiq_token");
      if (!userToken) return [];
      
      const draftsKey = `qiq_drafts_${userToken.slice(-10)}`;
      return JSON.parse(localStorage.getItem(draftsKey) || "[]");
    } catch {
      return [];
    }
  }

  // Function to load a specific draft
  function loadDraft(draftId) {
    const drafts = loadUserDrafts();
    const draft = drafts.find(d => d.id === draftId);
    if (draft) {
      // Load the draft data into the form
      restoreState(draft);
      showNotification("تم تحميل المسودة بنجاح", "success");
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function restoreState(state) {
    if (!state) return;
    
    try {
      // Restore form fields
      if (state.client_name) $("client-name").value = state.client_name;
      if (state.client_contact) $("client-contact").value = state.client_contact;
      if (state.client_email) $("client-email").value = state.client_email;
      if (state.client_phone) $("client-phone").value = state.client_phone;
      if (state.project_name) $("project-name").value = state.project_name;
    if (state.requester_role && document.getElementById('requester-role')) document.getElementById('requester-role').value = state.requester_role;
      if (state.project_owner) $("project-owner").value = state.project_owner;
      if (state.main_contractor) $("main-contractor").value = state.main_contractor;
      if (state.site_location) $("site-location").value = state.site_location;
  if (state.quote_date) $("quote-date").value = state.quote_date;
  if (state.execution_date) $("execution-date").value = state.execution_date;
    if (state.expected_close && document.getElementById('expected-close')) document.getElementById('expected-close').value = state.expected_close;
      if (state.currency) $("currency").value = state.currency;
      if (state.payment_terms) $("payment-terms").value = state.payment_terms;
      if (state.terms) $("terms").value = state.terms;
      
      $("need-assist").checked = !!state.need_assist;
      $("include-install").checked = !!state.include_install;
      
      // Restore quote number
      if (state.number) quoteNoEl.textContent = state.number;
      
      // Clear existing items and restore saved items
      itemsBody.innerHTML = '';
      if (state.items && Array.isArray(state.items)) {
        state.items.forEach(item => {
          if (item.desc || item.pn) {
            addRowFromData({ desc: item.desc, pn: item.pn, unit: item.unit, qty: item.qty, image: item.image, brand: item.brand, manufacturer: item.manufacturer });
          }
        });
      }
      
      recalcTotals();
      showNotification("تم استعادة البيانات المحفوظة", "info");
    } catch (error) {
      console.error("Error restoring state:", error);
      showNotification("خطأ في استعادة البيانات المحفوظة", "error");
    }
  }

  function num(v) {
    return Number(String(v || "0").replace(/[^\d.]/g, "")) || 0;
    // (ملاحظة) لو محتاج تدعم فواصل عربية، أضف استبدالات إضافية.
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  // Validate required fields before generating PDF or saving to account
  function validateRequiredBeforePDF(){
    const required = [
      {id:'project-name', label:'اسم المشروع'},
      {id:'requester-role', label:'صفة الطالب'},
      {id:'execution-date', label:'موعد التنفيذ المتوقع'},
      {id:'expected-close', label:'موعد الإغلاق المتوقع'},
      {id:'client-contact', label:'الشخص المسؤول'},
      {id:'client-email', label:'البريد الإلكتروني'},
      {id:'client-phone', label:'الهاتف'}
    ];
    for (const f of required){
      const el = $(f.id);
      if (!el) continue;
      const val = (el.value||'').trim();
      if (!val){
        showNotification(`الرجاء إدخال ${f.label} قبل حفظ/طباعة PDF`, 'error');
        el.focus();
        el.scrollIntoView({behavior:'smooth', block:'center'});
        return false;
      }
      // Simple email format check if field is email
      if (el.type === 'email'){
        const ok = /.+@.+\..+/.test(val);
        if (!ok){
          showNotification('البريد الإلكتروني غير صالح. الرجاء إدخال بريد عمل صحيح.', 'error');
          el.focus();
          el.scrollIntoView({behavior:'smooth', block:'center'});
          return false;
        }
      }
    }
    return true;
  }

  // JSON import/export removed per UX simplification
  
  function exportToExcel() {
    const data = getTableData();
    
    // Check if XLSX library is available
    if (typeof XLSX !== 'undefined') {
      // Use XLSX library
      const ws = XLSX.utils.aoa_to_sheet([
        ['الوصف', 'PN', 'سعر الوحدة', 'الكمية', 'الإجمالي'],
        ...data.map(row => [row.desc, row.pn, row.unit, row.qty, row.total])
      ]);
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Quote Items");
      
      const filename = `quote-${quoteNoEl.textContent}-${todayISO()}.xlsx`;
      XLSX.writeFile(wb, filename);
    } else {
      // Fallback: Export as Excel-compatible CSV with .xls extension
      const csvContent = [
        ['الوصف', 'PN', 'سعر الوحدة', 'الكمية', 'الإجمالي'].join('\t'),
        ...data.map(row => [
          row.desc,
          row.pn,
          row.unit,
          row.qty,
          row.total
        ].join('\t'))
      ].join('\n');
      
      const blob = new Blob(['\ufeff' + csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `quote-${quoteNoEl.textContent}-${todayISO()}.xls`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  function exportToCSV() {
    const data = getTableData();
    const csvContent = [
      ['الوصف', 'PN', 'سعر الوحدة', 'الكمية', 'الإجمالي'].join(','),
      ...data.map(row => [
        `"${row.desc.replace(/"/g, '""')}"`,
        `"${row.pn.replace(/"/g, '""')}"`,
        row.unit,
        row.qty,
        row.total
      ].join(','))
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `quote-${quoteNoEl.textContent}-${todayISO()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function importFromExcel(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        if (typeof XLSX !== 'undefined') {
          // Use XLSX library for proper Excel files
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          
          processImportedData(jsonData);
        } else {
          // Fallback: Try to parse as CSV for basic Excel files
          const text = e.target.result;
          const rows = text.split('\n').map(row => 
            row.split(/[,\t]/).map(cell => cell.trim().replace(/"/g, ''))
          );
          processImportedData(rows);
        }
      } catch (error) {
        showNotification("خطأ في قراءة الملف. تأكد من صحة التنسيق", "error");
        console.error('Import error:', error);
      } finally {
        setLoadingState($("btn-import-excel"), false);
        $("excel-file-input").value = ''; // Clear the input
      }
    };

    // Read as array buffer for XLSX, or as text for CSV fallback
    if (typeof XLSX !== 'undefined') {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file, 'UTF-8');
    }
  }

  // JSON buttons/inputs removed

  function processImportedData(jsonData) {
    // Skip header row and process data
    let importedCount = 0;
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (row.length >= 4 && (row[0] || row[1])) { // At least description or PN
        addRowFromData({
          desc: String(row[0] || ''),
          pn: String(row[1] || ''),
          unit: Number(row[2] || 0),
          qty: Number(row[3] || 1)
        });
        importedCount++;
      }
    }
    
    recalcTotals();
    saveState();
    showNotification(`تم استيراد ${importedCount} عنصر بنجاح`, "success");
  }

  function getTableData() {
    const data = [];
    itemsBody.querySelectorAll("tr").forEach(tr => {
      const desc = tr.querySelector(".in-desc")?.value || "";
      const pn = tr.querySelector(".in-pn")?.value || "";
      const unit = num(tr.querySelector(".in-unit")?.value);
      const qty = Math.max(1, parseInt(tr.querySelector(".in-qty")?.value || "1", 10));
      const total = unit * qty;
      
      data.push({ desc, pn, unit, qty, total });
    });
    return data;
  }

  function filterTable(searchTerm) {
    const rows = itemsBody.querySelectorAll("tr");
    const term = searchTerm.toLowerCase();
    
    rows.forEach(row => {
      const desc = (row.querySelector(".in-desc")?.value || "").toLowerCase();
      const pn = (row.querySelector(".in-pn")?.value || "").toLowerCase();
      const shouldShow = !term || desc.includes(term) || pn.includes(term);
      row.style.display = shouldShow ? "" : "none";
    });
  }

  // ===== Project Info Modal integration =====
  function openProjectInfoModal(opts){
    try{
      const backdrop = document.getElementById('project-info-modal');
      const nameInput = document.getElementById('proj-modal-name');
      const siteInput = document.getElementById('proj-modal-site');
      const execInput = document.getElementById('proj-modal-exec');
  // Note: requester role and expected close are in main form, not modal, to keep modal short
      const saveBtn = document.getElementById('proj-info-save');
      const cancelBtn = document.getElementById('proj-info-cancel');
      if (!backdrop || !nameInput || !saveBtn) {
        // Fallback to prompt if modal elements not found
        const v = prompt('اكتب اسم المشروع:');
        if (v && v.trim()) {
          $("project-name").value = v.trim();
          saveState();
          if (opts && typeof opts.onDone === 'function') opts.onDone();
        }
        return;
      }
      // Prefill from current form
      nameInput.value = $("project-name").value || '';
      if (siteInput) siteInput.value = $("site-location").value || '';
      if (execInput) execInput.value = $("execution-date")?.value || '';
      // Show
      backdrop.style.display = 'flex';
      const closeModal = () => { backdrop.style.display = 'none'; };
      const onCancel = () => { closeModal(); };
      const onSave = () => {
        const v = nameInput.value.trim();
        if (!v){ nameInput.focus(); return; }
        $("project-name").value = v;
        if (siteInput) $("site-location").value = siteInput.value.trim();
        if (execInput) { const d = execInput.value; if ($("execution-date")) $("execution-date").value = d; }
        saveState();
        closeModal();
        if (opts && typeof opts.onDone === 'function') opts.onDone();
      };
      // Wire temporary handlers (one-off)
      saveBtn.onclick = onSave;
      if (cancelBtn) cancelBtn.onclick = onCancel;
    }catch(e){ console.warn('project modal error', e); }
  }

  async function handleSaveToAccount(){
    const token = localStorage.getItem('qiq_token');
    if (!token){
      showNotification('يرجى تسجيل الدخول أولاً لحفظ PDF في حسابك.', 'error');
      try { window.QiqModal ? QiqModal.open('/account.html', {title:'تسجيل الدخول'}) : window.open('/account.html','_blank'); } catch {}
      return;
    }
    await recalcTotals();
    const payload = buildPayload({ reason: 'save-pdf' });
    payload.totals = {
      subtotal: $("subtotal-cell").textContent,
      install: $("install-cell").textContent,
      grand: $("grand-cell").textContent
    };
    const res = await fetch('/api/users/quotations', {
      method:'POST',
      headers:{ 'content-type':'application/json', 'authorization': `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    let j;
    if (!res.ok){
      const err = await res.json().catch(()=>({}));
      if (err && err.error === 'PROJECT_NAME_REQUIRED'){
        return openProjectInfoModal({ onDone: async () => { await handleSaveToAccount(); } });
      } else {
        throw new Error('HTTP '+res.status);
      }
    } else {
      j = await res.json();
    }
    showNotification('تم حفظ العرض في حسابك. سيتم تنزيل PDF الآن.', 'success');
    logEvent('save-to-account', { id: j.id });
    // CTA toast if available
    try{
      const quoteRef = j.id || payload.number;
      if (window.QiqToast && typeof window.QiqToast.showHtml === 'function'){
        window.QiqToast.showHtml(
          `<div>تم حفظ العرض <strong>${quoteRef}</strong> في حسابك.</div>
           <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">
             <a href="/account.html" style="color:#2563eb;text-decoration:underline">اذهب إلى سجل العروض</a>
             <button onclick="navigator.clipboard && navigator.clipboard.writeText('${quoteRef}').then(()=>alert('تم نسخ رقم العرض')).catch(()=>prompt('انسخ رقم العرض:','${quoteRef}'))" style="background:#059669;color:#fff;border:none;padding:2px 6px;border-radius:4px;font-size:11px;cursor:pointer">📋 نسخ الرقم</button>
           </div>`,
          'success'
        );
      }
    }catch{}
    // Trigger print-to-PDF (user chooses destination)
    window.print();
  }



  // ===== Image Preview Functions =====
  window.openImagePreview = function(imgSrc) {
    const overlay = $("image-preview-overlay");
    const previewImg = $("preview-image");
    previewImg.src = imgSrc;
    overlay.style.display = "flex";
  };

  window.closeImagePreview = function() {
    const overlay = $("image-preview-overlay");
    overlay.style.display = "none";
  };

  // Load saved state from localStorage on page load
  window.addEventListener('beforeunload', () => {
    saveState();
  });

  // تحميل البنود من الشات تلقائيًا عند فتح صفحة quote
  document.addEventListener('DOMContentLoaded', () => {
    // Restore BOQ images toggle preference
    try{
      const pref = localStorage.getItem('qiq_boq_images');
      const el = document.getElementById('boq-images-toggle');
      if (el && (pref === '1' || pref === '0')) el.checked = (pref === '1');
      if (el) el.addEventListener('change', ()=>{
        try{ localStorage.setItem('qiq_boq_images', el.checked ? '1' : '0'); }catch{}
      });
    }catch{}

    // استخدام نفس المنطق المستخدم في زر "تحميل البنود من الشات"
    try {
      const stagedRaw = localStorage.getItem(STAGED_KEY);
      if (!stagedRaw) return; // لا يوجد عناصر محفوظة، لا نظهر إشعار خطأ
      
      const staged = JSON.parse(stagedRaw) || [];
      let loadedCount = 0;
      staged.forEach((it) => {
        addRowFromData({
          desc: it.Name || it.name || "—",
          pn: it.PN_SKU || it.pn || it.sku || "",
          unit: num(it.UnitPrice || it.unitPrice || it.price || 0),
          qty: Number(it.Qty || it.qty || 1),
          image: it.image || '',
          brand: it.manufacturer || it.brand || '',
          spec_sheet: it.spec_sheet || it.specsheet || ''
        });
        loadedCount++;
      });
      
      if (loadedCount > 0) {
        recalcTotals();
        updateEmptyState();
        showNotification(`تم تحميل ${loadedCount} عنصر من الشات تلقائيًا!`, "success");
      }
    } catch (err) {
      console.warn(err);
      showNotification("خطأ في تحميل البنود من الشات", "error");
    }
  });

})();
