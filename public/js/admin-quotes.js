(function(){
  'use strict';
  let adminToken = sessionStorage.getItem('qiq_admin_token');

  const loginModal = document.getElementById('admin-login-modal');
  const loginForm = document.getElementById('admin-login-form');
  const loginError = document.getElementById('admin-login-error');
  const logoutBtn = document.getElementById('btn-logout');

  const qSearch = document.getElementById('quotations-search');
  const qStatus = document.getElementById('quotations-status');
  const qDate   = document.getElementById('quotations-date');
  const qTbody  = document.getElementById('quotations-tbody');

  let allQuotations = [];

  init();

  function init(){
    loginForm.addEventListener('submit', onLogin);
    logoutBtn.addEventListener('click', onLogout);
    document.getElementById('btn-export').addEventListener('click', ()=> exportCSV(allQuotations, 'quotations'));
    qSearch.addEventListener('input', render);
    qStatus.addEventListener('change', render);
    qDate.addEventListener('change', render);

    if (adminToken){ hideLogin(); loadQuotations(); }
    else { showLogin(); }
  }

  function showLogin(){ loginModal.style.display = 'flex'; }
  function hideLogin(){ loginModal.style.display = 'none'; }

  async function onLogin(e){
    e.preventDefault();
    try{
      const password = document.getElementById('admin-password').value;
      const res = await fetch('/api/admin/login', { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ password }) });
      const data = await res.json();
      if (!res.ok || !data.success){ loginError.textContent = data.error || 'خطأ في تسجيل الدخول'; return; }
      adminToken = data.token; sessionStorage.setItem('qiq_admin_token', adminToken);
      loginError.textContent = ''; hideLogin(); loadQuotations();
    }catch(err){ loginError.textContent = 'خطأ بالخادم'; }
  }

  function onLogout(){ sessionStorage.removeItem('qiq_admin_token'); adminToken=null; showLogin(); }

  async function fetchAdmin(url){
    const res = await fetch(url, { headers:{ 'Authorization': `Bearer ${adminToken}`, 'content-type':'application/json' }});
    if (!res.ok){ if (res.status===401) onLogout(); throw new Error('HTTP '+res.status); }
    return res.json();
  }
  async function postAdmin(url, body){
    const res = await fetch(url, { method:'POST', headers:{ 'Authorization': `Bearer ${adminToken}`, 'content-type':'application/json' }, body: JSON.stringify(body||{}) });
    if (!res.ok){ if (res.status===401) onLogout(); throw new Error('HTTP '+res.status); }
    return res.json();
  }

  async function loadQuotations(){
    try{ 
      const list = await fetchAdmin('/api/admin/quotations');
      allQuotations = Array.isArray(list)? list : [];
      render();
    }catch(e){ qTbody.innerHTML = '<tr><td colspan="7">خطأ في تحميل البيانات</td></tr>'; }
  }

  function render(){
    const term = (qSearch.value||'').trim();
    const st   = qStatus.value||'';
    const d    = qDate.value||'';
    const rows = (allQuotations||[]).filter(q=>{
      const okTerm = !term || String(q.id).includes(term) || String(q.clientName||'').includes(term);
      const okSt = !st || q.status===st;
      const okD  = !d || (q.date||'').startsWith(d);
      return okTerm && okSt && okD;
    }).map(q=> `
      <tr>
        <td><strong>${q.id}</strong></td>
        <td>${q.clientName||'-'}</td>
        <td>${q.userEmail||'-'}</td>
        <td>${q.date||'-'}</td>
        <td>${q.total||'-'}</td>
        <td><span class="status-chip">${q.status||'-'}</span></td>
        <td>
          <button class="btn-admin" data-act="details" data-id="${q.id}">تفاصيل</button>
          <button class="btn-admin btn-danger" data-act="delete" data-id="${q.id}">حذف</button>
        </td>
      </tr>`).join('');
    qTbody.innerHTML = rows || '<tr><td colspan="7">لا توجد بيانات</td></tr>';
    qTbody.querySelectorAll('button[data-act]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const id = e.currentTarget.getAttribute('data-id');
        const act = e.currentTarget.getAttribute('data-act');
        if (act==='details') openQuotationModal(id);
        if (act==='delete') deleteQuotation(id);
      });
    });
  }

  async function deleteQuotation(id){
    if (!confirm(`هل تريد حذف العرض ${id}؟`)) return;
    try{
      const res = await fetch(`/api/admin/delete-quotation?id=${encodeURIComponent(id)}`, { method:'DELETE', headers:{ 'Authorization': `Bearer ${adminToken}` }});
      if (!res.ok){ const e=await res.json(); throw new Error(e.error||'فشل الحذف'); }
      window.QiqToast?.success?.('تم الحذف', 1200);
      await loadQuotations();
    }catch(e){ window.QiqToast?.error?.('تعذر الحذف', 1600); }
  }

  // Inline quotation modal (self-contained)
  const modalId = 'admin-quotation-modal';
  function ensureModal(){
    if (document.getElementById(modalId)) return;
    const div = document.createElement('div');
    div.id = modalId;
    div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:none;align-items:center;justify-content:center;z-index:9999';
    div.innerHTML = `
      <div class="qiq-card" style="max-width:900px;width:95%;max-height:90vh;overflow:auto">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <h3 id="qmod-title" style="margin:0;flex:1">تفاصيل العرض</h3>
          <button id="qmod-close" class="btn-admin">إغلاق</button>
        </div>
        <div id="qmod-body">جاري التحميل...</div>
      </div>`;
    document.body.appendChild(div);
    div.querySelector('#qmod-close').addEventListener('click', ()=> hide());
  }
  function show(){ ensureModal(); document.getElementById(modalId).style.display='flex'; }
  function hide(){ const el=document.getElementById(modalId); if (el) el.style.display='none'; }

  async function getQ(id){ return fetchAdmin(`/api/admin/quotation/${encodeURIComponent(id)}`); }

  function renderDetails(q){
    const items = Array.isArray(q?.payload?.items) ? q.payload.items : [];
    const rows = items.map((it,i)=> `<tr>
      <td>${i+1}</td>
      <td>${it.description || it.name || '-'}</td>
      <td>${it.pn||''}</td>
      <td>${it.qty||1}</td>
      <td>${it.unit||it.price||''}</td>
    </tr>`).join('');
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div><strong>رقم العرض:</strong> ${q.id}</div>
        <div><strong>التاريخ:</strong> ${q.date || (q.savedAt||'').slice(0,10)}</div>
        <div><strong>العميل:</strong> ${q.clientName||q?.payload?.client?.name||'-'}</div>
        <div><strong>البريد:</strong> ${q.userEmail||'-'}</div>
        <div><strong>الإجمالي:</strong> ${q?.payload?.totals?.grand ?? q.total ?? '-'}</div>
        <div><strong>الحالة:</strong> ${q.status||'مسودة'}</div>
      </div>
      <div class="qiq-card" style="margin-bottom:12px">
        <h4 style="margin-top:0">الأصناف</h4>
        <table class="data-table">
          <thead><tr><th>#</th><th>الوصف</th><th>رقم الصنف</th><th>الكمية</th><th>السعر</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5">لا توجد أصناف</td></tr>'}</tbody>
        </table>
      </div>
      <div class="qiq-card" style="display:grid;gap:8px">
        <h4 style="margin:0">ملاحظات داخلية</h4>
        <form id="qmod-notes-form" style="display:flex;gap:8px">
          <input id="qmod-note-input" placeholder="أضف ملاحظة..." style="flex:1;padding:8px;border:1px solid #d1d5db;border-radius:6px"/>
          <button class="btn-admin" type="submit">حفظ</button>
        </form>
        <div id="qmod-notes-list">${(q.internalNotes||[]).map(n=> `<div style="font-size:12px;color:#374151">${n.note} <span style="color:#6b7280">(${new Date(n.at).toLocaleString('ar-EG')})</span></div>`).join('')}</div>
        <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:8px;flex-wrap:wrap">
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#374151">
            <input type="checkbox" id="qmod-boq-images" />
            تضمين صور مصغرة في BOQ
          </label>
          <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="qmod-resend" class="btn-admin">إعادة إرسال الإيميل</button>
          <button id="qmod-pdf" class="btn-admin">تنزيل PDF</button>
          </div>
        </div>
      </div>`;
  }

  async function buildAndDownloadSimplePdf(q){
    const items = Array.isArray(q?.payload?.items) ? q.payload.items : [];
    const body = [["#","الوصف","PN","الكمية","السعر"]].concat(items.map((it,i)=>[
      String(i+1), it.description||it.name||'-', it.pn||'', String(it.qty||1), String(it.unit||it.price||'')
    ]));
    const dd = {
      content:[
        { text: 'عرض سعر', style:'header', alignment:'center' },
        { text: `${q.id} • ${q.date||''}`, margin:[0,0,0,8], alignment:'center' },
        { text: `العميل: ${q.clientName||'-'}`, margin:[0,0,0,12] },
        { table:{ headerRows:1, widths:['auto','*','auto','auto','auto'], body }, layout:'lightHorizontalLines' }
      ],
      styles:{ header:{ fontSize:16, bold:true } }, defaultStyle:{ font: 'Helvetica' }
    };
    window.pdfMake?.createPdf(dd).download(`${q.id}.pdf`);
  }

  window.openQuotationModal = async function(id){
    try{
      show();
      const box = document.getElementById('qmod-body');
      box.innerHTML = 'جاري التحميل...';
      const q = await getQ(id);
      document.getElementById('qmod-title').textContent = `تفاصيل العرض: ${id}`;
      box.innerHTML = renderDetails(q);
      // Initialize BOQ images toggle from localStorage (default: ON)
      try{
        const pref = localStorage.getItem('qiq_admin_boq_images');
        const chk = box.querySelector('#qmod-boq-images');
        if (chk) chk.checked = (pref == null) ? true : (pref === '1');
      }catch{}
      box.querySelector('#qmod-notes-form').addEventListener('submit', async (e)=>{
        e.preventDefault();
        const note = box.querySelector('#qmod-note-input').value.trim();
        if (!note) return;
        await postAdmin(`/api/admin/quotation/${encodeURIComponent(id)}/notes`, { note });
        const fresh = await getQ(id);
        box.innerHTML = renderDetails(fresh);
      });
      box.querySelector('#qmod-resend').addEventListener('click', async ()=>{
        try{ await postAdmin(`/api/admin/quotation/${encodeURIComponent(id)}/resend-email`, {}); window.QiqToast?.success?.('تم الإرسال', 1500);}catch{ window.QiqToast?.error?.('تعذر الإرسال', 2000);} 
      });
      box.querySelector('#qmod-pdf').addEventListener('click', async ()=>{
        const includeImages = !!box.querySelector('#qmod-boq-images')?.checked;
        try{ localStorage.setItem('qiq_admin_boq_images', includeImages ? '1' : '0'); }catch{}
        try{ await window.QiqAdminPdf?.buildAndDownload(q, { includeImages }); }
        catch{ buildAndDownloadSimplePdf(q); }
      });
    }catch(e){ const box=document.getElementById('qmod-body'); if (box) box.textContent = 'خطأ في التحميل'; }
  };
})();
