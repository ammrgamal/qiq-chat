(function(){
  const $ = (s)=>document.querySelector(s);
  const resultsEl = $('#results');
  const statusEl = $('#status');
  const input = $('#q');
  const searchBtn = $('#searchBtn');
  const clearBtn = $('#clearBtn');

  function esc(s){ return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  const PLACEHOLDER = 'https://via.placeholder.com/68?text=IMG';

  async function apiSearch(q, hitsPerPage=20){
    if(!q) return [];
    try{
      const r = await fetch('/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:q,hitsPerPage})});
      if(!r.ok) throw new Error('HTTP '+r.status);
      const j = await r.json();
      return Array.isArray(j?.hits)? j.hits : [];
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

  async function render(q){
    resultsEl.innerHTML = '';
    statusEl.textContent = q? `Searching for \"${q}\"...` : '';
    const hits = await apiSearch(q, 24);
    statusEl.textContent = hits.length? `${hits.length} result(s)` : 'No results';
    resultsEl.innerHTML = hits.map(hitToCard).join('');
  }

  function getParam(name){
    const u = new URL(window.location.href);
    return u.searchParams.get(name) || '';
  }

  searchBtn?.addEventListener('click', ()=>{
    const q = (input?.value||'').trim();
    const u = new URL(window.location.href);
    if(q) u.searchParams.set('q', q); else u.searchParams.delete('q');
    history.replaceState(null,'',u.toString());
    render(q);
  });

  clearBtn?.addEventListener('click', ()=>{
    input.value='';
    const u = new URL(window.location.href);
    u.searchParams.delete('q');
    history.replaceState(null,'',u.toString());
    resultsEl.innerHTML='';
    statusEl.textContent='';
  });

  // Init from ?q=
  const q0 = getParam('q');
  if(q0){ input.value = q0; render(q0); }
})();
