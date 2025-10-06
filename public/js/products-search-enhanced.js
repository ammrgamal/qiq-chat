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
  const quickPrice  = document.getElementById('facet-quick-price');
  const hasImageEl  = document.getElementById('hasImage');
  const inStockEl   = document.getElementById('inStock');
  const priceMinEl  = $('#priceMin');
  const priceMaxEl  = $('#priceMax');
  const applyPrice  = $('#applyPrice');
  const pagination  = $('#pagination');
  const resultsTableWrap = document.getElementById('resultsTableWrap');
  const resultsTbody = document.getElementById('resultsTbody');

  let lastQuery = null; // throttle 2s toast per new query

  function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function getParam(name){ try{ return new URL(window.location.href).searchParams.get(name) || ''; }catch{ return ''; } }

  const extraFacetsState = { ai_versions: [], enrichment_versions: [], quality: [], risk: [], lifecycle: [] };

  function renderExtraFacet(id, title, data, selectedArr, key){
    const containerId = `facet-${id}`;
    let wrap = document.getElementById(containerId);
    if (!wrap){
      const sidebar = document.querySelector('.sidebar');
      if (!sidebar) return;
      wrap = document.createElement('div');
      wrap.className = 'facet';
      wrap.id = containerId;
      wrap.innerHTML = `<h3>${title}</h3><ul></ul>`;
      sidebar.appendChild(wrap);
    }
    const ul = wrap.querySelector('ul');
    const entries = Object.entries(data||{}).sort((a,b)=>b[1]-a[1]).slice(0, 20);
    ul.innerHTML = entries.map(([val,count])=>{
      const safe = esc(val);
      const idc = `${id}_${safe.replace(/[^a-z0-9]/gi,'')}`;
      const checked = selectedArr.includes(val)?'checked':''; // removed stray comma causing syntax issue
      return `<li><input id="${idc}" data-facet-group="${key}" type="checkbox" value="${safe}" ${checked}/> <label for="${idc}">${safe} <span class="muted">(${count})</span></label></li>`;
    }).join('') || '<li class="muted">لا توجد قيم</li>';
    ul.querySelectorAll('input[type="checkbox"]').forEach(cb=> cb.addEventListener('change', ()=> render((input?.value||'').trim(), 0)));
  }

  function getSelected(){
    const brands = Array.from(document.querySelectorAll('#facet-brands input[type="checkbox"]:checked')).map(i=>i.value);
    const categories = Array.from(document.querySelectorAll('#facet-categories input[type="checkbox"]:checked')).map(i=>i.value);
    const ai_versions = Array.from(document.querySelectorAll('#facet-ai-version input[type="checkbox"]:checked')).map(i=>i.value);
    const enrichment_versions = Array.from(document.querySelectorAll('#facet-enrichment-version input[type="checkbox"]:checked')).map(i=>i.value);
    const quality = Array.from(document.querySelectorAll('#facet-quality input[type="checkbox"]:checked')).map(i=>i.value);
    const risk = Array.from(document.querySelectorAll('#facet-risk input[type="checkbox"]:checked')).map(i=>i.value);
    const lifecycle = Array.from(document.querySelectorAll('#facet-lifecycle input[type="checkbox"]:checked')).map(i=>i.value);
    const priceMin = priceMinEl?.value || '';
    const priceMax = priceMaxEl?.value || '';
    const flags = { hasImage: !!hasImageEl?.checked, inStock: !!inStockEl?.checked };
    // quick price logic stays
    const activeQuick = quickPrice?.querySelector('.quick-btn.active');
    const base = { brands, categories, priceMin, priceMax, flags, ai_versions, enrichment_versions, quality, risk, lifecycle };
    if (activeQuick) {
      const qpMin = activeQuick.getAttribute('data-price-min') || '';
      const qpMax = activeQuick.getAttribute('data-price-max') || '';
      return { ...base, priceMin: qpMin || priceMin, priceMax: qpMax || priceMax };
    }
    return base;
  }

  function buildFacetFilters(sel){
    const ff = [];
    if (sel.brands.length) ff.push(sel.brands.map(b=>`brand:${b}`));
    if (sel.categories.length) ff.push(sel.categories.map(c=>`category:${c}`));
    if (sel.ai_versions?.length) ff.push(sel.ai_versions.map(v=>`ai_version:${v}`));
    if (sel.enrichment_versions?.length) ff.push(sel.enrichment_versions.map(v=>`enrichment_version:${v}`));
    if (sel.quality?.length) ff.push(sel.quality.map(v=>`data_quality_bucket:${v}`));
    if (sel.risk?.length) ff.push(sel.risk.map(v=>`risk_bucket:${v}`));
    if (sel.lifecycle?.length) ff.push(sel.lifecycle.map(v=>`lifecycle_stage:${v}`));
    return ff;
  }

  // Build numeric filters array for Algolia style (price ranges)
  function buildNumericFilters(sel){
    const nf = [];
    const min = sel.priceMin !== '' ? Number(sel.priceMin) : null;
    const max = sel.priceMax !== '' ? Number(sel.priceMax) : null;
    if (min !== null && !isNaN(min)) nf.push(`price>=${min}`);
    if (max !== null && !isNaN(max)) nf.push(`price<=${max}`);
    return nf;
  }

  async function apiSearch(query, { page=0, hitsPerPage=24 }={}){
    const sel = getSelected();
    const numericFilters = buildNumericFilters(sel);
    const body = {
      query,
      page,
      hitsPerPage,
      facetFilters: buildFacetFilters(sel),
      numericFilters,
      filters: sel.flags?.hasImage ? 'image:*' : undefined
    };
    // Optional: we could pass custom filters; backend may ignore unknown keys
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
      try{
        // existing brand/category logic remains above
        renderExtraFacet('ai-version', 'AI Version', facets.ai_version, selected.ai_versions || [], 'ai_versions');
        renderExtraFacet('enrichment-version', 'Enrichment Ver', facets.enrichment_version, selected.enrichment_versions || [], 'enrichment_versions');
        renderExtraFacet('quality', 'Data Quality', facets.data_quality_bucket, selected.quality || [], 'quality');
        renderExtraFacet('risk', 'Risk Bucket', facets.risk_bucket, selected.risk || [], 'risk');
        renderExtraFacet('lifecycle', 'Lifecycle', facets.lifecycle_stage, selected.lifecycle || [], 'lifecycle');
      }catch{}
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
    const dq = h?.data_quality_bucket ? `<span class="chip" style="background:${h.data_quality_bucket==='high'?'#d1fae5':h.data_quality_bucket==='medium'?'#fef3c7':'#fee2e2'}">Q:${h.data_quality_bucket}</span>`:'',
    rk = h?.risk_bucket ? `<span class="chip" style="background:${h.risk_bucket==='elevated'?'#fee2e2':h.risk_bucket==='moderate'?'#fef3c7':'#e0f2fe'}">R:${h.risk_bucket[0]}</span>`:'';
    return `
      <div class="card">
        <img src="${img}" alt="${name}" onerror="this.src='https://via.placeholder.com/68?text=IMG'" />
        <div>
          <div class="name">${name}</div>
          <div class="chips">
            ${pn? `<span class="chip">PN: ${pn}</span>`:''}
            ${brand? `<span class="chip">${brand}</span>`:''}
            ${price!==''? `<span class="chip price">USD ${price}</span>`:''}
            ${dq}${rk}
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

  // Table row renderer for table view
  function hitToRow(h){
    const name  = esc(h?.name || '(No name)');
    const price = h?.price !== undefined && h?.price !== '' ? Number(h.price) : '';
    const pn    = esc(h?.pn || h?.sku || h?.objectID || '');
    const img   = esc(h?.image || 'https://via.placeholder.com/68?text=IMG');
    const brand = esc(h?.brand || h?.manufacturer || '');
    const link  = esc(h?.link || '');
    const dq = h?.data_quality_bucket ? `<span class=\"chip\" style=\"background:${h.data_quality_bucket==='high'?'#d1fae5':h.data_quality_bucket==='medium'?'#fef3c7':'#fee2e2'}\">Q:${h.data_quality_bucket}</span>`:'',
    rk = h?.risk_bucket ? `<span class=\"chip\" style=\"background:${h.risk_bucket==='elevated'?'#fee2e2':h.risk_bucket==='moderate'?'#fef3c7':'#e0f2fe'}\">R:${h.risk_bucket[0]}</span>`:'';
    return `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid var(--border)"><img src="${img}" alt="${name}" style="width:44px;height:44px;border-radius:8px;object-fit:cover" onerror="this.src='https://via.placeholder.com/44?text=IMG'"/></td>
        <td style="padding:8px 10px;border-bottom:1px solid var(--border)">${link?`<a href="${link}" target="_blank" rel="noopener">${name}</a>`:name}<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">${dq}${rk}</div></td>
        <td style="padding:8px 10px;border-bottom:1px solid var(--border)">${pn}</td>
        <td style="padding:8px 10px;border-bottom:1px solid var(--border)">${brand}</td>
        <td style="padding:8px 10px;border-bottom:1px solid var(--border)">${price!==''?`USD ${price}`:'-'}</td>
        <td style="padding:8px 10px;border-bottom:1px solid var(--border);text-align:center">
          <button class="btn" type="button"
            data-name="${name}"
            data-price="${price!==''?price:''}"
            data-pn="${pn}"
            data-image="${img}"
            data-link="${link}"
            data-manufacturer="${brand}"
            onclick="AddToQuote(this)">Add</button>
        </td>
      </tr>`;
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
    if (!statusEl){
      // Create a status element dynamically if missing
      const se = document.createElement('div');
      se.id = 'status';
      se.style.cssText = 'margin:8px 0;color:#555;font-size:14px';
      resultsEl.parentNode?.insertBefore(se, resultsEl);
      window.__catalogStatus = se;
    }
    const st = statusEl || window.__catalogStatus;
    if (st) st.textContent = q ? `Searching for "${q}"...` : 'Loading top products...';
    try{
      const res = await apiSearch(q, { page, hitsPerPage: 24 });
      const hits = Array.isArray(res?.hits) ? res.hits : [];
  if (st) st.textContent = `${res?.nbHits || hits.length} result(s) • via backend`;

      if (q !== lastQuery) {
        try {
          const count = res?.nbHits || hits.length || 0;
          if (count > 0 && window.QiqToast?.success) window.QiqToast.success(`تم العثور على ${count} نتيجة`, 2000);
          if (count === 0 && window.QiqToast?.warning) window.QiqToast.warning('لا توجد نتائج. جرّب كلمة أدق أو استخدم المرشحات.', 2000);
        } catch {}
        lastQuery = q;
      }

      const mode = localStorage.getItem('qiq_view_mode') || 'list-lines';
      if (mode === 'table' && resultsTbody) {
        resultsEl.innerHTML = '';
        resultsTbody.innerHTML = hits.map(hitToRow).join('');
      } else {
        // Ensure list-lines default
        resultsEl.classList.remove('grid');
        resultsEl.classList.add('list-lines');
        resultsEl.innerHTML = hits.map(hitToCard).join('');
        wireCardActions();
      }
      // re-apply view mode to new cards/rows
      applyView(mode);
      renderFacets(res?.facets || {}, getSelected());
      renderPagination(res?.page || 0, res?.nbPages || 1, (p)=>render(q, p));
    }catch(err){
      console.warn('search error', err);
  if (st) st.textContent = 'Search failed';
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
  // Delegate for table view as well
  resultsTableWrap?.addEventListener('click', (e)=>{
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

  // Quick price range wiring
  quickPrice?.addEventListener('click', (e)=>{
    const btn = e.target.closest('.quick-btn');
    if (!btn) return;
    quickPrice.querySelectorAll('.quick-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    render((input?.value||'').trim(), 0);
  });
  hasImageEl?.addEventListener('change', ()=> render((input?.value||'').trim(), 0));
  inStockEl?.addEventListener('change', ()=> render((input?.value||'').trim(), 0));

  // View toggle
  const viewListBtn = document.getElementById('viewList');
  const viewGridBtn = document.getElementById('viewGrid');
  const viewTableBtn = document.getElementById('viewTable');
  function applyView(mode){
    const grid = mode === 'grid';
    const table = mode === 'table';
    const listLines = mode === 'list-lines' || (!grid && !table && mode==='list-lines');
    // show/hide containers
    if (resultsTableWrap) resultsTableWrap.style.display = table ? 'block' : 'none';
    if (resultsEl) resultsEl.style.display = table ? 'none' : 'block';
    // toggle classes on cards list
    resultsEl.classList.toggle('grid', grid);
    resultsEl.classList.toggle('list-lines', listLines);
    resultsEl.querySelectorAll('.card').forEach(c=>{
      c.classList.toggle('grid', grid);
    });
    // button states
    if (grid){
      viewGridBtn?.classList.add('active');
      viewListBtn?.classList.remove('active');
      viewTableBtn?.classList.remove('active');
    } else if (table){
      viewTableBtn?.classList.add('active');
      viewListBtn?.classList.remove('active');
      viewGridBtn?.classList.remove('active');
    } else {
      viewListBtn?.classList.add('active');
      viewGridBtn?.classList.remove('active');
      viewTableBtn?.classList.remove('active');
    }
    localStorage.setItem('qiq_view_mode', table ? 'table' : (grid ? 'grid' : 'list-lines'));
  }
  viewListBtn?.addEventListener('click', ()=> {
    applyView('list-lines');
    if (!resultsEl?.innerHTML?.trim()) render((input?.value||'').trim(), 0);
  });
  viewGridBtn?.addEventListener('click', ()=> {
    applyView('grid');
    if (!resultsEl?.innerHTML?.trim()) render((input?.value||'').trim(), 0);
  });
  viewTableBtn?.addEventListener('click', ()=> {
    applyView('table');
    // Always render to populate table body for current query
    render((input?.value||'').trim(), 0);
  });

  // Header buttons: open lists in modal
  document.getElementById('favorites-btn')?.addEventListener('click', ()=>{
    try{
      const favs = window.QiqFavorites?.getAll?.() || [];
      const html = favs.length ? (
        '<div style="display:flex;flex-direction:column;gap:8px">' + favs.map(p=> `
          <div style="display:grid;grid-template-columns:48px 1fr auto;gap:10px;align-items:center;border-bottom:1px solid #e5e7eb;padding:8px 0">
            <img src="${p.image || 'https://via.placeholder.com/48'}" style="width:48px;height:48px;border-radius:8px;object-fit:cover"/>
            <div style="min-width:0">
              <div style="font-weight:600;white-space:nowrap;text-overflow:ellipsis;overflow:hidden">${p.name}</div>
              <div style="font-size:12px;color:#6b7280">${p.sku || ''}</div>
            </div>
            <div style="display:flex;gap:6px;align-items:center">
              <span class="muted" style="font-size:12px">${p.price?('USD '+p.price):''}</span>
              <button class="btn" onclick="AddToQuote({name:'${p.name.replace(/'/g,"&#39;")}', price:'${p.price||''}', pn:'${p.sku||''}', image:'${p.image||''}', link:'', manufacturer:'${(p.manufacturer||'').replace(/'/g,"&#39;")}', source:'Favorites'})">Add</button>
            </div>
          </div>`).join('') + '</div>'
      ) : '<div style="color:#6b7280">لا توجد عناصر في المفضلة</div>';
      window.QiqModal?.open('#', { title:'المفضلة', html, size:'sm' });
    }catch{}
  });

  document.getElementById('comparison-btn')?.addEventListener('click', async ()=>{
    try{
      if (window.__cmpBusy) return; window.__cmpBusy = true;
      const items = (window.QiqComparison?.getAll?.() || []).slice(0, 6);
      if (!items.length) {
        return window.QiqModal?.open('#', { title:'المقارنة', html: '<div style="color:#6b7280">لا توجد عناصر للمقارنة</div>', size:'sm' });
      }
      // build minimal payload
      const products = items.map(p=>({ name: p.name, pn: p.sku, brand: p.manufacturer, price: Number(p.price||0) }));
      window.QiqModal?.open('#', { title:'المقارنة (جارية...)', html: '<div style="padding:16px;color:#374151">جاري التحليل…</div>' });
      let resolved = false;
      const timeoutHtml = `
        <div style="padding:16px; display:flex; flex-direction:column; gap:12px">
          <div class="muted">التجميع يأخذ وقتًا أطول من المتوقع أو تعذّر الاتصال الآن.</div>
          <div style="display:flex; gap:8px; justify-content:flex-end">
            <button class="btn secondary" onclick="QiqModalClose()">إغلاق</button>
            <button class="btn" onclick="location.hash='#retry'">إعادة المحاولة</button>
          </div>
        </div>`;
      const safety = setTimeout(()=>{ if (!resolved) window.QiqModal?.setHtml?.(timeoutHtml); }, 10000);
      const r = await fetch('/api/compare', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ products }) });
      let md = 'No comparison available';
      try{ const data = await r.json(); md = data?.summaryMarkdown || md; }catch{}
      const html = `
        <div style="padding:16px; display:flex; flex-direction:column; gap:12px">
          <div style="white-space:pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e5e7eb; max-height:60vh; overflow:auto">${md.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
          <div style="display:flex; gap:8px; justify-content:flex-end">
            <button class="btn secondary" onclick="__parentCopy(${JSON.stringify(md).replace(/</g,'&lt;').replace(/>/g,'&gt;')})">نسخ</button>
            <button class="btn" onclick="__parentAttachComparison(${JSON.stringify(md).replace(/</g,'&lt;').replace(/>/g,'&gt;')})">إرفاق لعرض السعر</button>
          </div>
        </div>`;
      window.QiqModal?.setHtml?.(html);
      resolved = true; clearTimeout(safety);
      // Handle Retry via location hash inside iframe timeout content
      const frame = window.QiqModal?.getFrame?.();
      const retryWatch = setInterval(()=>{
        try{
          const h = frame?.contentWindow?.location?.hash || '';
          if (h === '#retry') { clearInterval(retryWatch); window.__cmpBusy = false; window.QiqModal?.open('#',{ title:'المقارنة (جارية...)', html: '<div style="padding:16px;color:#374151">جاري التحليل…</div>' }); document.getElementById('comparison-btn')?.click(); }
        }catch{}
      }, 500);
    }catch(err){ console.warn(err); window.QiqToast?.error?.('تعذر إنشاء المقارنة الآن', 2000); }
    finally { window.__cmpBusy = false; }
  });

  // init
  const q0 = getParam('q');
  if (q0) { input.value = q0; render(q0, 0); } else { render('', 0); }
  // apply stored view
  applyView(localStorage.getItem('qiq_view_mode') || 'list-lines');
})();