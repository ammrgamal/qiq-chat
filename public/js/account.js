// /public/js/account.js
(function () {
  const btnLogin = document.getElementById("btn-login");
  const btnRegister = document.getElementById("btn-register");
  const btnLogout = document.getElementById("btn-logout");
  const status = document.getElementById("account-status");

  function saveToken(t){ localStorage.setItem("qiq_token", t); }
  function getToken(){ return localStorage.getItem("qiq_token"); }
  function clearToken(){ localStorage.removeItem("qiq_token"); }
  function refreshUI(){
    const has = !!getToken();
    btnLogout.hidden = !has;
    status.textContent = has ? "مسجّل الدخول." : "غير مسجّل.";
  }

  btnRegister.addEventListener("click", async ()=>{
    const name = prompt("الاسم كامل؟"); if(!name) return;
    const email = prompt("الإيميل؟"); if(!email) return;
    const password = prompt("كلمة السر؟"); if(!password) return;
    status.textContent = "جارٍ التسجيل…";
    try{
      const res = await API.registerUser({ name, email, password });
      if (res.ok && res.token) {
        saveToken(res.token); refreshUI(); status.textContent = "تم التسجيل وتسجيل الدخول.";
      } else {
        status.textContent = res.error || "فشل التسجيل.";
      }
    }catch(e){ status.textContent = e.message || "فشل التسجيل."; }
  });

  btnLogin.addEventListener("click", async ()=>{
    const email = prompt("الإيميل؟"); if(!email) return;
    const password = prompt("كلمة السر؟"); if(!password) return;
    status.textContent = "جارٍ الدخول…";
    try{
      const res = await API.loginUser({ email, password });
      if (res.ok && res.token) {
        saveToken(res.token); refreshUI(); status.textContent = "تم تسجيل الدخول.";
      } else {
        status.textContent = res.error || "فشل تسجيل الدخول.";
      }
    }catch(e){ status.textContent = e.message || "فشل تسجيل الدخول."; }
  });

  btnLogout.addEventListener("click", ()=>{
    clearToken(); refreshUI(); status.textContent = "تم تسجيل الخروج.";
  });

  refreshUI();
})();
