(function(){
  // Quote Wizard: inline modal with 2 steps
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
      <div style="display:grid;gap:10px;grid-template-columns:1fr 1fr">
        <label style="grid-column:1/-1">الاسم الكامل<input id="wiz-name" type="text" value="${esc(saved?.name||'')}" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:8px"></label>
        <label>البريد الإلكتروني<input id="wiz-email" type="email" value="${esc(saved?.email||'')}" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:8px"></label>
        <label>اسم الشركة (اختياري)<input id="wiz-company" type="text" value="${esc(saved?.company||'')}" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:8px"></label>
        <label>اسم المشروع<span style="color:#dc2626"> *</span><input id="wiz-project-name" type="text" value="${esc(saved?.projectName||'')}" placeholder="مثال: مشروع حماية الأجهزة - قسم المبيعات" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:8px"></label>
        <label>الموقع / الجهة (اختياري)<input id="wiz-project-site" type="text" value="${esc(saved?.projectSite||'')}" placeholder="مثال: القاهرة - المقر الرئيسي" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:8px"></label>
        <label style="grid-column:1/-1">ملاحظات / متطلبات إضافية<textarea id="wiz-notes" rows="3" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:8px">${esc(saved?.notes||'')}</textarea></label>
      </div>`;
  }

  function buildItemsTable(items){
    if (!items.length) return '<div class="muted">لا توجد عناصر مضافة بعد.</div>';
    const rows = items.map((it,i)=>{
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
    return `<div class="table-wrap" style="overflow:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="text-align:right;padding:6px;border-bottom:1px solid #ddd">#</th>
          <th style="text-align:right;padding:6px;border-bottom:1px solid #ddd">الوصف</th>
          <th style="text-align:right;padding:6px;border-bottom:1px solid #ddd">الكمية</th>
          <th style="text-align:right;padding:6px;border-bottom:1px solid #ddd">سعر الوحدة</th>
          <th style="text-align:right;padding:6px;border-bottom:1px solid #ddd">الإجمالي</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:10px;text-align:left">
        <div>Subtotal: <strong>${t.subtotal.toFixed(2)}</strong></div>
        <div>Grand Total: <strong>${t.grand.toFixed(2)}</strong></div>
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
      currency: 'USD',
      client: { name: client.name||'', email: client.email||'', contact: client.company||'', phone: '' },
      project: { name: client.projectName||'', site: client.projectSite||'' },
      items
    };
  }

  async function handle(action){
    const name = $id('wiz-name')?.value.trim();
    const email= $id('wiz-email')?.value.trim();
    const company=$id('wiz-company')?.value.trim();
    const notes= $id('wiz-notes')?.value.trim();
    const projectName=$id('wiz-project-name')?.value.trim();
    const projectSite=$id('wiz-project-site')?.value.trim();
  if (!name || !email){ window.QiqToast?.error?.('يرجى إدخال الاسم والبريد الإلكتروني'); return; }
  if (!projectName){ window.QiqToast?.error?.('يرجى إدخال اسم المشروع'); return; }
    saveClient({ name, email, company, notes, projectName, projectSite });

    const payload = payloadFromState();
    payload.action = action;
    payload.client.name = name; payload.client.email = email; payload.client.contact = company;
    payload.project.name = projectName; payload.project.site = projectSite;
    try{
      const r = await fetch('/api/quote-email', { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error('HTTP '+r.status);
      const j = await r.json();
      if (action === 'download' && j?.pdfBase64){
        const a = document.createElement('a');
        a.href = 'data:application/pdf;base64,'+j.pdfBase64;
        const baseName = `${payload.number||'quotation'}${payload?.project?.name ? ' - ' + payload.project.name : ''}`;
        a.download = baseName + '.pdf';
        document.body.appendChild(a); a.click(); a.remove();
      }
      if (action === 'custom'){
  window.QiqToast?.success?.('تم إرسال طلبك وسنتواصل معك قريبًا.');
      } else if (action === 'send') {
  window.QiqToast?.success?.('تم إرسال العرض إلى بريدك.');
      }
  }catch(e){ console.warn(e); window.QiqToast?.error?.('تعذر تنفيذ العملية الآن'); }
  }

  function render(step){
    const items = getItems();
    const saved = loadClient();
    const html1 = buildClientForm(saved);
    const html2 = buildItemsTable(items);
    const steps = `
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <div class="chip ${step===1?'active':''}">1) بيانات العميل</div>
        <div class="chip ${step===2?'active':''}">2) عرض السعر</div>
      </div>`;
    const css = `
      <style>
        .chip{background:#f3f4f6;border-radius:999px;padding:4px 10px;font-size:12px;color:#374151}
        .chip.active{background:#eef2ff;color:#3730a3}
        .wiz-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:12px}
        .btn{border:0;border-radius:10px;padding:8px 12px;background:#1e3a8a;color:#fff;cursor:pointer}
        .btn.secondary{background:#6b7280}
      </style>`;
    const inner = step===1 ? html1+`<div class="wiz-actions"><button class="btn" id="wiz-next">التالي</button></div>`
                           : html2+`<div class="wiz-actions">
            <button class="btn secondary" id="wiz-back">رجوع</button>
            <button class="btn" id="wiz-download">Download PDF</button>
            <button class="btn" id="wiz-send">Send by Email</button>
            <button class="btn" id="wiz-custom">Get Custom Quote</button>
            <button class="btn secondary" id="wiz-back-step1">الرجوع إلى بيانات العميل</button>
          </div>`;
    const panel = css + steps + inner;

    try{
      if (window.QiqModal){ QiqModal.open('#', { title:'\u0637\u0644\u0628 \u0639\u0631\u0636 \u0633\u0639\u0631', html: panel, size: 'sm' }); }
      else alert('Wizard requires modal.js');
    }catch{}

    // Robustly wire handlers after iframe content is ready (load + retry fallback)
    function bindInside(){
      const frame = window.QiqModal?.getFrame?.();
      const doc = frame?.contentDocument; if (!doc) return false;
      const q = (sel)=> doc.getElementById(sel);
      const next = q('wiz-next');
      const back = q('wiz-back');
      const dl   = q('wiz-download');
      const send = q('wiz-send');
      const cust = q('wiz-custom');
      const back1= q('wiz-back-step1');
      // If none found yet, not ready
      if (!next && !dl && !send && !cust && !back && !back1) return false;
      // Helper to avoid double binding
      const on = (el, type, fn)=>{ if (!el) return; if (el.__bound) return; el.__bound = true; el.addEventListener(type, fn); };
      on(next, 'click', (e)=>{ e.preventDefault();
        const name = doc.getElementById('wiz-name')?.value.trim();
        const email= doc.getElementById('wiz-email')?.value.trim();
        const projectName = doc.getElementById('wiz-project-name')?.value.trim();
        const company = doc.getElementById('wiz-company')?.value.trim();
        const notes = doc.getElementById('wiz-notes')?.value.trim();
        const projectSite = doc.getElementById('wiz-project-site')?.value.trim();
        if (!name || !email){ window.parent.QiqToast?.error?.('\u064a\u0631\u062c\u0649 \u0625\u062f\u062e\u0627\u0644 \u0627\u0644\u0627\u0633\u0645 \u0648\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a'); return; }
        if (!projectName){ window.parent.QiqToast?.error?.('\u064a\u0631\u062c\u0649 \u0625\u062f\u062e\u0627\u0644 \u0627\u0633\u0645 \u0627\u0644\u0645\u0634\u0631\u0648\u0639'); return; }
        window.parent.localStorage.setItem(STATE_KEY, JSON.stringify({ name, email, company, notes, projectName, projectSite }));
        render(2);
      });
      on(back, 'click', (e)=>{ e.preventDefault(); render(1); });
      on(dl,   'click', (e)=>{ e.preventDefault(); handle('download'); });
      on(send, 'click', (e)=>{ e.preventDefault(); handle('send'); });
      on(cust, 'click', (e)=>{ e.preventDefault(); handle('custom'); });
      on(back1,'click', (e)=>{ e.preventDefault(); render(1); });
      return true;
    }
    // Try bind immediately, then via load, then retries
    if (!bindInside()){
      const frame = window.QiqModal?.getFrame?.();
      try{ frame?.addEventListener('load', bindInside, { once: true }); }catch{}
      let tries = 0; const max = 40; // ~4s
      const iv = setInterval(()=>{ if (bindInside() || ++tries>=max) clearInterval(iv); }, 100);
    }
  }

  function openWizard(e){ if (e) e.preventDefault(); render(1); }

  // Expose as global to bind from buttons
  window.QiqQuoteWizard = { open: openWizard };

  // Attach default listeners if buttons exist
  document.addEventListener('click', function(ev){
    const btn = ev.target.closest('[data-open-quote-wizard]');
    if (btn){ ev.preventDefault(); openWizard(); }
  });
})();
