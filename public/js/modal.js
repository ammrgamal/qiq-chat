(function(){
  const modal = document.getElementById('qiq-modal');
  if (!modal) return;
  const backdrop = modal.querySelector('.qiq-modal__backdrop');
  const dialog = modal.querySelector('.qiq-modal__dialog');
  const frame = modal.querySelector('#qiq-modal-frame');
  const btnClose = modal.querySelector('.qiq-modal__close');
  const titleEl = modal.querySelector('.qiq-modal__title');
  const btnOpenTab = modal.querySelector('.qiq-modal__open-tab');
  const btnPrint = modal.querySelector('.qiq-modal__print');

  let lastFocus = null;
  function lockScroll(){
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }
  function unlockScroll(){
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }
  function centerDialog(){
    // Force translate center (already in CSS); nudge reflow to avoid appearing at top on open
    dialog.style.transform = 'translate(-50%, -46%) scale(.98)';
    requestAnimationFrame(()=>{
      dialog.style.transform = 'translate(-50%, -50%) scale(1)';
    });
  }

  function open(url, opts={}){
    lastFocus = document.activeElement;
    if (titleEl) titleEl.textContent = opts.title || '';
    if (opts.html){
      // Allow opening inline HTML inside the iframe using srcdoc
      // Wrap provided HTML in a minimal document to avoid blank rendering on some browsers
      const content = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" />
        <base target="_blank" />
        <style>body{font-family:Inter,system-ui,Segoe UI,Arial;margin:0;padding:16px;background:#fff;color:#111;line-height:1.5}</style>
      </head><body>${String(opts.html)}</body></html>`;
      frame.removeAttribute('src');
      frame.srcdoc = content;
    } else {
      frame.srcdoc = '';
      frame.src = url || 'about:blank';
    }
    modal.setAttribute('aria-hidden','false');
    modal.style.display = 'block';
    lockScroll();
    centerDialog();
    setTimeout(()=> modal.classList.add('is-open'), 10);
    dialog.focus();
    // Wire header buttons
    if (btnOpenTab){
      btnOpenTab.onclick = ()=> window.open(url, '_blank', 'noopener');
    }
    if (btnPrint){
      btnPrint.onclick = ()=> {
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        } catch {}
      };
    }
  }

  function close(){
    modal.classList.remove('is-open');
    setTimeout(()=>{
      frame.src = 'about:blank';
      frame.removeAttribute('srcdoc');
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden','true');
      unlockScroll();
      if (lastFocus && typeof lastFocus.focus === 'function') {
        lastFocus.focus();
      }
    }, 150);
  }

  function onEsc(e){ if (e.key === 'Escape') close(); }
  backdrop?.addEventListener('click', close);
  btnClose?.addEventListener('click', close);
  document.addEventListener('keydown', onEsc);
  window.addEventListener('resize', centerDialog);

  window.QiqModal = { open, close };
})();
