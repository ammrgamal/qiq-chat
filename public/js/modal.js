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
  // Header action buttons (copy/print/attach) – shown only for specific contexts (e.g., comparison)
  const headerCopyBtn = document.getElementById('copyButton');
  const headerPrintBtn = document.getElementById('printButton');
  const headerAttachBtn = document.getElementById('attachToQuote');

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
                // Only wire explicit actions we want to proxy from iframe to parent.
                // Do NOT hijack wizard back/next here; quote-wizard.js handles them inside the iframe.
                var ids = [
                  ['wiz-download','download'],
                  ['wiz-send','send'],
                  ['wiz-custom','custom']
                ];
                ids.forEach(function(pair){
                  var el = document.getElementById(pair[0]);
                  if (!el || el.__bound) return;
                  el.__bound = true;
                  el.addEventListener('click', function(ev){
                    try{ ev.preventDefault(); ev.stopPropagation(); }catch{}
                    console.log('Wizard action triggered:', pair[1]);
                    if (pair[1]==='download') { if (window.parent && typeof window.parent.QiqWizardHandle==='function') return window.parent.QiqWizardHandle('download'); return; }
                    if (pair[1]==='send') { if (window.parent && typeof window.parent.QiqWizardHandle==='function') return window.parent.QiqWizardHandle('send'); return; }
                    if (pair[1]==='custom') { if (window.parent && typeof window.parent.QiqWizardHandle==='function') return window.parent.QiqWizardHandle('custom'); return; }
                    // Back actions are handled by quote-wizard.js inside iframe. Do not intercept.
                    return;
                  });
                });

                // Also bind any elements with data-wizard-action attribute
                var actionEls = Array.from(document.querySelectorAll('[data-wizard-action]'));
                actionEls.forEach(function(el){
                    if (!el || el.__bound) return;
                    el.__bound = true;
                    el.addEventListener('click', function(ev){
                      var action = (el.getAttribute('data-wizard-action')||'').toLowerCase();
                      console.log('Wizard action (data-attr):', action);
                      if (!action) return; // do not cancel unknowns
                      // Explicitly proxied actions → intercept and route to parent
                      if (action==='download' || action==='send' || action==='custom'){
                        try{ ev.preventDefault(); ev.stopPropagation(); }catch{}
                        if (window.parent && typeof window.parent.QiqWizardHandle==='function') return window.parent.QiqWizardHandle(action);
                        return;
                      }
                      // Back/step fallback only → intercept and route to step1 if needed
                      if (action==='back' || action==='back1' || action==='step1' || action==='back-step1'){
                        try{ ev.preventDefault(); ev.stopPropagation(); }catch{}
                        try{
                          if (window.parent && typeof window.parent.QiqWizardHandle==='function') return window.parent.QiqWizardHandle('back-to-step1');
                          if (window.parent && typeof window.parent.QiqWizardBack==='function') return window.parent.QiqWizardBack();
                        }catch{}
                        return;
                      }
                      // For any other action (e.g., 'next2'), do not intercept; let wizard handlers run.
                  });
                });

                // Fix for generic "التالي" (Next) buttons
                // Note: :contains is not a valid CSS selector. Select broad candidates then filter by text.
                var candidates = Array.from(document.querySelectorAll('button[type="submit"], .btn-primary, .qiq-btn.qiq-primary, button'));
                var nextButtons = candidates.filter(function(btn){
                  try{
                    var txt = (btn.textContent||'').trim();
                    // Do not hijack step-2 button; it is handled by quote-wizard.js
                    if (btn.id === 'wiz-next2') return false;
                    // Exclude compare/favorite buttons and others with icons only
                    if (btn.classList.contains('cmp-btn') || btn.classList.contains('fav-btn')) return false;
                    // Target explicit wizard next or generic text-based buttons
                    return btn.id === 'wiz-next' || /^(التالي|next)$/i.test(txt) || (/التالي|next/i.test(txt) && txt.length <= 10);
                  }catch{return false;}
                });
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
                        try { form.requestSubmit ? form.requestSubmit() : form.submit(); } catch {}
                      }
                    } catch(e) {
                      console.error('Button click error:', e);
                    }
                  });
                });

                // Last-resort fallbacks: capture events early for specific controls
                if (!document.__qiqWizardFallbackBound){
                  document.__qiqWizardFallbackBound = true;
                  document.addEventListener('pointerdown', function(ev){
                    try{
                      var n2 = ev.target && ev.target.closest && ev.target.closest('#wiz-next2');
                      if (n2 && window.parent && typeof window.parent.QiqWizardNext2==='function'){
                        ev.preventDefault(); ev.stopPropagation();
                        return window.parent.QiqWizardNext2();
                      }
                      var del = ev.target && ev.target.closest && ev.target.closest('.wiz-del');
                      if (del && window.parent && typeof window.parent.QiqWizardDelAt==='function'){
                        ev.preventDefault(); ev.stopPropagation();
                        var tr = del.closest('tr');
                        var idx = tr ? Number(tr.getAttribute('data-idx')||'-1') : -1;
                        if (idx>=0) return window.parent.QiqWizardDelAt(idx);
                      }
                    }catch{}
                  }, true);
                }

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
    // Ensure correct classes/styles so dialog is visible (some themes default to opacity:0)
    try {
      // Make sure container has the base class so global CSS applies
      if (!modal.classList.contains('qiq-modal')) modal.classList.add('qiq-modal');
      // Preferred class used by styles.css to animate/show
      modal.classList.add('active');
      // Keep legacy class for any older CSS
      modal.classList.add('is-open');
      // Force display and stacking above any overlays
      modal.style.display = 'flex';
      modal.style.zIndex = '9999';
      // Make sure dialog isn't hidden by default CSS
      dialog.style.opacity = '1';
      dialog.style.transform = 'translate(-50%, -50%) scale(1)';
      dialog.style.pointerEvents = 'auto';
    } catch {}
    modal.setAttribute('aria-hidden','false');
    lockScroll();
    centerDialog();
    // Leave a tiny tick for any CSS transitions to kick in
    setTimeout(()=> { try{ modal.classList.add('active'); }catch{} }, 10);
    dialog.focus();
    // Wire header buttons and compact styling
    if (btnOpenTab){
      btnOpenTab.onclick = ()=> window.open(url || 'about:blank', '_blank', 'noopener');
      btnOpenTab.style.borderRadius = '8px';
      btnOpenTab.style.minWidth = '100px';
    }
    // print control removed

    // Header action buttons visibility based on context
    try {
      // Default: hide actions to avoid interference with wizard and other content
      const want = opts && (opts.headerActions === true || opts.headerActions === 'compare');
      if (headerCopyBtn) headerCopyBtn.style.display = want ? '' : 'none';
      if (headerPrintBtn) headerPrintBtn.style.display = want ? '' : 'none';
      if (headerAttachBtn) headerAttachBtn.style.display = want ? '' : 'none';
      // Tag modal with context for potential consumers
      if (want) modal.dataset.modalContext = typeof opts.headerActions === 'string' ? opts.headerActions : 'custom';
      else delete modal.dataset.modalContext;
    } catch {}
  }

  function close(){
    // Remove visibility classes and reset inline tweaks
    modal.classList.remove('is-open');
    modal.classList.remove('active');
    setTimeout(()=>{
      frame.src = 'about:blank';
      frame.removeAttribute('srcdoc');
      modal.style.display = 'none';
      modal.style.zIndex = '';
      try { dialog.style.opacity = ''; dialog.style.pointerEvents = ''; } catch {}
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
