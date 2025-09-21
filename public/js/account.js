// /public/js/account.js
(function () {
  "use strict";

  // ============ DOM ============
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const statusEl = document.getElementById("account-status");

  // ============ Helpers ============
  const setStatus = (msg, type = "info") => {
    if (statusEl) {
      statusEl.textContent = msg || "";
      statusEl.style.color = type === "error" ? "#b91c1c" : type === "success" ? "#065f46" : "#6b7280";
    }
    
    // Also use toast system if available
    if (window.QiqToast && window.QiqToast.show && msg) {
      window.QiqToast.show(msg, type);
    }
  };

  const storage = {
    get token() { return localStorage.getItem("qiq_token") || ""; },
    set token(t) { t ? localStorage.setItem("qiq_token", t) : localStorage.removeItem("qiq_token"); }
  };

  // Copy helper (global)
  window.copyText = async function(text){
    try{
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(String(text));
      } else {
        const ta = document.createElement('textarea');
        ta.value = String(text);
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setStatus('تم نسخ رقم العرض إلى الحافظة ✅', 'success');
    }catch{
      setStatus('تعذر نسخ النص', 'error');
    }
  }

  async function postJSON(path, body) {
    const headers = { "content-type": "application/json" };
    if (storage.token) headers["authorization"] = `Bearer ${storage.token}`;
    const res = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
    let data = null;
    try { data = await res.json(); } catch { /* ignore */ }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data || {};
  }

  async function getJSON(path) {
    const headers = {};
    if (storage.token) headers["authorization"] = `Bearer ${storage.token}`;
    const res = await fetch(path, { headers });
    let data = null;
    try { data = await res.json(); } catch { /* ignore */ }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data || {};
  }

  // ============ UI Helpers ============
  function showLoggedInUI(user) {
    const name = user?.company || user?.name || user?.email || "مستخدم";
    setStatus(`تم تسجيل الدخول ✓ أهلاً ${name}`, "success");

    // Display user profile and quotation history
    displayUserProfile(user);

    // لو حابب زر خروج بسيط:
    let logoutBtn = document.getElementById("qiq-logout");
    if (!logoutBtn) {
      logoutBtn = document.createElement("button");
      logoutBtn.id = "qiq-logout";
      logoutBtn.className = "qiq-btn";
      logoutBtn.textContent = "تسجيل الخروج";
      statusEl.insertAdjacentElement("afterend", document.createElement("br"));
      statusEl.insertAdjacentElement("afterend", logoutBtn);
      logoutBtn.addEventListener("click", async () => {
        try {
          // اختياري: لو عندك /api/users/logout
          await postJSON("/api/users/logout", {});
        } catch { /* ignore */ }
        storage.token = "";
        setStatus("تم تسجيل الخروج.", "info");
        logoutBtn.remove();
        hideUserProfile();
      });
    }
  }

  function displayUserProfile(user) {
    // Remove existing profile if present
    hideUserProfile();
    
    const profileDiv = document.createElement("div");
    profileDiv.id = "user-profile";
    profileDiv.className = "qiq-card";
    profileDiv.style.marginTop = "16px";
    
    profileDiv.innerHTML = `
      <h3>بيانات الحساب</h3>
      <div class="qiq-form">
        <div class="row">
          <label>اسم الشركة:</label>
          <input type="text" id="edit-company" value="${user.company || ''}" />
        </div>
        <div class="row">
          <label>البريد الإلكتروني:</label>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <input type="email" id="edit-email" value="${user.email || ''}" disabled />
            <span id="email-verify-chip" class="qiq-chip" style="padding:4px 8px;border-radius:999px;border:1px solid #d1d5db;background:#f3f4f6;color:#374151;font-size:12px"></span>
          </div>
          <small style="color: #6b7280;">لا يمكن تغيير البريد الإلكتروني</small>
        </div>
        <div class="row">
          <label>رقم الهاتف:</label>
          <input type="tel" id="edit-phone" value="${user.phone || ''}" />
        </div>
        <div class="qiq-actions">
          <button id="save-profile" class="qiq-btn qiq-primary">حفظ التغييرات</button>
        </div>
      </div>
      
      <div id="verify-banner-anchor"></div>

      <h3>عروض الأسعار السابقة</h3>
      <div style="margin-bottom:12px">
        <input type="text" id="quotations-search" placeholder="البحث في العروض (رقم العرض، العميل، الحالة...)" style="width:100%;max-width:400px;padding:8px;border:1px solid #d1d5db;border-radius:8px;font-size:14px" />
      </div>
      <div id="quotation-history">
        <p style="color: #6b7280;">جاري تحميل عروض الأسعار...</p>
      </div>
    `;
    
    statusEl.parentNode.insertBefore(profileDiv, statusEl.nextSibling);
    
    // Add save profile functionality
    document.getElementById("save-profile").addEventListener("click", saveProfile);
    
    // Load quotation history
    loadQuotationHistory(user);

    // Show verify email banner/CTA
    ensureVerifyBanner(user?.email);

    // Update verify chip
    updateVerifyChip();
  }

  function hideUserProfile() {
    const existing = document.getElementById("user-profile");
    if (existing) {
      existing.remove();
    }
  }

  async function saveProfile() {
    const company = document.getElementById("edit-company").value.trim();
    const phone = document.getElementById("edit-phone").value.trim();
    
    if (!company) {
      setStatus("اسم الشركة مطلوب", "error");
      return;
    }
    
    try {
      // TODO: Implement profile update API
      setStatus("تم حفظ التغييرات بنجاح", "success");
    } catch (error) {
      setStatus(`خطأ في حفظ التغييرات: ${error.message}`, "error");
    }
  }

  function loadQuotationHistory(user) {
    const historyDiv = document.getElementById("quotation-history");
    if (!historyDiv) return;
    
    historyDiv.innerHTML = '<p style="color: #6b7280;">جاري تحميل عروض الأسعار...</p>';
    
    // Try to load quotations from API
    loadQuotationsFromAPI(user)
      .then(quotations => {
        displayQuotations(quotations, historyDiv);
      })
      .catch(error => {
        console.warn("Failed to load quotations from API:", error);
        // Fallback to mock data
        const mockQuotations = [
          { id: "QT-2024-001", date: "2024-01-15", status: "مكتمل", total: "$15,250", clientName: "عميل تجريبي" },
          { id: "QT-2024-002", date: "2024-01-20", status: "قيد المراجعة", total: "$8,900", clientName: "عميل تجريبي" },
          { id: "QT-2024-003", date: "2024-01-25", status: "مسودة", total: "$22,150", clientName: "عميل تجريبي" }
        ];
        displayQuotations(mockQuotations, historyDiv);
      });
  }

  async function ensureVerifyBanner(email){
    try{
      const anchor = document.getElementById('verify-banner-anchor');
      if (!anchor) return;
      // Simple heuristic: if email domain verified? We don't track server-side state yet, so always show CTA.
      if (!email) return;
      // If already verified locally, don't show banner
      if (localStorage.getItem('qiq_email_verified') === '1') return;
      // Create banner
      const banner = document.createElement('div');
      banner.className = 'qiq-card';
      banner.style.cssText = 'margin:12px 0; padding:12px; background:#fff7ed; border:1px solid #ffedd5; color:#7c2d12; border-radius:8px;';
      banner.innerHTML = `
        <div style="display:flex; gap:8px; align-items:center; justify-content:space-between; flex-wrap:wrap;">
          <div>لم يتم التحقق من بريدك حتى الآن. يرجى تأكيد البريد لضمان استلام عروض الأسعار والإشعارات.</div>
          <div class="qiq-actions">
            <button id="btn-resend-verify" class="qiq-btn qiq-primary">إعادة إرسال رابط التحقق</button>
          </div>
        </div>`;
      anchor.replaceWith(banner);
      const btn = banner.querySelector('#btn-resend-verify');
      if (btn){
        btn.addEventListener('click', async ()=>{
          try{
            btn.disabled = true;
            btn.textContent = 'جارٍ الإرسال...';
            const r = await fetch('/api/users/send-verification', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ email }) });
            if (!r.ok) throw new Error('HTTP '+r.status);
            setStatus('تم إرسال رسالة التحقق إلى بريدك الإلكتروني.', 'success');
          }catch(e){ setStatus('تعذر إرسال رسالة التحقق.', 'error'); }
          finally{ btn.disabled = false; btn.textContent = 'إعادة إرسال رابط التحقق'; }
        });
      }
    }catch{}
  }

  function updateVerifyChip(){
    const chip = document.getElementById('email-verify-chip');
    if (!chip) return;
    const verified = localStorage.getItem('qiq_email_verified') === '1';
    if (verified){
      chip.textContent = 'Verified';
      chip.style.background = '#dcfce7';
      chip.style.color = '#166534';
      chip.style.borderColor = '#bbf7d0';
      const banner = chip.closest('main')?.querySelector('.qiq-card[style*="#fff7ed"]');
      if (banner) banner.remove();
    } else {
      chip.textContent = 'Not verified';
      chip.style.background = '#fef3c7';
      chip.style.color = '#92400e';
      chip.style.borderColor = '#fde68a';
    }
  }
  
  async function loadQuotationsFromAPI(user) {
    try {
      const response = await getJSON("/api/users/quotations");
      return response.quotations || [];
    } catch (error) {
      throw error;
    }
  }
  
  function displayQuotations(quotations, historyDiv) {
    if (!quotations || quotations.length === 0) {
      historyDiv.innerHTML = '<p style="color: #6b7280;">لا توجد عروض أسعار سابقة</p>';
      return;
    }
    
    // Store original data for filtering
    window.allQuotations = quotations;
    
    historyDiv.innerHTML = `
      <table class="qiq-table" id="quotations-table" style="margin-top: 12px;">
        <thead>
          <tr>
            <th>رقم العرض</th>
            <th>اسم العميل</th>
            <th>التاريخ</th>
            <th>الحالة</th>
            <th>الإجمالي</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody id="quotations-tbody">
          ${quotations.map(q => `
            <tr>
              <td>
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                  <strong>${q.id}</strong>
                  <button class="qiq-btn" title="نسخ" style="font-size: 12px; padding: 2px 6px; background:#f3f4f6;color:#374151;border:1px solid #e5e7eb" onclick="copyText('${q.id}')">نسخ</button>
                </div>
              </td>
              <td>${q.clientName || 'غير محدد'}</td>
              <td>${q.date}</td>
              <td><span class="qiq-chip" style="${getStatusColor(q.status)}">${q.status}</span></td>
              <td>${formatCurrency(q.total, q.currency)}</td>
              <td>
                <button class="qiq-btn" onclick="viewQuotation('${q.id}')" style="font-size: 12px; padding: 4px 8px;">عرض</button>
                ${q.status === 'مسودة' ? `<button class="qiq-btn qiq-primary" onclick="editQuotation('${q.id}')" style="font-size: 12px; padding: 4px 8px;">تعديل</button>` : ''}
                <button class="qiq-btn" onclick="downloadQuotation('${q.id}')" style="font-size: 12px; padding: 4px 8px; background: #059669;">تحميل</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      
      <div style="margin-top: 12px; padding: 8px; background: #f8fafc; border-radius: 8px; font-size: 13px; color: #6b7280;">
        💡 <strong>نصيحة:</strong> يمكنك تتبع عروض الأسعار باستخدام الأرقام المرجعية أعلاه. 
        احفظ هذه الأرقام لسهولة المتابعة مع فريق المبيعات.
      </div>
    `;
    // Wire up search after rendering
    const searchInput = document.getElementById('quotations-search');
    if (searchInput) {
      searchInput.addEventListener('input', function(e) {
        filterQuotations(e.target.value);
      });
    }
  }
  
  function formatCurrency(amount, currency = 'USD') {
    if (typeof amount === 'string') return amount; // Already formatted
    
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD',
        maximumFractionDigits: 0
      }).format(amount);
    } catch {
      return `${amount.toLocaleString()} ${currency || 'USD'}`;
    }
  }

  // Filtering function for quotations table
  function filterQuotations(searchTerm) {
    const tbody = document.getElementById('quotations-tbody');
    const allQuotations = window.allQuotations || [];
    if (!tbody || !allQuotations.length) return;
    
    const query = (searchTerm || '').toString().toLowerCase();
    const filtered = allQuotations.filter(q =>
      (q.id && q.id.toLowerCase().includes(query)) ||
      (q.clientName && q.clientName.toLowerCase().includes(query)) ||
      (q.status && q.status.includes(searchTerm)) ||
      (q.date && q.date.includes(searchTerm))
    );
    
    tbody.innerHTML = filtered.map(q => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <strong>${q.id}</strong>
            <button class="qiq-btn" title="نسخ" style="font-size: 12px; padding: 2px 6px; background:#f3f4f6;color:#374151;border:1px solid #e5e7eb" onclick="copyText('${q.id}')">نسخ</button>
          </div>
        </td>
        <td>${q.clientName || 'غير محدد'}</td>
        <td>${q.date}</td>
        <td><span class="qiq-chip" style="${getStatusColor(q.status)}">${q.status}</span></td>
        <td>${formatCurrency(q.total, q.currency)}</td>
        <td>
          <button class="qiq-btn" onclick="viewQuotation('${q.id}')" style="font-size: 12px; padding: 4px 8px;">عرض</button>
          ${q.status === 'مسودة' ? `<button class="qiq-btn qiq-primary" onclick="editQuotation('${q.id}')" style="font-size: 12px; padding: 4px 8px;">تعديل</button>` : ''}
          <button class="qiq-btn" onclick="downloadQuotation('${q.id}')" style="font-size: 12px; padding: 4px 8px; background: #059669;">تحميل</button>
        </td>
      </tr>
    `).join('');
  }

  function getStatusColor(status) {
    const colors = {
      'مكتمل': 'background: #dcfce7; color: #166534; border-color: #bbf7d0;',
      'قيد المراجعة': 'background: #fef3c7; color: #92400e; border-color: #fde68a;',
      'مسودة': 'background: #e5e7eb; color: #374151; border-color: #d1d5db;'
    };
    return colors[status] || colors['مسودة'];
  }

  // Global functions for quotation actions
  window.viewQuotation = function(id) {
    setStatus(`جاري عرض العرض ${id}...`, "info");
    // Open quote page in new tab/window
    window.open(`/quote.html?view=${encodeURIComponent(id)}`, '_blank');
  };

  window.editQuotation = function(id) {
    setStatus(`جاري تحميل العرض ${id} للتعديل...`, "info");
    // Open quote page for editing
    window.open(`/quote.html?edit=${encodeURIComponent(id)}`, '_blank');
  };
  
  window.downloadQuotation = function(id) {
    setStatus(`جاري تحميل العرض ${id}...`, "info");
    // Simulate PDF download
    setTimeout(() => {
      const link = document.createElement('a');
      link.href = 'data:application/pdf;base64,'; // In real app, this would be the actual PDF
      link.download = `quotation-${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setStatus(`تم تحميل العرض ${id} بنجاح`, "success");
    }, 1000);
  };

  // ============ Login ============
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = (document.getElementById("login-email").value || "").trim();
      const password = (document.getElementById("login-password").value || "").trim();
      if (!email || !password) { setStatus("من فضلك أدخل البريد وكلمة المرور.", "error"); return; }

      setStatus("جاري تسجيل الدخول…");
      try {
        // متوقع: /api/users/login -> { token, user }
        const data = await postJSON("/api/users/login", { email, password });
        if (data.token) storage.token = data.token;
        setStatus("تم تسجيل الدخول بنجاح.", "success");
        if (data.user) showLoggedInUI(data.user);
        else {
          // جِب بياناتي بعد اللوجين
          try {
            const me = await getJSON("/api/users/me");
            showLoggedInUI(me.user || me);
          } catch { /* ignore */ }
        }
        loginForm.reset();
      } catch (err) {
        setStatus(`فشل تسجيل الدخول: ${err.message}`, "error");
      }
    });
  }

  // ============ Register ============
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const company = (document.getElementById("register-company").value || "").trim();
      const email = (document.getElementById("register-email").value || "").trim();
      const phone = (document.getElementById("register-phone").value || "").trim();
      const password = (document.getElementById("register-password").value || "").trim();

      if (!company || !email || !password) {
        setStatus("من فضلك املأ الحقول المطلوبة (الشركة، البريد، كلمة المرور).", "error");
        return;
      }

      // Client-side email validation
      const emailValidation = validateBusinessEmailClient(email);
      if (!emailValidation.valid) {
        setStatus(emailValidation.message, "error");
        return;
      }

      // Password validation
      if (password.length < 6) {
        setStatus("كلمة المرور يجب أن تكون على الأقل 6 أحرف", "error");
        return;
      }

      setStatus("جاري إنشاء الحساب…");
      try {
        // متوقع: /api/users/register -> { token?, user?, ok? }
        const data = await postJSON("/api/users/register", { company, email, phone, password });
        if (data.token) storage.token = data.token;
        setStatus("تم إنشاء الحساب بنجاح.", "success");

        // إن ما رجعش user جِبه
        let user = data.user;
        if (!user) {
          try { const me = await getJSON("/api/users/me"); user = me.user || me; } catch { /* ignore */ }
        }
        if (user) showLoggedInUI(user);

        registerForm.reset();
      } catch (err) {
        setStatus(`فشل إنشاء الحساب: ${err.message}`, "error");
      }
    });
  }

  // Email validation function (client-side)
  function validateBusinessEmailClient(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(email)) {
      return { valid: false, message: "صيغة البريد الإلكتروني غير صحيحة" };
    }

    // List of blocked personal email domains
    const blockedDomains = [
      'gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com', 
      'yahoo.co.uk', 'yahoo.co.jp', 'yahoo.de', 'yahoo.fr',
      'aol.com', 'mail.com', 'ymail.com', 'googlemail.com',
      'live.com', 'msn.com', 'icloud.com', 'me.com',
      'protonmail.com', 'tutanota.com'
    ];

    const domain = email.toLowerCase().split('@')[1];
    
    if (blockedDomains.includes(domain)) {
      return { 
        valid: false, 
        message: "يرجى استخدام بريد إلكتروني للعمل/الشركة وليس بريد شخصي مثل Gmail أو Hotmail" 
      };
    }

    return { valid: true };
  }

  // ============ On load: لو عندي توكن اعرض الحالة ============
  (async function init() {
    // For demo purposes, simulate a logged-in user
    const demoMode = new URLSearchParams(window.location.search).has('demo');
    
    if (demoMode) {
      // Simulate demo user login
      const demoUser = {
        id: 12345,
        email: "demo@company.com",
        company: "شركة التكنولوجيا المتقدمة",
        phone: "+201234567890"
      };
      
      storage.token = "qiq_demo_token";
      showLoggedInUI(demoUser);
      return;
    }
    
    if (!storage.token) return;
    try {
      const me = await getJSON("/api/users/me");
      if (me && (me.user || me.email || me.company)) {
        showLoggedInUI(me.user || me);
      }
    } catch {
      // التوكن غير صالح
      storage.token = "";
    }
  })();
})();
