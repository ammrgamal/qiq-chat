// Clean catalog search (backend-only) with chat-like toasts
(function(){
  const $ = (s)=>document.querySelector(s);
  const resultsEl   = $('#results');
  const statusEl    = $('#status');
  const input       = $('#q');
  const searchBtn   = $('#searchBtn');
  const clearBtn    = $('#clearBtn');
  const brandsList  = document.querySelector('#facet-brands ul');
  const catsList    = document.querySelector('#facet-categories ul');
  const priceMinEl  = $('#priceMin');
  const priceMaxEl  = $('#priceMax');
  const applyPrice  = $('#applyPrice');
  const pagination  = $('#pagination');

  let lastQuery = null; // throttle 2s toast per new query

  function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function getParam(name){ try{ return new URL(window.location.href).searchParams.get(name) || ''; }catch{ return ''; } }

  function getSelected(){
    const brands = Array.from(document.querySelectorAll('#facet-brands input[type="checkbox"]:checked')).map(i=>i.value);
    const categories = Array.from(document.querySelectorAll('#facet-categories input[type="checkbox"]:checked')).map(i=>i.value);
    const priceMin = priceMinEl?.value || '';
    const priceMax = priceMaxEl?.value || '';
    return { brands, categories, priceMin, priceMax };
  }

  function buildFacetFilters(sel){
    const ff = [];
    if (sel.brands.length) ff.push(sel.brands.map(b=>`brand:${b}`));
    if (sel.categories.length) ff.push(sel.categories.map(c=>`categories:${c}`));
    return ff;
  }

  function buildNumericFilters(sel){
    const nf = [];
    if (sel.priceMin !== '' && !isNaN(Number(sel.priceMin))) nf.push(`price>=${Number(sel.priceMin)}`);
    if (sel.priceMax !== '' && !isNaN(Number(sel.priceMax))) nf.push(`price<=${Number(sel.priceMax)}`);
    return nf;
  }

  async function apiSearch(query, { page=0, hitsPerPage=24 }={}){
    const sel = getSelected();
    const body = {
      query,
      page,
      hitsPerPage,
      facetFilters: buildFacetFilters(sel),
      numericFilters: buildNumericFilters(sel)
    };
    const r = await fetch('/api/search', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  }

  // Render facets (brands/categories)
  function renderFacets(facets = {}, selected) {
    try{
      const brands = Object.entries(facets.brand || facets.manufacturer || {}).sort((a,b)=>b[1]-a[1]).slice(0, 30);
      const cats   = Object.entries(facets.categories || facets.category || {}).sort((a,b)=>b[1]-a[1]).slice(0, 30);
      if (brandsList) brandsList.innerHTML = brands.map(([name,count])=>{
        const checked = selected.brands.includes(name) ? 'checked' : '';
        const id = 'b_'+name.replace(/[^a-z0-9]/gi,'');
        return `<li><input id="${id}" type="checkbox" value="${esc(name)}" ${checked}/> <label for="${id}">${esc(name)} <span class="muted">(${count})</span></label></li>`;
      }).join('') || '<li class="muted">لا توجد شركات</li>';
      if (catsList) catsList.innerHTML = cats.map(([name,count])=>{
        const checked = selected.categories.includes(name) ? 'checked' : '';
        const id = 'c_'+name.replace(/[^a-z0-9]/gi,'');
        return `<li><input id="${id}" type="checkbox" value="${esc(name)}" ${checked}/> <label for="${id}">${esc(name)} <span class="muted">(${count})</span></label></li>`;
      }).join('') || '<li class="muted">لا توجد فئات</li>';

      // Re-wire change events to re-run search
      brandsList?.querySelectorAll('input[type="checkbox"]').forEach(cb=> cb.addEventListener('change', ()=> render((input?.value||'').trim(), 0)));
      catsList?.querySelectorAll('input[type="checkbox"]').forEach(cb=> cb.addEventListener('change', ()=> render((input?.value||'').trim(), 0)));
    }catch{}
  }

  function renderPagination(page = 0, nbPages = 1, onPage){
    if (!pagination) return;
    const items = [];
    const total = Math.max(1, Number(nbPages) || 1);
    const curr = Math.max(0, Number(page) || 0);
    const start = Math.max(0, curr - 2);
    const end = Math.min(total - 1, curr + 2);
    if (curr > 0) items.push(`<button data-p="${curr-1}">‹</button>`);
    for (let p = start; p <= end; p++){
      items.push(`<button data-p="${p}" class="${p===curr?'active':''}">${p+1}</button>`);
    }
    if (curr < total - 1) items.push(`<button data-p="${curr+1}">›</button>`);
    pagination.innerHTML = items.join('');
    pagination.querySelectorAll('button[data-p]')?.forEach(btn=> btn.addEventListener('click', ()=> onPage?.(Number(btn.dataset.p)||0)));
  }

  function hitToCard(h){
    const name  = esc(h?.name || '(No name)');
    const price = h?.price !== undefined && h?.price !== '' ? Number(h.price) : '';
    const pn    = esc(h?.pn || h?.sku || h?.objectID || '');
    const img   = esc(h?.image || 'https://via.placeholder.com/68?text=IMG');
    const brand = esc(h?.brand || h?.manufacturer || '');
    const link  = esc(h?.link || '');
    const id    = pn || name;
    return `
      <div class="card">
        <img src="${img}" alt="${name}" onerror="this.src='https://via.placeholder.com/68?text=IMG'" />
        <div>
          <div class="name">${name}</div>
          <div class="chips">
            ${pn? `<span class="chip">PN: ${pn}</span>`:''}
            ${brand? `<span class="chip">${brand}</span>`:''}
            ${price!==''? `<span class="chip price">USD ${price}</span>`:''}
          </div>
          ${link ? `<a href="${link}" target="_blank" rel="noopener" class="muted">Product page</a>` : ''}
        </div>
        <div class="actions">
          <button class="btn" type="button"
            data-name="${name}"
            data-price="${price!==''?price:''}"
            data-pn="${pn}"
            data-image="${img}"
            data-link="${link}"
            data-manufacturer="${brand}"
            onclick="AddToQuote(this)">Add</button>
          <button class="btn secondary fav-btn" type="button" title="Favorite" data-id="${id}" data-name="${name}" data-price="${price}" data-image="${img}" data-pn="${pn}" data-brand="${brand}">❤</button>
          <button class="btn secondary cmp-btn" type="button" title="Compare" data-id="${id}" data-name="${name}" data-price="${price}" data-image="${img}" data-pn="${pn}" data-brand="${brand}">⚖️</button>
        </div>
      </div>
    `;
  }

  function wireCardActions(){
    // favorites
    document.querySelectorAll('.fav-btn').forEach(btn=>{
      const id = btn.dataset.id;
      if (window.QiqFavorites?.isFavorite && window.QiqFavorites.isFavorite(id)) btn.classList.add('active');
      btn.onclick = ()=>{
        try{
          const product = { id: btn.dataset.id, name: btn.dataset.name, price: btn.dataset.price, image: btn.dataset.image, sku: btn.dataset.pn, manufacturer: btn.dataset.brand };
          const added = window.QiqFavorites?.toggle(product);
          if (added) { window.QiqToast?.success?.('تمت الإضافة إلى المفضلة', 2000); btn.classList.add('active'); }
          else { window.QiqToast?.info?.('تمت الإزالة من المفضلة', 2000); btn.classList.remove('active'); }
        }catch{}
      };
    });
    // comparison
    document.querySelectorAll('.cmp-btn').forEach(btn=>{
      const id = btn.dataset.id;
      if (window.QiqComparison?.isInComparison && window.QiqComparison.isInComparison(id)) btn.classList.add('active');
      btn.onclick = ()=>{
        try{
          const product = { id: btn.dataset.id, name: btn.dataset.name, price: btn.dataset.price, image: btn.dataset.image, sku: btn.dataset.pn, manufacturer: btn.dataset.brand };
          if (window.QiqComparison?.isInComparison(product.id)){
            window.QiqComparison.remove(product.id);
            btn.classList.remove('active');
            window.QiqToast?.info?.('تمت الإزالة من المقارنة', 2000);
          } else {
            try { window.QiqComparison.add(product); btn.classList.add('active'); window.QiqToast?.success?.('تمت الإضافة إلى المقارنة', 2000); }
            catch(err){ window.QiqToast?.warning?.(err?.message || 'تعذر الإضافة للمقارنة', 2000); }
          }
        }catch{}
      };
    });
  }

  async function render(q, page=0){
    resultsEl.innerHTML = '';
    statusEl.textContent = q ? `Searching for "${q}"...` : 'Loading top products...';
    try{
      const res = await apiSearch(q, { page, hitsPerPage: 24 });
      const hits = Array.isArray(res?.hits) ? res.hits : [];
      statusEl.textContent = `${res?.nbHits || hits.length} result(s) • via backend`;

      if (q !== lastQuery) {
        try {
          const count = res?.nbHits || hits.length || 0;
          if (count > 0 && window.QiqToast?.success) window.QiqToast.success(`تم العثور على ${count} نتيجة`, 2000);
          if (count === 0 && window.QiqToast?.warning) window.QiqToast.warning('لا توجد نتائج. جرّب كلمة أدق أو استخدم المرشحات.', 2000);
        } catch {}
        lastQuery = q;
      }

  // Ensure list-lines default
  resultsEl.classList.remove('grid');
  resultsEl.classList.add('list-lines');
  resultsEl.innerHTML = hits.map(hitToCard).join('');
      wireCardActions();
      // re-apply view mode to new cards
  applyView(localStorage.getItem('qiq_view_mode') || 'list-lines');
      renderFacets(res?.facets || {}, getSelected());
      renderPagination(res?.page || 0, res?.nbPages || 1, (p)=>render(q, p));
    }catch(err){
      console.warn('search error', err);
      statusEl.textContent = 'Search failed';
      try { window.QiqToast?.error?.('تعذر تنفيذ البحث الآن', 2000); } catch {}
    }
  }

  // Quick buttons
  document.addEventListener('click', (e)=>{
    if (e.target.matches('.quick-btn')){
      const q = e.target.dataset.query || '';
      input.value = q;
      document.querySelectorAll('.quick-btn').forEach(b=>b.classList.remove('active'));
      e.target.classList.add('active');
      const u = new URL(window.location.href); if (q) u.searchParams.set('q', q); else u.searchParams.delete('q');
      history.replaceState(null,'',u.toString());
      render(q, 0);
    }
  });

  // Add to quote toast (delegate)
  resultsEl?.addEventListener('click', (e)=>{
    const btn = e.target.closest('button.btn');
    if (btn && btn.dataset && btn.dataset.name) {
      setTimeout(()=>{ try { window.QiqToast?.success?.('تمت الإضافة إلى عرض السعر', 2000); } catch {} }, 0);
    }
  });

  searchBtn?.addEventListener('click', ()=>{
    const q = (input?.value || '').trim();
    const u = new URL(window.location.href); if (q) u.searchParams.set('q', q); else u.searchParams.delete('q');
    history.replaceState(null,'',u.toString());
    render(q, 0);
  });

  clearBtn?.addEventListener('click', ()=>{
    input.value = '';
    const u = new URL(window.location.href); u.searchParams.delete('q'); history.replaceState(null,'',u.toString());
    resultsEl.innerHTML = ''; statusEl.textContent='';
    brandsList && (brandsList.innerHTML=''); catsList && (catsList.innerHTML='');
    if (priceMinEl) priceMinEl.value=''; if (priceMaxEl) priceMaxEl.value='';
    pagination && (pagination.innerHTML='');
    try { window.QiqToast?.info?.('تم مسح البحث', 2000); } catch {}
    render('', 0);
  });

  applyPrice?.addEventListener('click', ()=>{
    try { window.QiqToast?.info?.('تم تطبيق نطاق السعر', 2000); } catch {}
    render((input?.value||'').trim(), 0);
  });

  // View toggle
  const viewListBtn = document.getElementById('viewList');
  const viewGridBtn = document.getElementById('viewGrid');
  function applyView(mode){
    const grid = mode === 'grid';
    const listLines = mode === 'list-lines' || (!grid && mode==='list-lines');
    resultsEl.classList.toggle('grid', grid);
    resultsEl.classList.toggle('list-lines', listLines);
    resultsEl.querySelectorAll('.card').forEach(c=>{
      c.classList.toggle('grid', grid);
    });
    if (grid){
      viewGridBtn?.classList.add('active');
      viewListBtn?.classList.remove('active');
    } else {
      viewListBtn?.classList.add('active');
      viewGridBtn?.classList.remove('active');
    }
    localStorage.setItem('qiq_view_mode', grid?'grid':'list-lines');
  }
  viewListBtn?.addEventListener('click', ()=> applyView('list-lines'));
  viewGridBtn?.addEventListener('click', ()=> applyView('grid'));

  // Header buttons: open lists in modal
  document.getElementById('favorites-btn')?.addEventListener('click', ()=>{
    try{
      const favs = window.QiqFavorites?.getAll?.() || [];
      const html = favs.length ? (
        '<div>' + favs.map(p=> `
          <div style="display:flex;gap:10px;align-items:center;border-bottom:1px solid #e5e7eb;padding:8px 0">
            <img src="${p.image || 'https://via.placeholder.com/48'}" style="width:48px;height:48px;border-radius:8px;object-fit:cover"/>
            <div style="flex:1">
              <div style="font-weight:600">${p.name}</div>
              <div style="font-size:12px;color:#6b7280">${p.sku || ''}</div>
            </div>
            <button class="btn" onclick="AddToQuote({name:'${p.name.replace(/'/g,"&#39;")}', price:'${p.price||''}', pn:'${p.sku||''}', image:'${p.image||''}', link:'', manufacturer:'${(p.manufacturer||'').replace(/'/g,"&#39;")}', source:'Favorites'})">Add</button>
          </div>`).join('') + '</div>'
      ) : '<div style="color:#6b7280">لا توجد عناصر في المفضلة</div>';
      window.QiqModal?.open('#', { title:'المفضلة', html });
    }catch{}
  });

  document.getElementById('comparison-btn')?.addEventListener('click', async ()=>{
    try{
      if (window.__cmpBusy) return; window.__cmpBusy = true;
      const items = (window.QiqComparison?.getAll?.() || []).slice(0, 6);
      if (!items.length) {
        return window.QiqModal?.open('#', { title:'المقارنة', html: '<div style="color:#6b7280">لا توجد عناصر للمقارنة</div>' });
      }
      // build minimal payload
      const products = items.map(p=>({ name: p.name, pn: p.sku, brand: p.manufacturer, price: Number(p.price||0) }));
      const modalId = 'cmp-modal-'+Date.now();
      window.QiqModal?.open('#', { title:'المقارنة (جارية...)', html: '<div id="'+modalId+'" style="padding:12px">جاري التحليل...</div>' });
      const r = await fetch('/api/compare', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ products }) });
      let md = 'No comparison available';
      try{ const data = await r.json(); md = data?.summaryMarkdown || md; }catch{}
      const html = `
        <div style="padding:12px; display:flex; flex-direction:column; gap:12px">
          <div style="white-space:pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e5e7eb; max-height:60vh; overflow:auto">${md.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
          <div style="display:flex; gap:8px; justify-content:flex-end">
            <button class="btn secondary" id="cmp-copy">نسخ</button>
            <button class="btn" id="cmp-attach">إرفاق لعرض السعر</button>
          </div>
        </div>`;
      const modalEl = document.getElementById(modalId);
      if (modalEl) modalEl.parentElement.innerHTML = html;
      // wire buttons
      setTimeout(()=>{
        const copyBtn = document.getElementById('cmp-copy');
        const attachBtn = document.getElementById('cmp-attach');
        copyBtn?.addEventListener('click', ()=>{ navigator.clipboard.writeText(md).then(()=>window.QiqToast?.success?.('تم النسخ',2000)).catch(()=>{}); });
        attachBtn?.addEventListener('click', ()=>{
          try{
            const att = { kind:'ai-comparison', createdAt: new Date().toISOString(), markdown: md };
            localStorage.setItem('qiq_attached_comparison', JSON.stringify(att));
            window.QiqToast?.success?.('تم إرفاق المقارنة بصفحة العرض', 2000);
          }catch{}
        });
      }, 0);
    }catch(err){ console.warn(err); window.QiqToast?.error?.('تعذر إنشاء المقارنة الآن', 2000); }
    finally { window.__cmpBusy = false; }
  });

  // init
  const q0 = getParam('q');
  if (q0) { input.value = q0; render(q0, 0); } else { render('', 0); }
  // apply stored view
  applyView(localStorage.getItem('qiq_view_mode') || 'list-lines');
})();