(function(){
  // Avoid duplicate
  if (window.__qiqExperimentalBanner) return; window.__qiqExperimentalBanner = true;
  try{
    const bar = document.createElement('div');
    bar.id = 'qiq-experimental-banner';
    bar.setAttribute('dir','rtl');
    bar.style.cssText = [
      'position:sticky','top:0','z-index:99999','width:100%','box-sizing:border-box','padding:8px 12px',
      'display:flex','align-items:center','justify-content:center','gap:8px','font-size:14px','font-weight:600',
      'backdrop-filter:saturate(140%) blur(6px)','border-bottom:1px solid rgba(0,0,0,.08)'
    ].join(';');

    const text = document.createElement('div');
    text.textContent = 'تنبيه: هذا الموقع تجريبي حتى الآن — قد تتغير البيانات والوظائف.';

    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'إخفاء';
    close.style.cssText = 'margin-inline-start:12px;border:1px solid rgba(0,0,0,.2);background:transparent;border-radius:8px;padding:4px 8px;cursor:pointer';
    close.addEventListener('click', ()=>{ bar.remove(); });

    const applyTheme = ()=>{
      const dark = (window.QiqTheme?.currentTheme === 'dark') || document.documentElement.classList.contains('dark');
      if (dark){
        bar.style.background = 'rgba(31,41,55,.85)';
        bar.style.color = '#fff';
        bar.style.borderBottomColor = 'rgba(255,255,255,.12)';
        close.style.color = '#fff';
        close.style.borderColor = 'rgba(255,255,255,.25)';
      } else {
        bar.style.background = 'rgba(255,255,255,.9)';
        bar.style.color = '#111827';
        bar.style.borderBottomColor = 'rgba(0,0,0,.08)';
        close.style.color = '#111827';
        close.style.borderColor = 'rgba(0,0,0,.2)';
      }
    };

    bar.appendChild(text); bar.appendChild(close);

    // Insert as very first element inside body to appear on top of any app topbars
    const target = document.body || document.documentElement;
    if (target.firstChild) target.insertBefore(bar, target.firstChild); else target.appendChild(bar);

    // Observe theme changes if QiqTheme exists
    try{ window.addEventListener('qiq-theme-changed', applyTheme); }catch{}
    applyTheme();
  }catch(e){ console.warn('banner injection failed', e); }
})();
