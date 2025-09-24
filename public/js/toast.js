/* ========= Global Toast Notification System ========= */
(function() {
  const DEFAULTS = { success: Infinity, info: Infinity, warning: Infinity, error: Infinity };
  const containerId = 'qiq-toast-container';
  let queue = [];
  let current = null;
  let timer = null;

  function ensureContainer(){
    let c = document.getElementById(containerId);
    if (!c){
      c = document.createElement('div');
      c.id = containerId;
      c.className = 'qiq-toast';
      document.body.appendChild(c);
    }
    return c;
  }
  function iconFor(type){
    return type==='success'?'✅':type==='error'?'⛔':type==='warning'?'⚠️':'ℹ️';
  }
  function build(type, message){
    const el = document.createElement('div');
    el.className = `item ${type||'info'}`;
    el.setAttribute('role','status');
    el.setAttribute('aria-live','polite');
    el.innerHTML = `
      <div class="toast-body" style="display:flex;align-items:center;gap:10px">
        <span class="toast-icon">${iconFor(type)}</span>
        <span class="toast-text">${message}</span>
        <div class="toast-spacer" style="flex:1"></div>
        <button class="close" aria-label="Close">✕</button>
      </div>`;
    return el;
  }
  function dismiss(){
    if (!current) return;
    const el = current; current = null;
    try{ el.style.animation = 'qiq-fade-out 0.25s ease forwards'; }catch{}
    setTimeout(()=> {
      try{ el.remove(); }catch{}
      if (timer){ clearInterval(timer); timer=null; }
      showNext();
    }, 260);
  }
  function showNext(){
    if (current || queue.length===0) return;
    const { type, message, duration } = queue.shift();
    const c = ensureContainer();
    const el = build(type, message);
    current = el;
    c.appendChild(el);
    const closeBtn = el.querySelector('.close');
    closeBtn.onclick = ()=> dismiss();
    // Allow click anywhere to dismiss as well
    el.addEventListener('click', (e)=>{
      if (!e.target.closest('.close')) dismiss();
    });
  let remaining = (typeof duration === 'number') ? duration : DEFAULTS[type] ?? DEFAULTS.info;
    let lastTick = Date.now();
    const onEnter = ()=>{ if (timer){ clearInterval(timer); timer=null; } };
    const onLeave = ()=>{ if (!timer && Number.isFinite(remaining)){ lastTick = Date.now(); timer = setInterval(tick, 100); } };
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    function tick(){
      if (!Number.isFinite(remaining)) return; // persistent: no auto-dismiss
      const now = Date.now();
      remaining -= (now - lastTick); lastTick = now;
      if (remaining <= 0) { dismiss(); }
    }
    if (Number.isFinite(remaining)) timer = setInterval(tick, 100);
  }
  function enqueue(type, message, duration){
    queue.push({ type, message, duration });
    showNext();
  }

  const API = {
    init(){ ensureContainer(); },
    show(message, type='info', timeout){
      const t = typeof timeout === 'number' ? timeout : (DEFAULTS[type] ?? DEFAULTS.info);
      enqueue(type, message, t);
    },
    success(msg, timeout){ return API.show(msg, 'success', timeout); },
    info(msg, timeout){ return API.show(msg, 'info', timeout); },
    warning(msg, timeout){ return API.show(msg, 'warning', timeout); },
    error(msg, timeout){ return API.show(msg, 'error', timeout); }
  };

  window.QiqToast = API;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => API.init());
  } else {
    API.init();
  }
})();