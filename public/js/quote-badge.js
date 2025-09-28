(function(){
  function getItems(){
    try { return JSON.parse(localStorage.getItem('qiq_staged_items')||'[]')||[]; } catch { return []; }
  }

  function ensureBadge(btn){
    if (!btn) return null;
    btn.style.position = btn.style.position || 'relative';
    let badge = btn.querySelector('.qiq-quote-badge');
    if (!badge){
      badge = document.createElement('span');
      badge.className = 'qiq-quote-badge';
      badge.setAttribute('aria-label','عدد العناصر في عرض السعر');
      badge.style.cssText = `
        position:absolute;top:-8px;${document.dir==='rtl'?'left':'right'}:-8px;min-width:20px;height:20px;
        padding:0 6px;border-radius:999px;background:#ef4444;color:#fff;display:none;
        font-size:11px;line-height:20px;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.2);
      `;
      btn.appendChild(badge);
    }
    return badge;
  }

  function updateAll(){
    const count = getItems().length;
    document.querySelectorAll('[data-open-quote-wizard]').forEach(btn=>{
      const badge = ensureBadge(btn);
      if (!badge) return;
      if (count>0){ badge.textContent = String(count); badge.style.display='inline-block'; }
      else { badge.textContent='0'; badge.style.display='none'; }
    });
  }

  document.addEventListener('DOMContentLoaded', updateAll);
  document.addEventListener('stagedItemsChanged', updateAll);
  window.addEventListener('storage', (e)=>{ if (e.key==='qiq_staged_items') updateAll(); });
  // Small periodic sync for robustness on dynamic pages
  setInterval(()=>{ try{ updateAll(); }catch{} }, 3000);
})();
