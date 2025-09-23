// Admin dashboard functionality
(function() {
  'use strict';

  let isAdminAuthenticated = false;
  let adminToken = null;

  // DOM elements
  const loginModal = document.getElementById('admin-login-modal');
  const loginForm = document.getElementById('admin-login-form');
  const loginError = document.getElementById('admin-login-error');
  const logoutBtn = document.getElementById('btn-logout');

  // Initialize
  init();

  function init() {
    // Check if already authenticated
    const savedToken = sessionStorage.getItem('qiq_admin_token');
    if (savedToken) {
      adminToken = savedToken;
      isAdminAuthenticated = true;
      hideLoginModal();
      loadDashboard();
    }

    // Setup event listeners
    setupEventListeners();
  }

  function setupEventListeners() {
    // Login form
    loginForm.addEventListener('submit', handleAdminLogin);
    
    // Logout button
    logoutBtn.addEventListener('click', handleLogout);
    
    // Tab navigation
    document.querySelectorAll('.tab-link').forEach(link => {
      link.addEventListener('click', handleTabClick);
    });

    // Search and filter inputs
    setupFilters();

    // Config tab buttons
    document.getElementById('cfg-load')?.addEventListener('click', loadConfig);
    document.getElementById('cfg-save')?.addEventListener('click', saveConfig);
  }

  function setupFilters() {
    // Users filters
    const usersSearch = document.getElementById('users-search');
    const usersStatus = document.getElementById('users-status');
    if (usersSearch) usersSearch.addEventListener('input', () => filterTable('users'));
    if (usersStatus) usersStatus.addEventListener('change', () => filterTable('users'));

    // Quotations filters
    const quotationsSearch = document.getElementById('quotations-search');
    const quotationsStatus = document.getElementById('quotations-status');
    const quotationsDate = document.getElementById('quotations-date');
    if (quotationsSearch) quotationsSearch.addEventListener('input', () => filterTable('quotations'));
    if (quotationsStatus) quotationsStatus.addEventListener('change', () => filterTable('quotations'));
    if (quotationsDate) quotationsDate.addEventListener('change', () => filterTable('quotations'));

    // Activity filters
    const activitySearch = document.getElementById('activity-search');
    const activityAction = document.getElementById('activity-action');
    const activityDate = document.getElementById('activity-date');
    if (activitySearch) activitySearch.addEventListener('input', () => filterTable('activity'));
    if (activityAction) activityAction.addEventListener('change', () => filterTable('activity'));
    if (activityDate) activityDate.addEventListener('change', () => filterTable('activity'));
  }

  async function handleAdminLogin(e) {
    e.preventDefault();
    const password = document.getElementById('admin-password').value;
    
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        adminToken = data.token;
        isAdminAuthenticated = true;
        sessionStorage.setItem('qiq_admin_token', adminToken);
        hideLoginModal();
        loadDashboard();
        loginError.textContent = '';
      } else {
        loginError.textContent = data.error || 'خطأ في تسجيل الدخول';
      }
    } catch (error) {
      console.error('Login error:', error);
      loginError.textContent = 'خطأ في الاتصال بالخادم';
    }
  }

  function handleLogout() {
    isAdminAuthenticated = false;
    adminToken = null;
    sessionStorage.removeItem('qiq_admin_token');
    showLoginModal();
  }

  function handleTabClick(e) {
    e.preventDefault();
    const target = e.target.getAttribute('href').substring(1);
    
    // Update active tab
    document.querySelectorAll('.tab-link').forEach(link => link.classList.remove('active'));
    e.target.classList.add('active');
    
    // Show corresponding content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(target).classList.add('active');
    
    // Load data for the selected tab
    switch(target) {
      case 'dashboard':
        loadDashboard();
        break;
      case 'users':
        loadUsers();
        break;
      case 'quotations':
        loadQuotations();
        break;
      case 'activity':
        loadActivity();
        break;
    }
  }

  function showLoginModal() {
    loginModal.style.display = 'flex';
  }

  function hideLoginModal() {
    loginModal.style.display = 'none';
  }

  async function loadDashboard() {
    if (!isAdminAuthenticated) return;
    
    try {
      // Load stats from backend
      const stats = await fetchData('/api/admin/stats');
      
      // Update stats
      document.getElementById('stat-users').textContent = stats.totalUsers || 0;
      document.getElementById('stat-quotations').textContent = stats.totalQuotations || 0;
      document.getElementById('stat-today').textContent = stats.todayQuotations || 0;
      document.getElementById('stat-active').textContent = stats.activeUsers || 0;
      
      // Show recent activity
      displayRecentActivity(stats.recentActivity || []);
      
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  }

  async function loadConfig(){
    if (!isAdminAuthenticated) return;
    try{
      const res = await fetch('/api/admin/config', { headers:{ 'Authorization': `Bearer ${adminToken}`, 'content-type':'application/json' }});
      if (!res.ok) throw new Error('HTTP '+res.status);
      const cfg = await res.json();
      document.getElementById('cfg-instructions').value = cfg.instructions || '';
      document.getElementById('cfg-bundles').value = JSON.stringify(cfg.bundles || [], null, 2);
      try{
        const ai = cfg.ai || {};
        const overrideEl = document.getElementById('cfg-ai-override');
        const allowEl = document.getElementById('cfg-ai-allowed');
        if (overrideEl) overrideEl.checked = !!ai.autoApproveOverride;
        if (allowEl) allowEl.value = (Array.isArray(ai.allowedDomains) ? ai.allowedDomains.join('\n') : '');
      }catch{}
      // Surface environment info (AUTO_APPROVE and AI providers) if present
      try{
        const env = cfg._env || {};
        const el = document.getElementById('cfg-env-info');
        if (el){
          el.innerHTML = `
            <div class="muted" style="margin-top:8px">
              AUTO_APPROVE: <b>${env.autoApprove ? 'ON' : 'OFF'}</b> ·
              OpenAI: <b>${env.aiProviders?.openai ? 'OK' : '—'}</b> ·
              Gemini: <b>${env.aiProviders?.gemini ? 'OK' : '—'}</b>
              ${env.notes ? `<div style='margin-top:4px;color:#9ca3af'>${env.notes}</div>` : ''}
            </div>`;
        }
      }catch{}
      try{ window.QiqToast?.success?.('تم التحميل', 1500); }catch{}
    }catch(e){ console.warn(e); try{ window.QiqToast?.error?.('تعذر التحميل', 2000);}catch{} }
  }

  async function saveConfig(){
    if (!isAdminAuthenticated) return;
    try{
      const instructions = document.getElementById('cfg-instructions').value || '';
      let bundles = [];
      try{ bundles = JSON.parse(document.getElementById('cfg-bundles').value || '[]'); }catch{ bundles = []; }
      // AI settings
      const overrideEl = document.getElementById('cfg-ai-override');
      const allowEl = document.getElementById('cfg-ai-allowed');
      const allowedDomains = (allowEl?.value || '')
        .split(/\r?\n/)
        .map(s=>s.trim())
        .filter(Boolean);
      const ai = { autoApproveOverride: !!(overrideEl && overrideEl.checked), allowedDomains };
      const res = await fetch('/api/admin/config', { method:'POST', headers:{ 'Authorization': `Bearer ${adminToken}`, 'content-type':'application/json' }, body: JSON.stringify({ instructions, bundles, ai }) });
      if (!res.ok) throw new Error('HTTP '+res.status);
      try{ window.QiqToast?.success?.('تم الحفظ', 1500); }catch{}
    }catch(e){ console.warn(e); try{ window.QiqToast?.error?.('تعذر الحفظ', 2000);}catch{} }
  }

  async function loadUsers() {
    if (!isAdminAuthenticated) return;
    
    try {
      const users = await fetchData('/api/admin/users');
      displayUsers(users);
    } catch (error) {
      console.error('Error loading users:', error);
      document.getElementById('users-tbody').innerHTML = '<tr><td colspan="7">خطأ في تحميل البيانات</td></tr>';
    }
  }

  async function loadQuotations() {
    if (!isAdminAuthenticated) return;
    
    try {
      const quotations = await fetchData('/api/admin/quotations');
      displayQuotations(quotations);
    } catch (error) {
      console.error('Error loading quotations:', error);
      document.getElementById('quotations-tbody').innerHTML = '<tr><td colspan="7">خطأ في تحميل البيانات</td></tr>';
    }
  }

  async function loadActivity() {
    if (!isAdminAuthenticated) return;
    
    try {
      const activity = await fetchData('/api/admin/activity');
      displayActivity(activity);
    } catch (error) {
      console.error('Error loading activity:', error);
      document.getElementById('activity-tbody').innerHTML = '<tr><td colspan="4">خطأ في تحميل البيانات</td></tr>';
    }
  }

  async function fetchData(url) {
    if (!adminToken) {
      throw new Error('No admin token available');
    }
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        // Token expired or invalid, logout
        handleLogout();
        throw new Error('Authentication expired');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  }

  function displayUsers(users) {
    const tbody = document.getElementById('users-tbody');
    window.allUsers = users; // Store for filtering
    
    tbody.innerHTML = users.map(user => `
      <tr>
        <td>${user.company || '-'}</td>
        <td>${user.email}</td>
        <td>${user.phone || '-'}</td>
        <td>${formatDate(user.createdAt)}</td>
        <td>${formatDate(user.lastActive)}</td>
        <td><span class="status-chip ${user.verified ? 'status-active' : 'status-inactive'}">${user.verified ? 'متحقق' : 'غير متحقق'}</span></td>
        <td>
          <button class="btn-admin" onclick="viewUserDetails('${user.email}')">تفاصيل</button>
          <button class="btn-admin btn-danger" onclick="deleteUser('${user.email}')">حذف</button>
        </td>
      </tr>
    `).join('');
  }

  function displayQuotations(quotations) {
    const tbody = document.getElementById('quotations-tbody');
    window.allQuotations = quotations; // Store for filtering
    
    tbody.innerHTML = quotations.map(quotation => `
      <tr>
        <td><strong>${quotation.id}</strong></td>
        <td>${quotation.clientName || '-'}</td>
        <td>${quotation.userEmail}</td>
        <td>${formatDate(quotation.date)}</td>
        <td>${quotation.total}</td>
        <td><span class="status-chip">${quotation.status}</span></td>
        <td>
          <button class="btn-admin" onclick="viewQuotationDetails('${quotation.id}')">تفاصيل</button>
          <button class="btn-admin btn-danger" onclick="deleteQuotation('${quotation.id}')">حذف</button>
        </td>
      </tr>
    `).join('');
  }

  function displayActivity(activities) {
    const tbody = document.getElementById('activity-tbody');
    window.allActivities = activities; // Store for filtering
    
    tbody.innerHTML = activities.map(activity => `
      <tr>
        <td>${formatDateTime(activity.timestamp)}</td>
        <td>${activity.userEmail}</td>
        <td>${getActionLabel(activity.action)}</td>
        <td>${formatActivityDetails(activity.details)}</td>
      </tr>
    `).join('');
  }

  function displayRecentActivity(activities) {
    const container = document.getElementById('recent-activity');
    
    if (!activities || activities.length === 0) {
      container.innerHTML = '<p style="color:#6b7280">لا توجد نشاطات حديثة</p>';
      return;
    }
    
    container.innerHTML = activities.map(activity => `
      <div style="padding:8px 0;border-bottom:1px solid #f3f4f6">
        <div style="font-weight:500">${getActionLabel(activity.action)} - ${activity.userEmail}</div>
        <div style="font-size:12px;color:#6b7280">${formatDateTime(activity.timestamp)}</div>
      </div>
    `).join('');
  }

  function filterTable(type) {
    // This would implement filtering logic for each table type
    console.log(`Filtering ${type} table`);
  }

  function formatDate(dateString) {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('ar-EG');
    } catch {
      return dateString;
    }
  }

  function formatDateTime(dateString) {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleString('ar-EG');
    } catch {
      return dateString;
    }
  }

  function getActionLabel(action) {
    const labels = {
      'quotation_save': 'حفظ عرض سعر',
      'quotations_view': 'عرض العروض',
      'user_login': 'تسجيل دخول',
      'user_register': 'تسجيل جديد'
    };
    return labels[action] || action;
  }

  function formatActivityDetails(details) {
    if (!details) return '-';
    if (typeof details === 'string') return details;
    return Object.entries(details).map(([key, value]) => `${key}: ${value}`).join(', ');
  }

  // Global functions for actions
  window.viewUserDetails = function(email) {
    alert(`عرض تفاصيل المستخدم: ${email}`);
  };

  window.deleteUser = async function(email) {
    if (confirm(`هل أنت متأكد من حذف المستخدم: ${email}؟`)) {
      try {
        const response = await fetch(`/api/admin/delete-user?email=${encodeURIComponent(email)}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          alert('تم حذف المستخدم بنجاح');
          loadUsers(); // Refresh the users list
        } else {
          const error = await response.json();
          alert('خطأ في حذف المستخدم: ' + error.error);
        }
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('خطأ في الاتصال بالخادم');
      }
    }
  };

  window.viewQuotationDetails = function(id) {
    openQuotationModal(id);
  };

  window.deleteQuotation = async function(id) {
    if (confirm(`هل أنت متأكد من حذف العرض: ${id}؟`)) {
      try {
        const response = await fetch(`/api/admin/delete-quotation?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          alert('تم حذف العرض بنجاح');
          loadQuotations(); // Refresh the quotations list
        } else {
          const error = await response.json();
          alert('خطأ في حذف العرض: ' + error.error);
        }
      } catch (error) {
        console.error('Error deleting quotation:', error);
        alert('خطأ في الاتصال بالخادم');
      }
    }
  };

  window.exportUsers = function() {
    exportToCSV(window.allUsers || [], 'users');
  };

  window.exportQuotations = function() {
    exportToCSV(window.allQuotations || [], 'quotations');
  };

  window.exportActivity = function() {
    exportToCSV(window.allActivities || [], 'activity');
  };

  function exportToCSV(data, type) {
    if (!data || data.length === 0) {
      alert('لا توجد بيانات للتصدير');
      return;
    }
    
    const csvContent = convertToCSV(data, type);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${type}-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function convertToCSV(data, type) {
    if (!data.length) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }

})();

// Quotation detail modal implementation
(function(){
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

  async function fetchAdmin(url){
    const token = sessionStorage.getItem('qiq_admin_token');
    const res = await fetch(url, { headers:{ 'Authorization': `Bearer ${token}`, 'content-type':'application/json' }});
    if (!res.ok) throw new Error('HTTP '+res.status);
    return res.json();
  }
  async function postAdmin(url, body){
    const token = sessionStorage.getItem('qiq_admin_token');
    const res = await fetch(url, { method:'POST', headers:{ 'Authorization': `Bearer ${token}`, 'content-type':'application/json' }, body: JSON.stringify(body||{}) });
    if (!res.ok) throw new Error('HTTP '+res.status);
    return res.json();
  }

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
      const q = await fetchAdmin(`/api/admin/quotation/${encodeURIComponent(id)}`);
      document.getElementById('qmod-title').textContent = `تفاصيل العرض: ${id}`;
      box.innerHTML = renderDetails(q);
      // Initialize BOQ images toggle from localStorage (default: ON)
      try{
        const pref = localStorage.getItem('qiq_admin_boq_images');
        const chk = box.querySelector('#qmod-boq-images');
        if (chk) chk.checked = (pref == null) ? true : (pref === '1');
      }catch{}
      // Wire form
      box.querySelector('#qmod-notes-form').addEventListener('submit', async (e)=>{
        e.preventDefault();
        const note = box.querySelector('#qmod-note-input').value.trim();
        if (!note) return;
        await postAdmin(`/api/admin/quotation/${encodeURIComponent(id)}/notes`, { note });
        const fresh = await fetchAdmin(`/api/admin/quotation/${encodeURIComponent(id)}`);
        box.innerHTML = renderDetails(fresh);
      });
      // Resend
      box.querySelector('#qmod-resend').addEventListener('click', async ()=>{
        try{ await postAdmin(`/api/admin/quotation/${encodeURIComponent(id)}/resend-email`, {}); window.QiqToast?.success?.('تم الإرسال', 1500);}catch{ window.QiqToast?.error?.('تعذر الإرسال', 2000);} 
      });
      // PDF (advanced with fallback)
      box.querySelector('#qmod-pdf').addEventListener('click', async ()=>{
        const includeImages = !!box.querySelector('#qmod-boq-images')?.checked;
        try{ localStorage.setItem('qiq_admin_boq_images', includeImages ? '1' : '0'); }catch{}
        try{ await window.QiqAdminPdf?.buildAndDownload(q, { includeImages }); }
        catch{ buildAndDownloadSimplePdf(q); }
      });
    }catch(e){ console.warn(e); const box = document.getElementById('qmod-body'); if (box) box.textContent = 'خطأ في التحميل'; }
  };
})();