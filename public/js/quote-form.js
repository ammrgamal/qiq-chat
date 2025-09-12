// /public/js/quote-form.js
import { apiQuote, apiMe } from './api.js';

const f = document.getElementById('quoteForm');
const out = document.getElementById('qout');

(async()=>{
  const user = await apiMe().catch(()=>null);
  if(user){
    document.getElementById('qName').value = user.name || '';
    document.getElementById('qEmail').value = user.email || '';
  }
})();

f.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const payload = {
    name: document.getElementById('qName').value.trim(),
    email: document.getElementById('qEmail').value.trim(),
    phone: document.getElementById('qPhone').value.trim(),
    company: document.getElementById('qCompany').value.trim(),
    requirements: document.getElementById('qReq').value.trim(),
    items: [] // تقدر تبعتها من سلة لاحقًا
  };
  if(!payload.name || !payload.email){
    out.textContent = 'الاسم والإيميل مطلوبان.'; return;
  }
  out.textContent = 'جارٍ الإرسال...';
  try{
    const r = await apiQuote(payload);
    out.textContent = `تم تسجيل الطلب (#${r.id || '—'}). سنتواصل معك قريبًا.`;
    f.reset();
  }catch(err){
    out.textContent = `خطأ: ${err.message}`;
  }
});
