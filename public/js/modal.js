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

  function open(url, opts={}){
    if (titleEl) titleEl.textContent = opts.title || '';
    frame.src = url || 'about:blank';
    modal.setAttribute('aria-hidden','false');
    modal.style.display = 'block';
    setTimeout(()=> modal.classList.add('is-open'), 10);
    dialog.focus();
    // Wire header buttons
    if (btnOpenTab){
      btnOpenTab.onclick = ()=> window.open(url, '_blank', 'noopener');
    }
    if (btnPrint){
      btnPrint.onclick = ()=> {
        try {
          frame.contentWindow.focus();
          frame.contentWindow.print();
        } catch {}
      };
    }
  }

  function close(){
    modal.classList.remove('is-open');
    setTimeout(()=>{
      frame.src = 'about:blank';
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden','true');
    }, 150);
  }

  function onEsc(e){ if (e.key === 'Escape') close(); }
  backdrop?.addEventListener('click', close);
  btnClose?.addEventListener('click', close);
  document.addEventListener('keydown', onEsc);

  window.QiqModal = { open, close };
})();
