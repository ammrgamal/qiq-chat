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

  function hitToCard(h){
    const name  = esc(h?.name || '(No name)');
    const price = h?.price !== undefined && h?.price !== '' ? Number(h.price) : '';
    const pn    = esc(h?.pn || h?.sku || h?.objectID || '');
    const img   = esc(h?.image || 'https://via.placeholder.com/68?text=IMG');
    const brand = esc(h?.brand || h?.manufacturer || '');
    const link  = esc(h?.link || '');
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
        </div>
      </div>
    `;
  }

  function renderFacets(facets, sel){
    // brands
    if (brandsList){
      const map = facets?.brand || facets?.manufacturer || {};
      const entries = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,50);
      brandsList.innerHTML = entries.map(([name,count])=>{
        const checked = sel.brands.includes(name) ? 'checked' : '';
        return `<li><input type="checkbox" value="${esc(name)}" ${checked}/> <span>${esc(name)}</span> <span class="muted">(${count})</span></li>`;
      }).join('');
    }
    // categories
    if (catsList){
      const map = facets?.categories || facets?.category || {};
      const entries = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,50);
      catsList.innerHTML = entries.map(([name,count])=>{
        const checked = sel.categories.includes(name) ? 'checked' : '';
        return `<li><input type="checkbox" value="${esc(name)}" ${checked}/> <span>${esc(name)}</span> <span class="muted">(${count})</span></li>`;
      }).join('');
    }

    // wire changes
    brandsList?.querySelectorAll('input').forEach(cb=> cb.addEventListener('change', ()=> render((input?.value||'').trim(), 0)));
    catsList?.querySelectorAll('input').forEach(cb=> cb.addEventListener('change', ()=> render((input?.value||'').trim(), 0)));
  }

  function renderPagination(page, nbPages, onGo){
    if (!pagination) return;
    pagination.innerHTML = '';
    if (!nbPages || nbPages <= 1) return;
    const b = [];
    const btn = (p,label,active=false)=>`<button data-page="${p}" class="${active?'active':''}">${label}</button>`;
    if (page>0) b.push(btn(page-1,'Prev'));
    const start = Math.max(0, page-2), end = Math.min(nbPages-1, page+2);
    for (let p=start; p<=end; p++) b.push(btn(p, p+1, p===page));
    if (page<nbPages-1) b.push(btn(page+1,'Next'));
    pagination.innerHTML = b.join('');
    pagination.querySelectorAll('button').forEach(x=> x.addEventListener('click', ()=> onGo(Number(x.dataset.page))));
  }

  async function render(q, page=0){
    resultsEl.innerHTML = '';
    statusEl.textContent = q ? `Searching for "${q}"...` : 'Loading top products...';
    try{
      const res = await apiSearch(q, { page, hitsPerPage: 24 });
      const hits = Array.isArray(res?.hits) ? res.hits : [];
      statusEl.textContent = `${res?.nbHits || hits.length} result(s) • via backend`;

      // 2s chat-like toast per new query
      if (q !== lastQuery) {
        try {
          const count = res?.nbHits || hits.length || 0;
          if (count > 0 && window.QiqToast?.success) window.QiqToast.success(`تم العثور على ${count} نتيجة`, 2000);
          if (count === 0 && window.QiqToast?.warning) window.QiqToast.warning('لا توجد نتائج. جرّب كلمة أدق أو استخدم المرشحات.', 2000);
        } catch {}
        lastQuery = q;
      }

      resultsEl.innerHTML = hits.map(hitToCard).join('');
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

  // init
  const q0 = getParam('q');
  if (q0) { input.value = q0; render(q0, 0); } else { render('', 0); }
})();