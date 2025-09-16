// /public/js/quote-form.js
(function () {
  "use strict";

  // ============ DOM ============
  const form = document.getElementById("quote-form");
  const statusEl = document.getElementById("quote-status");
  const companyEl = document.getElementById("company");
  const emailEl = document.getElementById("email");
  const phoneEl = document.getElementById("phone");
  const detailsEl = document.getElementById("details");

  // ============ Helpers ============
  const getToken = () => localStorage.getItem("qiq_token") || "";
  const setStatus = (msg, type = "info") => {
    statusEl.textContent = msg || "";
    statusEl.style.color = type === "error" ? "#b91c1c" : type === "success" ? "#065f46" : "#6b7280";
  };

  // ============ Business Email Validation ============
  function isBusinessEmail(email) {
    const personalDomains = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
      'live.com', 'msn.com', 'aol.com', 'icloud.com', 
      'me.com', 'mail.com', '163.com', '126.com', 'qq.com'
    ];
    
    const domain = email.toLowerCase().split('@')[1];
    return domain && !personalDomains.includes(domain);
  }

  async function postJSON(path, body) {
    const headers = { "content-type": "application/json" };
    const token = getToken();
    if (token) headers["authorization"] = `Bearer ${token}`;
    const res = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
    let data = null;
    try { data = await res.json(); } catch { /* ignore */ }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  // ============ Submit ============
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const company = companyEl.value.trim();
    const email = emailEl.value.trim();
    const phone = phoneEl.value.trim();
    const details = detailsEl.value.trim();

    if (!company || !email || !phone) {
      setStatus("من فضلك املأ الحقول المطلوبة (الشركة، البريد، الهاتف).", "error");
      return;
    }

    // التحقق من البريد الإلكتروني المؤسسي
    if (!isBusinessEmail(email)) {
      setStatus("يرجى استخدام بريد إلكتروني مؤسسي (وليس Gmail أو Yahoo أو Hotmail).", "error");
      return;
    }

    setStatus("جاري إرسال الطلب…");
    try {
      const payload = { company, email, phone, details, source: "custom-form" };
      // Endpoint المتوقع عندك: /api/quote
      const data = await postJSON("/api/quote", payload);

      // نجاح
      setStatus(data.message || "تم إرسال طلب عرض السعر بنجاح. سنتواصل معك قريبًا.", "success");
      form.reset();
    } catch (err) {
      setStatus(`حصل خطأ: ${err.message}`, "error");
    }
  });
})();
