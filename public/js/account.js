// /public/js/account.js
import { apiRegister, apiLogin, apiLogout, apiMe } from './api.js';

const regF = document.getElementById('regForm');
const logF = document.getElementById('logForm');
const meBox = document.getElementById('meBox');
const meTxt = document.getElementById('meTxt');

async function refreshMe(){
  const u = await apiMe().catch(()=>null);
  if(u){ meTxt.textContent = `مسجل كـ ${u.name || ''} <${u.email}>`; }
  else { meTxt.textContent = 'غير مسجل دخول'; }
}
refreshMe();

regF.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const name = document.getElementById('rName').value.trim();
  const email = document.getElementById('rEmail').value.trim();
  const password = document.getElementById('rPass').value;
  const out = document.getElementById('rOut');
  out.textContent = 'جارٍ التسجيل...';
  try{
    await apiRegister({ name, email, password });
    out.textContent = 'تم التسجيل وتسجيل الدخول.';
    refreshMe();
  }catch(err){
    out.textContent = `خطأ: ${err.message}`;
  }
});

logF.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email = document.getElementById('lEmail').value.trim();
  const password = document.getElementById('lPass').value;
  const out = document.getElementById('lOut');
  out.textContent = 'جارٍ الدخول...';
  try{
    await apiLogin({ email, password });
    out.textContent = 'تم تسجيل الدخول.';
    refreshMe();
  }catch(err){
    out.textContent = `خطأ: ${err.message}`;
  }
});

document.getElementById('logoutBtn').addEventListener('click', async ()=>{
  await apiLogout();
  refreshMe();
});
