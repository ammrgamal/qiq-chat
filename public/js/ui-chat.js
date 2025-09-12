// /public/js/ui-chat.js
import { apiSearch } from './api.js';

const win = document.getElementById('win');
const frm = document.getElementById('frm');
const inp = document.getElementById('inp');
const searchBtn = document.getElementById('searchBtn');

function addMsg(role, html, asHtml=false){
  const wrap=document.createElement('div');
  wrap.className='msg ' + (role==='user'?'user':'bot');
  const b=document.createElement('div'); b.className='bubble'; b.dir='auto';
  if(asHtml) b.innerHTML=html; else b.textContent=html;
  wrap.appendChild(b); win.appendChild(wrap); win.scrollTop=win.scrollHeight;
  return b;
}
function escapeHtml(s){ return (s??'').toString().replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
const fmtUSD=(v)=>{ const n=Number(String(v||'').replace(/[^\d.]/g,'')); if(!isFinite(n)||!n) return ''; try{return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);}catch{return `$${n.toFixed(2)}`;} };
const first=(obj,fields)=>{ for(const k of fields){ const v=obj?.[k]; if(typeof v==='string'&&v.trim()) return v.trim(); if(Array.isArray(v)&&v.length){const s=String(v[0]||'').trim(); if(s) return s;} } return ''; };
const IMG_KEYS = ["Image URL","image","image_url","image uri","thumbnail","images","img"];
const PRICE_KEYS = ["List Price","price","Price","list_price","price_usd","priceUSD"];
const PN_KEYS = ["Part Number","part_number","pn","PN","sku","SKU","product_code","item","code","موديل","كود","رقم"];

function cardFromHit(h){
  const img = first(h, IMG_KEYS) || 'https://via.placeholder.com/300x200?text=IMG';
  const price = first(h, PRICE_KEYS);
  const pn = first(h, PN_KEYS);
  const name = h?.name || h?.title || h?.Description || '(No name)';
  const link = h?.link || h?.product_url || h?.url || h?.permalink || '#';
  return {img,price,pn,name,link};
}
function renderCards(title, hits){
  if(!hits.length){ addMsg('bot','ملقيناش نتائج واضحة للبحث. جرّب كلمة أدق.'); return; }
  const items = hits.map(cardFromHit);
  let html = `<div><strong>${title}</strong> • <a href="quote.html">طلب عرض مخصص</a></div><div class="cards">`;
  for(const it of items){
    html += `
      <div class="card">
        <img src="${it.img}" alt="${escapeHtml(it.name)}" onerror="this.src='https://via.placeholder.com/300x200?text=IMG'">
        <div class="name">${escapeHtml(it.name)}</div>
        ${it.pn? `<div class="muted">PN/SKU: ${escapeHtml(it.pn)}</div>` : ""}
        ${it.price? `<div class="price">${escapeHtml(fmtUSD(it.price))}</div>` : ""}
        ${it.link && it.link!=='#' ? `<div style="margin-top:8px"><a href="${it.link}" target="_blank" rel="noopener">صفحة المنتج</a></div>` : ""}
      </div>`;
  }
  html += `</div>`;
  addMsg('bot', html, true);
}

// ترحيب
addMsg('bot','👋 أهلاً بك في QuickITQuote. اسأل عن منتج/رخصة، أو استخدم زر "ابحث عن منتجات".');
// فورم الرسائل
frm.addEventListener('submit',(e)=>{
  e.preventDefault();
  const txt=(inp.value||'').trim();
  if(!txt) return;
  inp.value='';
  addMsg('user',txt);
  addMsg('bot','تم الإرسال. لو عايز تشوف منتجات، اضغط "ابحث عن منتجات".');
});
// زر البحث
searchBtn.addEventListener('click', async ()=>{
  const q=(inp.value||'').trim(); if(!q){ inp.focus(); return; }
  addMsg('user',`بحث: ${q}`);
  const hits = await apiSearch(q, 8).catch(()=>[]);
  renderCards('نتائج البحث', hits);
});
