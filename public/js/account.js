// /public/js/account.js
(function () {
  "use strict";

  // ============ DOM ============
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const statusEl = document.getElementById("account-status");

  // ============ Helpers ============
  const setStatus = (msg, type = "info") => {
    statusEl.textContent = msg || "";
    statusEl.style.color = type === "error" ? "#b91c1c" : type === "success" ? "#065f46" : "#6b7280";
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
      });
    }
  }

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

  // ============ On load: لو عندي توكن اعرض الحالة ============
  (async function init() {
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
