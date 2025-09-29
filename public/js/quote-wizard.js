(function(){
  // Quote Wizard: inline modal with 3 steps (1: client, 2: review items, 3: summary/actions)
  const STATE_KEY = 'qiq_wizard_client_v1';
  const BOQ_KEY   = 'qiq_staged_items';

  function $id(id){ return document.getElementById(id); }
  function esc(s){ return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  function getItems(){
    try{
      const raw = localStorage.getItem(BOQ_KEY);
      const arr = raw? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch{ return []; }
  }

  function totals(items){
    let subtotal = 0; items.forEach(it=>{ const unit = Number(it.price||it.unit||it.unit_price||0); const qty = Number(it.qty||1); subtotal += unit*qty; });
    const install = subtotal < 4000 ? 200 : subtotal*0.05;
    const includeInstall = false; // keep off by default in wizard view; handled in full quote page
    const grand = includeInstall? subtotal+install : subtotal;
    return { subtotal, install: includeInstall?install:0, grand };
  }

  function buildClientForm(saved){
    return `
      <form id="wizard-form" style="display:grid;gap:10px;grid-template-columns:1fr 1fr">
        <label style="grid-column:1/-1">الاسم الكامل<span style="color:#dc2626"> *</span>
          <div class="field-wrap">
            <input id="wiz-name" name="name" type="text" value="${esc(saved?.name||'')}" required 
                   style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:8px;margin-top:4px">
            <span id="wiz-name-icon" class="field-icon neutral" aria-hidden="true">⚪</span>
          </div>
          <div id="wiz-name-msg" class="field-msg hint" aria-live="polite">أدخل الاسم الكامل</div>
        </label>
        
        <label>البريد الإلكتروني<span style="color:#dc2626"> *</span>
          <div class="field-wrap">
            <input id="wiz-email" name="email" type="email" value="${esc(saved?.email||'')}" required 
                   style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:8px;margin-top:4px">
            <span id="wiz-email-icon" class="field-icon neutral" aria-hidden="true">⚪</span>
          </div>
          <div id="wiz-email-msg" class="field-msg hint" aria-live="polite">سوف نرسل العرض إلى هذا البريد</div>
        </label>
        
        <label>اسم الشركة (اختياري)
          <input id="wiz-company" name="company" type="text" value="${esc(saved?.company||'')}" 
                 style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:8px;margin-top:4px">
        </label>
        
        <label>المسمى الوظيفي
          <input id="wiz-title" name="title" type="text" value="${esc(saved?.title||'')}" 
                 placeholder="مثال: مدير تقنية المعلومات" 
                 style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:8px;margin-top:4px">
        </label>
        
        <label>العملة
          <select id="wiz-currency" name="currency" 
                  style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:8px;margin-top:4px">
            <option value="USD" ${(!saved?.currency || saved?.currency==='USD')?'selected':''}>$ USD</option>
            <option value="EUR" ${saved?.currency==='EUR'?'selected':''}>€ EUR</option>
            <option value="SAR" ${saved?.currency==='SAR'?'selected':''}>ر.س SAR</option>
            <option value="EGP" ${saved?.currency==='EGP'?'selected':''}>جنيه EGP</option>
          </select>
        </label>
        
        <label>اسم المشروع<span style="color:#dc2626"> *</span>
          <div class="field-wrap">
            <input id="wiz-project-name" name="projectName" type="text" value="${esc(saved?.projectName||'')}" required 
                   placeholder="مثال: مشروع حماية الأجهزة - قسم المبيعات" 
                   style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:8px;margin-top:4px">
            <span id="wiz-project-name-icon" class="field-icon neutral" aria-hidden="true">⚪</span>
          </div>
          <div id="wiz-project-name-msg" class="field-msg hint" aria-live="polite">سيظهر اسم المشروع في ملف العرض</div>
        </label>
        
        <label>الموقع / الجهة (اختياري)
          <input id="wiz-project-site" name="projectSite" type="text" value="${esc(saved?.projectSite||'')}" 
                 placeholder="مثال: القاهرة - المقر الرئيسي" 
                 style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:8px;margin-top:4px">
        </label>
        
        <label style="grid-column:1/-1">ملاحظات / متطلبات إضافية
          <textarea id="wiz-notes" name="notes" rows="3" 
                    style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:8px;margin-top:4px;resize:vertical">${esc(saved?.notes||'')}</textarea>
        </label>
        <div class="wiz-actions" style="grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
          <button class="btn" id="wiz-next" type="submit">التالي</button>
        </div>
      </form>`;
  }

  async function aiGroup(items, client){
    try{
      const r = await fetch('/api/pdf-ai', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ items: items.map(it=>({ description: it.name||it.description||'', pn: it.pn||it.sku||'', brand: it.brand||it.manufacturer||'' })), client:{ name: client?.name||'' }, project:{ name: client?.projectName||'', site: client?.projectSite||'' } }) });
      const j = await r.json().catch(()=>({}));
      const data = j?.data; const prods = Array.isArray(data?.products)? data.products : [];
      if (!prods.length) return null;
      // Simple grouping heuristic: group by first word(s) of product title up to 2 tokens
      const groups = new Map();
      prods.forEach((p, idx)=>{
        const raw = String(p.title||'').trim();
        const key = raw ? raw.split(/[\s·•\-–—\|]+/).slice(0,2).join(' ') : 'Items';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(idx);
      });
      return { groups, products: prods };
    }catch{ return null; }
  }

  function fallbackGroup(items){
    const groups = new Map();
    items.forEach((it, idx)=>{
      const k = (it.brand || it.manufacturer || '').trim() || 'Items';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(idx);
    });
    return groups;
  }

  function renderTable(items, currency, grouping){
    const rows = (idxList)=> idxList.map((i)=>{
      const it = items[i];
      const name = esc(it.name || it.description || '-');
      const pn   = esc(it.pn || it.sku || '');
      const qty  = Number(it.qty||1);
      const unit = Number(it.price||it.unit||it.unit_price||0);
      const line = unit*qty;
      return `<tr>
        <td style="padding:6px;border-bottom:1px solid #eee">${i+1}</td>
        <td style="padding:6px;border-bottom:1px solid #eee">${name}${pn?` <span class=\"muted\">(${pn})</span>`:''}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;text-align:right">${qty}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;text-align:right">${unit.toFixed(2)}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;text-align:right">${line.toFixed(2)}</td>
      </tr>`;
    }).join('');
    const t = totals(items);
    if (!grouping){
      return `<div class="table-wrap" style="overflow:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="text-align:right;padding:6px;border-bottom:1px solid #ddd">#</th>
            <th style="text-align:right;padding:6px;border-bottom:1px solid #ddd">الوصف</th>
            <th style="text-align:right;padding:6px;border-bottom:1px solid #ddd">الكمية</th>
            <th style="text-align:right;padding:6px;border-bottom:1px solid #ddd">سعر الوحدة</th>
            <th style="text-align:right;padding:6px;border-bottom:1px solid #ddd">الإجمالي</th>
          </tr></thead>
          <tbody>${rows(items.map((_,i)=>i))}</tbody>
        </table>
        <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center">
          <div style="color:#6b7280">العملة: <strong id="wiz-currency-view"></strong></div>
          <div style="text-align:left">
            <div>Subtotal: <strong>${t.subtotal.toFixed(2)}</strong></div>
            <div>Grand Total: <strong>${t.grand.toFixed(2)}</strong></div>
          </div>
        </div>
      </div>`;
    }
    // Grouped rendering
    let sections = '';
    grouping.forEach((idxs, title)=>{
      const block = `<div style="margin:10px 0 4px;font-weight:600;color:#111827">${esc(title)}</div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
          <thead><tr>
            <th style="text-align:right;padding:6px;border-bottom:1px solid #ddd">#</th>
            <th style="text-align:right;padding:6px;border-bottom:1px solid #ddd">الوصف</th>
            <th style="text-align:right;padding:6px;border-bottom:1px solid #ddd">الكمية</th>
            <th style="text-align:right;padding:6px;border-bottom:1px solid #ddd">سعر الوحدة</th>
            <th style="text-align:right;padding:6px;border-bottom:1px solid #ddd">الإجمالي</th>
          </tr></thead>
          <tbody>${rows(idxs)}</tbody>
        </table>`;
      sections += block;
    });
    return `<div class="table-wrap" style="overflow:auto">
      ${sections}
      <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center">
        <div style="color:#6b7280">العملة: <strong id="wiz-currency-view"></strong></div>
        <div style="text-align:left">
          <div>Subtotal: <strong>${t.subtotal.toFixed(2)}</strong></div>
          <div>Grand Total: <strong>${t.grand.toFixed(2)}</strong></div>
        </div>
      </div>
    </div>`;
  }

  async function buildItemsTable(items){
    if (!items.length) return '<div class="muted">لا توجد عناصر مضافة بعد.</div>';
    const client = loadClient();
    let grouping = null;
    const ai = await aiGroup(items, client);
    if (ai && ai.groups && ai.groups.size){
      grouping = ai.groups;
    } else {
      grouping = fallbackGroup(items);
    }
    const cur = client?.currency || 'EGP';
    return renderTable(items, cur, grouping);
  }

  function renderReviewStep(items){
    if (!items || !items.length) return '<div class="muted">لا توجد عناصر مضافة.</div>';
    const rows = items.map((it, idx)=>{
      const name = esc(it.name || it.description || '-');
      const pn = esc(it.pn || it.sku || '');
      const qty = Number(it.qty||1);
      const unit = Number(it.price||it.unit||it.unit_price||0);
      const total = qty*unit;
      return `<tr data-idx="${idx}">
        <td style="padding:6px;border-bottom:1px solid #eee">${idx+1}</td>
        <td style="padding:6px;border-bottom:1px solid #eee">${name}${pn?` <span class=muted>(${pn})</span>`:''}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;text-align:right"><input type="number" min="1" step="1" value="${qty}" style="width:72px;padding:4px;border:1px solid #e5e7eb;border-radius:6px" class="wiz-qty"/></td>
        <td style="padding:6px;border-bottom:1px solid #eee;text-align:right">${unit.toFixed(2)}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;text-align:right" class="wiz-line">${total.toFixed(2)}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;text-align:center"><button class="btn danger wiz-del" type="button">حذف</button></td>
      </tr>`;
    }).join('');
    const t = totals(items);
    return `<div class="table-wrap" style="overflow:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="text-align:right;padding:6px;border-bottom:1px solid #ddd">#</th>
          <th style="text-align:right;padding:6px;border-bottom:1px solid #ddd">الوصف</th>
          <th style="text-align:right;padding:6px;border-bottom:1px solid #ddd">الكمية</th>
          <th style="text-align:right;padding:6px;border-bottom:1px solid #ddd">سعر الوحدة</th>
          <th style="text-align:right;padding:6px;border-bottom:1px solid #ddd">الإجمالي</th>
          <th style="text-align:center;padding:6px;border-bottom:1px solid #ddd">إزالة</th>
        </tr></thead>
        <tbody id="wiz-review-body">${rows}</tbody>
      </table>
      <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center">
        <div style="color:#6b7280">العملة: <strong id="wiz-currency-view"></strong></div>
        <div style="text-align:left">
          <div>Subtotal: <strong id="wiz-subtotal">${t.subtotal.toFixed(2)}</strong></div>
          <div>Grand Total: <strong id="wiz-grand">${t.grand.toFixed(2)}</strong></div>
        </div>
      </div>
    </div>`;
  }

  function loadClient(){ try{ return JSON.parse(localStorage.getItem(STATE_KEY)||'null')||{}; }catch{ return {}; } }
  function saveClient(data){ try{ localStorage.setItem(STATE_KEY, JSON.stringify(data)); }catch{} }

  function payloadFromState(){
    const items = getItems();
    const client = loadClient();
    const number = `Q-${new Date().getFullYear()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    return {
      action: 'download',
      number,
      date: new Date().toISOString().slice(0,10),
  currency: client.currency || 'EGP',
      client: { name: client.name||'', email: client.email||'', contact: client.company||'', title: client.title||'', phone: '' },
      project: { name: client.projectName||'', site: client.projectSite||'' },
      items
    };
  }

  async function handle(action){
    // Fast-path: special actions coming from iframe bridge
    if (action === 'back-to-step1') {
      try {
        const frame = window.QiqModal?.getFrame?.();
        const doc = frame?.contentDocument; const el = doc?.getElementById('wiz-busy'); if (el) el.remove();
      } catch {}
      return render(1);
    }
    if (action === 'form-submit') {
      try {
        const frame = window.QiqModal?.getFrame?.();
        const doc = frame?.contentDocument;
        const byId = (id)=> doc?.getElementById(id)?.value?.trim();
        const name = byId('wiz-name') || '';
        const email = byId('wiz-email') || '';
        const projectName = byId('wiz-project-name') || '';
        const company = byId('wiz-company') || '';
        const notes = byId('wiz-notes') || '';
        const projectSite = byId('wiz-project-site') || '';
        const title = byId('wiz-title') || '';
        const currency = byId('wiz-currency') || (loadClient()?.currency || 'EGP');

        if (!name || name.length < 2){ window.QiqToast?.error?.('يرجى إدخال الاسم الكامل (حرفين على الأقل)'); return; }
        if (!email || !email.includes('@')){ window.QiqToast?.error?.('يرجى إدخال بريد إلكتروني صحيح'); return; }
        if (!projectName || projectName.length < 3){ window.QiqToast?.error?.('يرجى إدخال اسم المشروع (3 أحرف على الأقل)'); return; }

        saveClient({ name, email, company, notes, projectName, projectSite, title, currency });
        window.QiqToast?.success?.('تم حفظ البيانات بنجاح');
        return render(2);
      } catch {
        window.QiqToast?.error?.('تعذر حفظ البيانات');
        return;
      }
    }
    
    try { console.log('[Wizard] handle called with action:', action); } catch {}
    // Show a busy overlay in the modal dialog
    try{
      const frame = window.QiqModal?.getFrame?.();
      const doc = frame?.contentDocument;
      if (doc && !doc.getElementById('wiz-busy')){
        const el = doc.createElement('div'); el.id = 'wiz-busy';
        el.setAttribute('style','position:fixed;inset:0;background:rgba(255,255,255,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;font-family:system-ui');
  el.innerHTML = '<div style="display:flex;gap:12px;align-items:center;color:#1e3a8a"><span class="spinner" style="width:18px;height:18px;border:3px solid #c7d2fe;border-top-color:#1e3a8a;border-radius:50%;display:inline-block;animation:qiqspin 0.9s linear infinite"></span><span>جاري المعالجة…</span><div id="wiz-progress" style="min-width:180px;height:8px;background:#e5e7eb;border-radius:6px;overflow:hidden"><div id="wiz-progress-bar" style="height:100%;width:1%;background:#3b82f6;transition:width .3s ease"></div></div><span id="wiz-progress-label" style="min-width:38px;text-align:right">1%</span></div>';
        const style = doc.createElement('style'); style.textContent='@keyframes qiqspin{to{transform:rotate(360deg)}}'; doc.head.appendChild(style);
        doc.body.appendChild(el);
        // Disable action buttons
        ['wiz-download','wiz-send','wiz-custom','wiz-next','wiz-back','wiz-back-step1'].forEach(id=>{ try{ const b=doc.getElementById(id); if (b){ b.disabled=true; b.style.opacity='0.7'; } }catch{} });
      }
    }catch{}
  // Prefer saved state (works on step 2 where inputs are not visible). Fallback to inputs if present.
  let { name, email, company, notes, projectName, projectSite, title, currency } = loadClient() || {};
    // Try to read from current iframe if inputs exist
    try{
      const frame = window.QiqModal?.getFrame?.();
      const doc = frame?.contentDocument;
      const byId = (id)=> doc?.getElementById(id)?.value?.trim();
      name = byId('wiz-name') || name;
      email = byId('wiz-email') || email;
      company = byId('wiz-company') || company;
      notes = byId('wiz-notes') || notes;
      projectName = byId('wiz-project-name') || projectName;
      projectSite = byId('wiz-project-site') || projectSite;
      title = byId('wiz-title') || title;
  currency = byId('wiz-currency') || currency || 'EGP';
    }catch{}

    if (!name || !email){ window.QiqToast?.error?.('يرجى إدخال الاسم والبريد الإلكتروني'); return; }
    if (!projectName){ window.QiqToast?.error?.('يرجى إدخال اسم المشروع'); return; }
  saveClient({ name, email, company, notes, projectName, projectSite, title, currency });

    // Progress sequence (1% -> 100%) while awaiting server
    let pct = 1; let done = false;
    function setProgress(p){ try{
      const frame = window.QiqModal?.getFrame?.(); const doc = frame?.contentDocument;
      const bar = doc?.getElementById('wiz-progress-bar'); const lab = doc?.getElementById('wiz-progress-label');
      if (bar) bar.style.width = Math.max(1, Math.min(100, p))+'%'; if (lab) lab.textContent = Math.round(Math.max(1, Math.min(100, p)))+'%';
    }catch{} }
    setProgress(1);
    const phases = [20, 38, 55, 72, 88, 97];
    let phaseIdx = 0;
    const iv = setInterval(()=>{
      if (done) return clearInterval(iv);
      pct = Math.min(pct + 1 + Math.floor(Math.random()*3), phases[Math.min(phaseIdx, phases.length-1)]);
      setProgress(pct);
      if (pct >= phases[phaseIdx]) phaseIdx++;
      if (phaseIdx >= phases.length) clearInterval(iv);
    }, 280);

    const payload = payloadFromState();
    payload.action = action;
    payload.client.name = name; payload.client.email = email; payload.client.contact = company; payload.client.title = title;
    payload.project.name = projectName; payload.project.site = projectSite;
  payload.currency = currency || 'EGP';

    // Convert unit prices from USD to selected currency using official CDN API
    try{
  const from = 'usd'; const to = (currency||'EGP').toLowerCase();
      if (to !== 'usd'){
        const res = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${from}.json`);
        let rate = 1; if (res.ok){ const data = await res.json(); rate = Number(data?.[from]?.[to]||1) || 1; }
        if (rate && rate>0){
          (payload.items||[]).forEach(it=>{
            const base = Number(it.unit||it.unit_price||it.price||0);
            if (!it.base_usd) it.base_usd = base; // keep original for reference
            const converted = (it.base_usd||base) * rate;
            it.unit = Number(converted.toFixed(2));
            it.unit_price = it.unit; it.price = it.unit;
          });
        }
      }
    }catch{}
    try{
      try { console.log('[Wizard] POST /api/quote-email payload:', { action: payload.action, items: (payload.items||[]).length, client: payload.client?.email, currency: payload.currency }); } catch {}
      const r = await fetch('/api/quote-email', { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok){
        window.QiqToast?.error?.(`حدث خطأ أثناء الإرسال (HTTP ${r.status})`);
        try { console.warn('[Wizard] quote-email HTTP error:', r.status); } catch {}
        return;
      }
      const j = await r.json();
      try { console.log('[Wizard] quote-email response:', { status: r.status, email: j?.email, helloleads: j?.helloleads }); } catch {}
      done = true; setProgress(100);
      if (action === 'download' && j?.pdfBase64){
        const a = document.createElement('a');
        a.href = 'data:application/pdf;base64,'+j.pdfBase64;
        const baseName = `${payload.number||'quotation'}${payload?.project?.name ? ' - ' + payload.project.name : ''}`;
        a.download = baseName + '.pdf';
        document.body.appendChild(a); a.click(); a.remove();
      } else if (action === 'download' && !j?.pdfBase64){
        window.QiqToast?.error?.('لم يتم إنشاء ملف PDF.');
      }
      if (action === 'custom'){
        window.QiqToast?.success?.('تم إرسال طلبك وسنتواصل معك قريبًا.');
      } else if (action === 'send') {
        const adminOk = !!(j?.email?.admin?.ok);
        const clientOk = !!(j?.email?.client?.ok);
        if (clientOk){
          window.QiqToast?.success?.('تم إرسال العرض إلى بريدك.');
        } else {
          const status = j?.email?.client?.status || '';
          window.QiqToast?.warning?.(`تم إنشاء العرض، لكن تعذر إرسال البريد (${status||'خطأ غير معروف'}). حاول لاحقًا أو تحقق من البريد غير الهام.`);
        }
        if (!adminOk){
          window.QiqToast?.warning?.('تعذر إشعار فريق الإدارة عبر البريد. سيتم المتابعة يدويًا.');
        }
      }
  }catch(e){ console.warn(e); window.QiqToast?.error?.('تعذر تنفيذ العملية الآن'); }
  finally{
    // Hide busy overlay and re-enable buttons
    try{
      const frame = window.QiqModal?.getFrame?.();
      const doc = frame?.contentDocument; const el = doc?.getElementById('wiz-busy'); if (el) el.remove();
      ['wiz-download','wiz-send','wiz-custom','wiz-next','wiz-back','wiz-back-step1'].forEach(id=>{ try{ const b=doc.getElementById(id); if (b){ b.disabled=false; b.style.opacity='1'; } }catch{} });
      try { console.log('[Wizard] UI restored after action'); } catch {}
    }catch{}
  }
  }

  function render(step){
    const items = getItems();
    const saved = loadClient();
    const html1 = buildClientForm(saved);
    let html2 = renderReviewStep(items);
    let html3 = '<div class="muted">جارٍ تجهيز العناصر…</div>';
    const steps = `
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <div class="chip ${step===1?'active':''}">1) بيانات العميل</div>
        <div class="chip ${step===2?'active':''}">2) مراجعة العناصر</div>
        <div class="chip ${step===3?'active':''}">3) عرض السعر</div>
      </div>`;
    const css = `
      <style>
        .chip{background:#f3f4f6;border-radius:999px;padding:4px 10px;font-size:12px;color:#374151}
        .chip.active{background:#eef2ff;color:#3730a3}
        .wiz-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:12px}
        .btn{border:0;border-radius:10px;padding:8px 12px;background:#1e3a8a;color:#fff;cursor:pointer}
        .btn.secondary{background:#6b7280}
        /* Validation helpers */
        .field-error{border-color:#ef4444 !important; outline: none}
        .field-msg{font-size:12px;margin-top:4px;color:#6b7280}
        .field-msg.error{color:#ef4444}
        .field-msg.hint{color:#6b7280}
        .field-wrap{position:relative}
        .field-icon{position:absolute; inset-inline-end:10px; top:calc(50% + 2px); transform:translateY(-50%); font-size:14px; color:#9ca3af}
        .field-icon.ok{color:#10b981}
        .field-icon.error{color:#ef4444}
        .field-icon.neutral{color:#9ca3af}
      </style>`;
    const inner = step===1 ? html1
                           : step===2 ? html2+`<div class="wiz-actions">
            <button class="btn secondary" id="wiz-back" data-wizard-action="back">رجوع</button>
            <button class="btn" id="wiz-next2" type="button" data-wizard-action="next2" aria-label="التالي" role="button">التالي</button>
          </div>`
                           : html3+`<div class="wiz-actions">
            <button class="btn secondary" id="wiz-back" data-wizard-action="back">رجوع</button>
            <button class="btn" id="wiz-download" data-wizard-action="download">Download PDF</button>
            <button class="btn" id="wiz-send" data-wizard-action="send">Send by Email</button>
            <button class="btn" id="wiz-custom" data-wizard-action="custom">Get Custom Quote</button>
          </div>`;
    const panel = css + steps + inner;

    try{
  if (window.QiqModal){ QiqModal.open('#', { title:'\u0637\u0644\u0628 \u0639\u0631\u0636 \u0633\u0639\u0631', html: panel, size: 'md', headerActions: false }); }
      else alert('Wizard requires modal.js');
    }catch{}

    // Robustly wire handlers after iframe content is ready (load + retry fallback)
    async function bindInside(){
      const frame = window.QiqModal?.getFrame?.();
      const doc = frame?.contentDocument; 
      if (!doc) return false;
      // Safe element getter
      const q = (id) => { try { return doc.getElementById(id); } catch { return null; } };
      
      // Enhanced element detection
      console.log('🔍 Looking for wizard elements in frame...');
  const next = q('wiz-next');
  const back = q('wiz-back');
    const dl   = q('wiz-download');
      const send = q('wiz-send');
      const cust = q('wiz-custom');
  const form = q('wizard-form');
    const next2 = q('wiz-next2');

      // Inline validation helpers
      const hints = {
        'wiz-name': 'أدخل الاسم الكامل',
        'wiz-email': 'سوف نرسل العرض إلى هذا البريد',
        'wiz-project-name': 'سيظهر اسم المشروع في ملف العرض'
      };
  const setIcon = (id, state)=>{ try{ const ic = q(id+'-icon'); if (!ic) return; ic.classList.remove('ok','error','neutral'); ic.classList.add(state||'neutral'); ic.textContent = state==='ok'?'✅':(state==='error'?'❗':'⚪'); }catch{} };
      const clearErr = (id)=>{ try{ const inp = q(id); if (inp) inp.classList.remove('field-error'); const m = q(id+'-msg'); if (m){ m.textContent=hints[id]||''; m.classList.remove('error'); m.classList.add('hint'); } setIcon(id,'neutral'); }catch{} };
      const setErr = (id, msg)=>{ try{ const inp = q(id); if (inp) inp.classList.add('field-error'); const m = q(id+'-msg'); if (m){ m.textContent = msg || ''; m.classList.add('error'); m.classList.remove('hint'); } setIcon(id,'error'); }catch{} };
      
      console.log('🎯 Found elements:', { 
        next: !!next, 
        back: !!back, 
        dl: !!dl, 
        send: !!send, 
        cust: !!cust 
      });
      
      // If none found yet, not ready
      if (!next && !dl && !send && !cust && !back) {
        console.log('⚠️ No wizard elements found, will retry...');
        return false;
      }
      
      // Helper: allow re-binding every time (some scripts replace nodes). We attach fresh listeners.
      const on = (el, type, fn)=>{ 
        if (!el) return; 
        try { el.replaceWith(el.cloneNode(true)); } catch {}
        const node = doc.getElementById(el.id) || el; // try to get the new node by id
        node.addEventListener(type, fn, { capture: true });
      };
      
      // Form-first approach: submit event handles Next
      on(form, 'submit', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        // Clear previous errors
        ['wiz-name','wiz-email','wiz-project-name'].forEach(clearErr);
        const name = doc.getElementById('wiz-name')?.value.trim();
        const email= doc.getElementById('wiz-email')?.value.trim();
        const projectName = doc.getElementById('wiz-project-name')?.value.trim();
        const company = doc.getElementById('wiz-company')?.value.trim();
        const notes = doc.getElementById('wiz-notes')?.value.trim();
        const projectSite = doc.getElementById('wiz-project-site')?.value.trim();
        const title = doc.getElementById('wiz-title')?.value.trim();
        const currency = doc.getElementById('wiz-currency')?.value || 'EGP';
  if (!name || name.length < 2){ setErr('wiz-name','الاسم الكامل مطلوب (حرفان على الأقل).'); window.parent.QiqToast?.error?.('يرجى إدخال الاسم الكامل (حرفين على الأقل)'); doc.getElementById('wiz-name')?.focus(); return; } else { setIcon('wiz-name','ok'); }
  const emailOk = !!email && /.+@.+\..+/.test(email);
  if (!emailOk){ setErr('wiz-email','يرجى إدخال بريد إلكتروني صحيح.'); window.parent.QiqToast?.error?.('يرجى إدخال بريد إلكتروني صحيح'); doc.getElementById('wiz-email')?.focus(); return; } else { setIcon('wiz-email','ok'); }
  if (!projectName || projectName.length < 3){ setErr('wiz-project-name','اسم المشروع مطلوب (3 أحرف على الأقل).'); window.parent.QiqToast?.error?.('يرجى إدخال اسم المشروع (3 أحرف على الأقل)'); doc.getElementById('wiz-project-name')?.focus(); return; } else { setIcon('wiz-project-name','ok'); }
        const clientData = { name, email, company, notes, projectName, projectSite, currency, title };
        try{
          window.parent.localStorage.setItem(STATE_KEY, JSON.stringify(clientData));
          window.parent.QiqToast?.success?.('تم حفظ البيانات بنجاح');
          render(2);
        }catch(err){ console.error(err); window.parent.QiqToast?.error?.('خطأ في حفظ البيانات'); }
      });
      
      // Click fallback on Next to trigger form submission in case some scripts stop click bubbles
      on(next, 'click', (e)=>{ try { e.preventDefault(); e.stopPropagation(); form?.requestSubmit?.(); form?.submit?.(); } catch {} });
      // Keyboard fallback: Space/Enter activates submit
      on(next, 'keydown', (e)=>{ if (e.key==='Enter' || e.key===' '){ e.preventDefault(); try{ form?.requestSubmit?.(); }catch{} } });

      // Live validation: clear error when user fixes input
      ;['wiz-name','wiz-email','wiz-project-name'].forEach((id)=>{
        const el = q(id); if (!el) return;
        if (!el.__live){
          el.__live = true;
          el.addEventListener('input', ()=>{ 
            const v = String(el.value||'').trim();
            if (id==='wiz-email') { if (/.+@.+\..+/.test(v)) { clearErr(id); setIcon(id,'ok'); } else if (!v) { clearErr(id); } else { setErr(id,'يرجى إدخال بريد إلكتروني صحيح.'); } }
            else {
              const min = id==='wiz-name'?2:3;
              if (v.length >= min) { clearErr(id); setIcon(id,'ok'); }
              else if (!v) { clearErr(id); }
              else { setErr(id, id==='wiz-name' ? 'الاسم الكامل مطلوب (حرفان على الأقل).' : 'اسم المشروع مطلوب (3 أحرف على الأقل).'); }
            }
          });
          el.addEventListener('blur', ()=>{ if (!String(el.value||'').trim()) clearErr(id); });
        }
      });
  on(back, 'click', (e)=>{ e.preventDefault(); e.stopPropagation(); try{ render(step === 3 ? 2 : 1); }catch{} });
      on(dl,   'click', (e)=>{ e.preventDefault(); handle('download'); });
      on(send, 'click', (e)=>{ e.preventDefault(); handle('send'); });
      on(cust, 'click', (e)=>{ e.preventDefault(); handle('custom'); });

      // Step 2 interactions: qty change and delete
      try{
        const body = q('wiz-review-body');
        if (body && !body.__bound){
          body.__bound = true;
          body.addEventListener('input', (ev)=>{
            const tr = ev.target.closest('tr'); if (!tr) return;
            if (!ev.target.classList.contains('wiz-qty')) return;
            const idx = Number(tr.getAttribute('data-idx')||'-1'); if (idx<0) return;
            const arr = getItems();
            const qty = Math.max(1, parseInt(ev.target.value||'1',10));
            arr[idx].qty = qty;
            localStorage.setItem(BOQ_KEY, JSON.stringify(arr));
            // update line and totals
            const unit = Number(arr[idx].price||arr[idx].unit||arr[idx].unit_price||0);
            tr.querySelector('.wiz-line').textContent = (unit*qty).toFixed(2);
            const t = totals(arr);
            const doc = window.QiqModal?.getFrame?.()?.contentDocument;
            const sub = doc?.getElementById('wiz-subtotal'); if (sub) sub.textContent = t.subtotal.toFixed(2);
            const gr = doc?.getElementById('wiz-grand'); if (gr) gr.textContent = t.grand.toFixed(2);
          });
          body.addEventListener('click', (ev)=>{
            try{
              const tgt = ev.target;
              const btn = tgt && tgt.closest ? tgt.closest('.wiz-del') : null; if (!btn) return;
              const tr = btn.closest('tr'); if (!tr) return;
              const idx = Number(tr.getAttribute('data-idx')||'-1'); if (idx<0) return;
              const arr = getItems();
              arr.splice(idx,1);
              localStorage.setItem(BOQ_KEY, JSON.stringify(arr));
              // re-render step 2
              render(2);
            }catch{}
          });
        }
      }catch{}

  // Step 2 Next (explicit)
  on(next2, 'click', (e)=>{ e.preventDefault(); e.stopPropagation(); try{ render(3); }catch{} });
  // Step 2 Next fallbacks: pointerup and keyboard
  on(next2, 'pointerup', (e)=>{ e.preventDefault(); e.stopPropagation(); try{ render(3); }catch{} });
  on(next2, 'keydown', (e)=>{ if (e.key==='Enter' || e.key===' '){ e.preventDefault(); e.stopPropagation(); try{ render(3); }catch{} } });

      // Extra safety: delegated clicks for Next (step 2) and Back
      try{
        // Always add a capture-phase delegated handler; multiple adds are fine in capture
        doc.addEventListener('click', (ev)=>{
          try{
            const n2 = ev.target && ev.target.closest && ev.target.closest('#wiz-next2');
            if (n2){ ev.preventDefault(); ev.stopPropagation(); return void render(3); }
            const bk = ev.target && ev.target.closest && ev.target.closest('#wiz-back');
            if (bk){ ev.preventDefault(); ev.stopPropagation(); return void render(step === 3 ? 2 : 1); }
            // Delegated delete handler (capture): handles clicks on .wiz-del reliably
            const delBtn = ev.target && ev.target.closest && ev.target.closest('.wiz-del');
            if (delBtn){
              ev.preventDefault(); ev.stopPropagation();
              try{
                const tr = delBtn.closest('tr');
                const idx = Number(tr?.getAttribute('data-idx')||'-1');
                if (idx>=0){
                  const arr = getItems();
                  arr.splice(idx,1);
                  localStorage.setItem(BOQ_KEY, JSON.stringify(arr));
                  return void render(2);
                }
              }catch{}
            }
          }catch{}
        }, true);
        // Even earlier: capture pointerdown to beat any other click stoppers
        doc.addEventListener('pointerdown', (ev)=>{
          try{
            const n2 = ev.target && ev.target.closest && ev.target.closest('#wiz-next2');
            if (n2){ ev.preventDefault(); ev.stopPropagation(); return void render(3); }
            const bk = ev.target && ev.target.closest && ev.target.closest('#wiz-back');
            if (bk){ ev.preventDefault(); ev.stopPropagation(); return void render(step === 3 ? 2 : 1); }
            // Pointerdown delegate for delete as a pre-emptive fallback
            const delBtn = ev.target && ev.target.closest && ev.target.closest('.wiz-del');
            if (delBtn){
              ev.preventDefault(); ev.stopPropagation();
              try{
                const tr = delBtn.closest('tr');
                const idx = Number(tr?.getAttribute('data-idx')||'-1');
                if (idx>=0){
                  const arr = getItems();
                  arr.splice(idx,1);
                  localStorage.setItem(BOQ_KEY, JSON.stringify(arr));
                  return void render(2);
                }
              }catch{}
            }
          }catch{}
        }, true);
        // Pointerup capture as an additional safety net
        doc.addEventListener('pointerup', (ev)=>{
          try{
            const n2 = ev.target && ev.target.closest && ev.target.closest('#wiz-next2');
            if (n2){ ev.preventDefault(); ev.stopPropagation(); return void render(3); }
          }catch{}
        }, true);
      }catch{}

      // Bind any [data-wizard-action] inside the iframe too (safety)
      try{
        const acts = Array.from(doc.querySelectorAll('[data-wizard-action]'));
        acts.forEach((el)=>{
          if (el.__bound) return; el.__bound = true;
          el.addEventListener('click', (ev)=>{
            ev.preventDefault(); ev.stopPropagation();
            const a = (el.getAttribute('data-wizard-action')||'').toLowerCase();
            if (a==='download' || a==='send' || a==='custom') return handle(a);
            if (a==='back' || a==='back1' || a==='step1' || a==='back0') return render(1);
          });
        });
      }catch{}
  // removed duplicate back button
      try{ const cur = (window.parent.localStorage.getItem(STATE_KEY) && JSON.parse(window.parent.localStorage.getItem(STATE_KEY))?.currency) || 'EGP'; const el = doc.getElementById('wiz-currency-view'); if (el) el.textContent = cur; }catch{}
  // If step 3, replace placeholder with grouped table asynchronously
      if (!next && dl && send && cust){
        try{
          const itemsNow = getItems();
          const clientNow = loadClient();
          const html = await buildItemsTable(itemsNow);
          const cont = doc.body; if (cont){ window.parent.QiqModal?.setHtml?.(css + steps + html + `
          <div class=\"wiz-actions\">
            <button class=\"btn secondary\" id=\"wiz-back\" data-wizard-action=\"back\">رجوع</button>
            <button class=\"btn\" id=\"wiz-download\" data-wizard-action=\"download\">Download PDF</button>
            <button class=\"btn\" id=\"wiz-send\" data-wizard-action=\"send\">Send by Email</button>
            <button class=\"btn\" id=\"wiz-custom\" data-wizard-action=\"custom\">Get Custom Quote</button>
          </div>` ); }
        }catch{}
      }
      return true;
    }
    
    // Enhanced retry mechanism with better logging
    console.log('🚀 Starting wizard binding process...');
    
  if (!bindInside()) {
      console.log('🔄 Initial binding failed, setting up retries...');
      
      const frame = window.QiqModal?.getFrame?.();
      if (frame) {
        console.log('📄 Frame found, adding load listener...');
        try { 
          frame.addEventListener('load', () => {
            console.log('📄 Frame loaded, attempting to bind...');
            setTimeout(bindInside, 100);
          }, { once: true }); 
        } catch(e) {
          console.error('❌ Error adding load listener:', e);
        }
      } else {
        console.log('❌ No frame found');
      }
      
      let tries = 0; 
      const maxTries = 50; // 5 seconds
      console.log(`🔄 Starting retry loop (max ${maxTries} tries)`);
      
      const iv = setInterval(() => { 
        tries++;
        console.log(`🔄 Retry attempt ${tries}/${maxTries}`);
        
        if (bindInside()) {
          console.log('✅ Binding successful after', tries, 'attempts');
          clearInterval(iv);
        } else if (tries >= maxTries) {
          console.error('❌ Binding failed after', maxTries, 'attempts');
          clearInterval(iv);
        }
      }, 100);
      // Observe mutations inside iframe to re-wire dynamically-added buttons
      try{
        const frame = window.QiqModal?.getFrame?.();
        const doc = frame?.contentDocument;
        if (doc && 'MutationObserver' in window){
          const mo = new MutationObserver(()=>{ try{ bindInside(); }catch{} });
          mo.observe(doc.body, { childList:true, subtree:true });
        }
      }catch{}
    } else {
      console.log('✅ Initial binding successful');
    }
  }

  function openWizard(e){ 
    if (e) e.preventDefault();
    // If modal not ready yet, wait briefly
    let tries = 0;
    const max = 30; // ~1.5s
    const tick = () => {
      tries++;
      if (window.QiqModal && typeof window.QiqModal.open === 'function') {
        try { return render(1); } catch { /* fallthrough */ }
      }
      if (tries < max) return setTimeout(tick, 50);
      // Fallback: simple inline dialog to unblock user
      try{
        const div = document.createElement('div');
        div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:99999';
        div.innerHTML = '<div style="background:#fff;padding:16px;border-radius:12px;max-width:640px;width:92vw;max-height:86vh;overflow:auto">جاري فتح المعالج… يرجى إعادة تحميل الصفحة.<br/><br/><button id="wiz-close-fb" class="btn">إغلاق</button></div>';
        document.body.appendChild(div);
        div.querySelector('#wiz-close-fb')?.addEventListener('click', ()=> div.remove());
      }catch{}
    };
    tick();
  }

  // Expose as global to bind from buttons
  window.QiqQuoteWizard = { open: openWizard };
  // Expose action handler for iframe bridge
  window.QiqWizardHandle = handle;
  window.QiqWizardBack = ()=> render(1);

  // Attach default listeners if buttons exist
  document.addEventListener('click', function(ev){
    const btn = ev.target.closest('[data-open-quote-wizard]');
    if (btn){ ev.preventDefault(); openWizard(); }
  });
})();
