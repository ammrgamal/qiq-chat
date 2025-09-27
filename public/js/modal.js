(function(){
  const modal = document.getElementById('qiq-modal');
  if (!modal) return;
  const backdrop = modal.querySelector('.qiq-modal__backdrop');
  const dialog = modal.querySelector('.qiq-modal__dialog');
  const frame = modal.querySelector('#qiq-modal-frame');
  const btnClose = modal.querySelector('.qiq-modal__close');
  const titleEl = modal.querySelector('.qiq-modal__title');
  const btnOpenTab = modal.querySelector('.qiq-modal__open-tab');
  // const btnPrint = modal.querySelector('.qiq-modal__print');

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

  function buildSrcdoc(innerHtml){
    const bridge = `
      <script>
        (function(){
          try{
            // Bridge AddToQuote to parent
            window.AddToQuote = function(arg){ try{ window.parent.AddToQuote?.(arg); }catch(e){} };
            // Toast proxy
            window.QiqToast = window.parent.QiqToast;
            // Close modal from inner content
            window.QiqModalClose = function(){ try{ window.parent.QiqModal?.close?.(); }catch(e){} };
            // Copy to clipboard via parent
            window.__parentCopy = function(txt){ try{ window.parent.navigator.clipboard.writeText(String(txt||''))
              .then(()=>{ try{ window.parent.QiqToast?.success?.('تم النسخ'); }catch(e){} }); }catch(e){} };
            // Attach comparison markdown to parent storage and toast
            window.__parentAttachComparison = function(md){ try{ const att = { kind:'ai-comparison', createdAt: new Date().toISOString(), markdown: String(md||'') };
              window.parent.localStorage.setItem('qiq_attached_comparison', JSON.stringify(att)); window.parent.QiqToast?.success?.('تم إرفاق المقارنة بصفحة العرض'); }catch(e){} };
            
            // Enhanced wizard action handlers
            function wireWizard(){
              try{
                var ids = [
                  ['wiz-download','download'],
                  ['wiz-send','send'],
                  ['wiz-custom','custom'],
                  ['wiz-back','back1'],
                  ['wiz-back-step1','back0']
                ];
                ids.forEach(function(pair){
                  var el = document.getElementById(pair[0]);
                  if (!el || el.__bound) return;
                  el.__bound = true;
                  el.addEventListener('click', function(ev){
                    try{ ev.preventDefault(); ev.stopPropagation(); }catch{}
                    console.log('Wizard action triggered:', pair[1]);
                    if (pair[1]==='download') return window.parent.QiqWizardHandle?.('download');
                    if (pair[1]==='send') return window.parent.QiqWizardHandle?.('send');
                    if (pair[1]==='custom') return window.parent.QiqWizardHandle?.('custom');
                    if (pair[1]==='back1') return window.parent.QiqModal?.setHtml?.('');
                    if (pair[1]==='back0') return window.parent.QiqWizardHandle?.('back-to-step1');
                  });
                });

                // Fix for generic "التالي" (Next) buttons
                var nextButtons = document.querySelectorAll('button[type="submit"], .btn-primary, .qiq-btn.qiq-primary, button:contains("التالي")');
                nextButtons.forEach(function(btn) {
                  if (btn.__bound) return;
                  btn.__bound = true;
                  btn.style.pointerEvents = 'auto';
                  btn.style.cursor = 'pointer';
                  btn.disabled = false;
                  
                  btn.addEventListener('click', function(ev) {
                    try { 
                      ev.preventDefault(); 
                      ev.stopPropagation(); 
                      console.log('Next button clicked:', btn.textContent);
                      
                      // Handle form submission
                      var form = btn.closest('form');
                      if (form) {
                        var formData = new FormData(form);
                        var data = Object.fromEntries(formData.entries());
                        console.log('Form data:', data);
                        
                        // Notify parent about form submission
                        if (window.parent.QiqWizardHandle) {
                          window.parent.QiqWizardHandle('form-submit', data);
                        }
                      }
                    } catch(e) {
                      console.error('Button click error:', e);
                    }
                  });
                });

              }catch(e){
                console.error('Wire wizard error:', e);
              }
            }
            
            // Try immediately and over a longer interval
            wireWizard();
            var __tries = 0; 
            var __iv = setInterval(function(){ 
              if (++__tries>50) return clearInterval(__iv); 
              wireWizard(); 
            }, 200);
            
            // Also try on DOM changes
            if (window.MutationObserver) {
              var observer = new MutationObserver(function() {
                wireWizard();
              });
              observer.observe(document.body, { childList: true, subtree: true });
            }
            
          }catch(e){
            console.error('Bridge setup error:', e);
          }
        })();
      <\/script>`;
    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" />
      <base target="_blank" />
      <style>
        html,body{height:100%;margin:0;padding:0}
        body{font-family:Inter,system-ui,Segoe UI,Arial;padding:16px;background:#fff;color:#111;line-height:1.5} 
        .muted{color:#6b7280}
        button, .btn, .qiq-btn {
          pointer-events: auto !important;
          cursor: pointer !important;
          opacity: 1 !important;
        }
        button[disabled] {
          opacity: 0.6 !important;
          cursor: not-allowed !important;
        }
        .modal-content {
          max-height: none !important;
          overflow: visible !important;
        }
        form {
          display: block !important;
        }
      </style>
    </head><body>${String(innerHtml||'')}${bridge}</body></html>`;
  }

  function open(url, opts={}){
    lastFocus = document.activeElement;
    if (titleEl) titleEl.textContent = opts.title || '';
    // apply size variant (sm/md/lg)
    if (opts.size === 'sm'){
      dialog.style.width = 'min(760px, 92vw)';
      dialog.style.height = 'min(70vh, 720px)';
    } else if (opts.size === 'md'){
      dialog.style.width = 'min(980px, 95vw)';
      dialog.style.height = 'min(82vh, 800px)';
    } else {
      dialog.style.width = 'min(1100px, 96vw)';
      dialog.style.height = 'min(88vh, 860px)';
    }
    // Reset previous handlers/state
    frame.onload = null;
    frame.onerror = null;
  if (opts.html){
      // Allow opening inline HTML inside the iframe using srcdoc
      // Wrap provided HTML in a minimal document to avoid blank rendering on some browsers
      const content = buildSrcdoc(opts.html);
      frame.removeAttribute('src');
      frame.srcdoc = content;
    } else {
      frame.srcdoc = '';
      // Set explicit about:blank first to reset
      frame.src = 'about:blank';
      // Use absolute URL to avoid base issues inside iframe
      try{
        const abs = new URL(url, window.location.origin).href;
        frame.src = abs;
      }catch{ frame.src = url || 'about:blank'; }
      // Fallback: if the frame doesn't load content within 2.5s, show a simple inline loader/error
      const t = setTimeout(()=>{
        try{
          const doc = frame.contentDocument;
          const isBlank = !doc || !doc.body || doc.body.childElementCount === 0;
          if (isBlank) {
            const fallback = `<!doctype html><html><head><meta charset="utf-8"><base href="${window.location.origin}/" target="_blank"></head><body style="margin:0;padding:20px;font-family:system-ui,Segoe UI"><div style="display:flex;align-items:center;justify-content:center;height:100%;color:#374151"><div style="text-align:center"><div style="font-size:14px">جارٍ التحميل…</div><div style="margin-top:10px;color:#9ca3af">لو استمر الفراغ، افتح في تبويب جديد</div></div></div></body></html>`;
            frame.srcdoc = fallback;
          }
        }catch{}
      }, 2500);
      frame.onload = ()=> clearTimeout(t);
    }
    modal.setAttribute('aria-hidden','false');
    modal.style.display = 'block';
    lockScroll();
    centerDialog();
    setTimeout(()=> modal.classList.add('is-open'), 10);
    dialog.focus();
    // Wire header buttons and compact styling
    if (btnOpenTab){
      btnOpenTab.onclick = ()=> window.open(url || 'about:blank', '_blank', 'noopener');
      btnOpenTab.style.borderRadius = '8px';
      btnOpenTab.style.minWidth = '100px';
    }
    // print control removed
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

  function setHtml(innerHtml){
    try{ frame.removeAttribute('src'); frame.srcdoc = buildSrcdoc(innerHtml); }catch{}
  }
  function getFrame(){ return frame; }

  window.QiqModal = { open, close, setHtml, getFrame };
})();
