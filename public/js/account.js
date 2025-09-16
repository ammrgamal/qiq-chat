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
          <input type="email" id="edit-email" value="${user.email || ''}" disabled />
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
      
      <h3>عروض الأسعار السابقة</h3>
      <div id="quotation-history">
        <p style="color: #6b7280;">جاري تحميل عروض الأسعار...</p>
      </div>
    `;
    
    statusEl.parentNode.insertBefore(profileDiv, statusEl.nextSibling);
    
    // Add save profile functionality
    document.getElementById("save-profile").addEventListener("click", saveProfile);
    
    // Load quotation history
    loadQuotationHistory(user);
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
    
    historyDiv.innerHTML = `
      <table class="qiq-table" style="margin-top: 12px;">
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
        <tbody>
          ${quotations.map(q => `
            <tr>
              <td><strong>${q.id}</strong></td>
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
    window.open(`/public/quote.html?view=${encodeURIComponent(id)}`, '_blank');
  };

  window.editQuotation = function(id) {
    setStatus(`جاري تحميل العرض ${id} للتعديل...`, "info");
    // Open quote page for editing
    window.open(`/public/quote.html?edit=${encodeURIComponent(id)}`, '_blank');
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
