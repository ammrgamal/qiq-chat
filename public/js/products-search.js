(function(){
  const $ = (s)=>document.querySelector(s);
  const resultsEl = $('#results');
  const statusEl = $('#status');
  const input = $('#q');
  const searchBtn = $('#searchBtn');
  const clearBtn = $('#clearBtn');
  const brandsFacetEl = document.querySelector('#facet-brands ul');
  const catsFacetEl = document.querySelector('#facet-categories ul');
  const priceMinEl = $('#priceMin');
  const priceMaxEl = $('#priceMax');
  const applyPriceBtn = $('#applyPrice');
  const paginationEl = $('#pagination');

  function esc(s){ return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='68' height='68'><rect width='100%' height='100%' fill='#f3f4f6'/><text x='50%' y='55%' dominant-baseline='middle' text-anchor='middle' fill='#9ca3af' font-size='12'>IMG</text></svg>");

  async function apiSearch(q, {hitsPerPage=20,page=0,filters={}}={}){
    try{
      const r = await fetch('/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:q,hitsPerPage,page,filters})});
      if(!r.ok) throw new Error('HTTP '+r.status);
      const j = await r.json();
      return j;
    }catch(e){ console.warn('search failed',e); return []; }
  }

  function hitToCard(h){
    const name = esc(h.name||'');
    const price = h.price !== undefined && h.price !== '' ? Number(h.price) : '';
    const pn = esc(h.pn || h.sku || '');
    const img = esc(h.image || PLACEHOLDER);
    const link = esc(h.link || '');
    const brand = esc(h.brand || '');

    return `
      <div class="card">
        <img src="${img}" alt="${name}" onerror="this.src='${PLACEHOLDER}'" />
        <div>
          <div class="name">${name}</div>
          <div class="chips">
            ${pn? `<span class="chip">PN: ${pn}</span>`:''}
            ${brand? `<span class="chip">${brand}</span>`:''}
            ${price!==''? `<span class="chip price">USD ${price}</span>`:''}
          </div>
          ${link? `<a href="${link}" target="_blank" rel="noopener" class="muted">Product page</a>`:''}
        </div>
        <div class="actions">
          <button class="btn" type="button"
            data-name="${name}"
            data-price="${price!==''?price:''}"
            data-pn="${pn}"
            data-image="${img}"
            data-link="${link}"
            data-manufacturer="${brand}"
            data-source="Catalog"
            onclick="AddToQuote(this)">Add</button>
        </div>
      </div>
    `;
  }

  function renderFacets(facets, selected){
    // Brands
    if (brandsFacetEl){
      const brands = facets?.brand || facets?.manufacturer || {};
      const entries = Object.entries(brands).sort((a,b)=>b[1]-a[1]).slice(0,50);
      brandsFacetEl.innerHTML = entries.map(([name,count])=>{
        const checked = selected.brands.includes(name) ? 'checked' : '';
        return `<li><input type="checkbox" data-facet="brand" value="${esc(name)}" ${checked}/> <span>${esc(name)}</span> <span class="muted">(${count})</span></li>`;
      }).join('');
    }
    // Categories
    if (catsFacetEl){
      const cats = facets?.categories || facets?.category || {};
      const entries = Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,50);
      catsFacetEl.innerHTML = entries.map(([name,count])=>{
        const checked = selected.categories.includes(name) ? 'checked' : '';
        return `<li><input type="checkbox" data-facet="category" value="${esc(name)}" ${checked}/> <span>${esc(name)}</span> <span class="muted">(${count})</span></li>`;
      }).join('');
    }
  }

  function renderPagination(page, nbPages, onGo){
    if(!paginationEl) return;
    paginationEl.innerHTML = '';
    if (nbPages <= 1) return;
    const makeBtn = (p, label, active=false)=>`<button data-page="${p}" class="${active?'active':''}">${label}</button>`;
    const buttons = [];
    const start = Math.max(0, page-2);
    const end = Math.min(nbPages-1, page+2);
    if (page>0) buttons.push(makeBtn(page-1,'Prev'));
    for(let p=start;p<=end;p++) buttons.push(makeBtn(p,(p+1), p===page));
    if (page<nbPages-1) buttons.push(makeBtn(page+1,'Next'));
    paginationEl.innerHTML = buttons.join('');
    paginationEl.querySelectorAll('button').forEach(btn=>{
      btn.addEventListener('click',()=> onGo(Number(btn.dataset.page)) );
    });
  }

  function getParam(name){
    const u = new URL(window.location.href);
    return u.searchParams.get(name) || '';
  }

  function getSelectedFilters(){
    const brands = Array.from(document.querySelectorAll('#facet-brands input[type="checkbox"]:checked')).map(i=>i.value);
    const categories = Array.from(document.querySelectorAll('#facet-categories input[type="checkbox"]:checked')).map(i=>i.value);
    const priceMin = priceMinEl?.value || '';
    const priceMax = priceMaxEl?.value || '';
    return {brands, categories, priceMin, priceMax};
  }

  async function render(q, page=0){
    resultsEl.innerHTML = '';
    statusEl.textContent = q? `Searching for \"${q}\"...` : 'Loading top products...';
    const filters = getSelectedFilters();
    const res = await apiSearch(q, {hitsPerPage: 24, page, filters});
    const hits = Array.isArray(res?.hits)? res.hits : [];
    statusEl.textContent = `${res?.nbHits||hits.length} result(s)`;
    resultsEl.innerHTML = hits.map(hitToCard).join('');
    renderFacets(res?.facets||{}, filters);
    renderPagination(res?.page||0, res?.nbPages||1, (p)=>render(q, p));
    // Rewire facet checkboxes after render
    document.querySelectorAll('#facet-brands input[type="checkbox"], #facet-categories input[type="checkbox"]').forEach(cb=>{
      cb.addEventListener('change', ()=> render((input?.value||'').trim(), 0));
    });
  }

  searchBtn?.addEventListener('click', ()=>{
    const q = (input?.value||'').trim();
    const u = new URL(window.location.href);
    if(q) u.searchParams.set('q', q); else u.searchParams.delete('q');
    history.replaceState(null,'',u.toString());
    render(q, 0);
  });

  clearBtn?.addEventListener('click', ()=>{
    input.value='';
    const u = new URL(window.location.href);
    u.searchParams.delete('q');
    history.replaceState(null,'',u.toString());
    resultsEl.innerHTML='';
    statusEl.textContent='';
    brandsFacetEl.innerHTML = '';
    catsFacetEl.innerHTML = '';
    priceMinEl.value = '';
    priceMaxEl.value = '';
    paginationEl.innerHTML = '';
    // بعد التنظيف، اعرض نتائج افتراضية
    render('', 0);
  });

  applyPriceBtn?.addEventListener('click', ()=>{
    render((input?.value||'').trim(), 0);
  });

  // Init from ?q=
  const q0 = getParam('q');
  if(q0){
    input.value = q0;
    render(q0, 0);
  } else {
    // اعرض نتائج وفلاتر افتراضية بدون كلمة بحث
    render('', 0);
  }
})();
