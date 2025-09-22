/* ========= Global Toast Notification System ========= */
(function() {
  'use strict';

  // Global Toast Notification System
  window.QiqToast = {
    container: null,
    defaultDuration: 3000,
    
    init() {
      this.container = document.getElementById('qiq-toast-container');
      // QiqToast v2: queued, accessible, dark-aware, hover-pause
      (function(){
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
        function iconFor(type){
          return type==='success'?'✅':type==='error'?'⛔':type==='warning'?'⚠️':'ℹ️';
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
          let remaining = Math.max(3500, duration || 4000);
          let lastTick = Date.now();
          const onEnter = ()=>{ if (timer){ clearInterval(timer); timer=null; } };
          const onLeave = ()=>{ if (!timer){ lastTick = Date.now(); timer = setInterval(tick, 100); } };
          el.addEventListener('mouseenter', onEnter);
          el.addEventListener('mouseleave', onLeave);
          function tick(){
            const now = Date.now();
            remaining -= (now - lastTick); lastTick = now;
            if (remaining <= 0) { dismiss(); }
          }
          timer = setInterval(tick, 100);
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
        function enqueue(type, message, duration){
          queue.push({ type, message, duration });
          showNext();
        }
        const API = {
          show(message, type='info', duration){ enqueue(type, message, duration); },
          success(msg, dur){ enqueue('success', msg, dur); },
          error(msg, dur){ enqueue('error', msg, dur); },
          warning(msg, dur){ enqueue('warning', msg, dur); },
          info(msg, dur){ enqueue('info', msg, dur); }
        };
        window.QiqToast = API;
      })();
      return toast;
    },

    remove(toast) {
      if (toast && toast.parentNode) {
        toast.style.animation = 'qiq-fade-out 0.3s ease-in';
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }
    },

    success(message, duration) {
      return this.show(message, 'success', duration);
    },

    error(message, duration) {
      return this.show(message, 'error', duration);
    },

    warning(message, duration) {
      return this.show(message, 'warning', duration);
    },

    info(message, duration) {
      return this.show(message, 'info', duration);
    }
  };

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => QiqToast.init());
  } else {
    QiqToast.init();
  }

})();