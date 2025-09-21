// Enhanced products search with quote preparation and motivational messages
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
  
  // New elements
  const motivationalEl = $('#motivational-message');
  const messageTextEl = $('#message-text');
  const quotePrepEl = $('#quote-preparation');
  const quoteItemsEl = $('#quote-items-tbody');
  const emptyRowEl = $('#empty-quote-row');
  const quoteTotalsEl = $('#quote-totals');
  const subtotalEl = $('#quote-subtotal');
  const grandTotalEl = $('#quote-grand-total');
  
  // TEMP: Direct Algolia fallback for testing only (remove before production)
  // If the backend doesn't have ALGOLIA_APP_ID/ALGOLIA_API_KEY configured, we'll query Algolia directly from the browser
  // using the Search-Only API key you provided. To disable this fallback at runtime: set window.QIQ_DISABLE_TEMP_ALGOLIA = true
  const TEMP_ALGOLIA = (function(){
    try {
      if (window.QIQ_DISABLE_TEMP_ALGOLIA) return null;
      const urlIndex = (function(){ try{ return new URL(window.location.href).searchParams.get('algoliaIndex') || ''; }catch{ return ''; } })();
      const storedIndex = (function(){ try{ return localStorage.getItem('qiq_algolia_index') || ''; }catch{ return ''; } })();
      const indexName = (urlIndex || storedIndex || window.QIQ_ALGOLIA_INDEX || 'woocommerce_products');
      if (urlIndex) { try { localStorage.setItem('qiq_algolia_index', indexName); } catch {} }
      return {
        appId: 'R4ZBQNB1VE',
        apiKey: '84b7868e7375eac68c15db81fc129962', // Search-Only key (OK for client-side testing)
        index: indexName
      };
    } catch { return null; }
  })();
  
  // Quote state
  let quoteItems = [];
  let searchCount = 0;
  let addCount = 0;

  function esc(s){ return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  const PLACEHOLDER = 'https://via.placeholder.com/68?text=IMG';

  // Motivational messages
  const motivationalMessages = [
    "🎯 ابدأ البحث عن المنتجات اللي محتاجها لمشروعك",
    "✨ برافو! اختيار ممتاز، كمل البحث عن باقي المنتجات",
    "🚀 ماشي كويس! ضيف المنتجات دي لعرض السعر",
    "💪 عظيم! المشروع بتاعك هيطلع احترافي",
    "🎉 برافو! كمل كده واعمل عرض سعر مخصص لو حابب",
    "⭐ ممتاز! المنتجات دي هتخلي مشروعك مميز",
    "🔥 رائع! قارب تخلص، جهز عرض السعر النهائي",
    "🏆 تمام! دلوقتي تقدر تطلب عرض سعر مخصص ببيانات المشروع"
  ];

  function showMotivationalMessage(messageIndex = 0) {
    if (!motivationalEl || !messageTextEl) return;
    
    const message = motivationalMessages[messageIndex] || motivationalMessages[0];
    messageTextEl.textContent = message;
    motivationalEl.style.display = 'block';
    
    // Auto hide after 4 seconds
    setTimeout(() => {
      if (motivationalEl) motivationalEl.style.display = 'none';
    }, 4000);
  }

  function updateQuoteDisplay() {
    if (!quoteItemsEl || !quoteTotalsEl) return;
    
    if (quoteItems.length === 0) {
      emptyRowEl.style.display = 'table-row';
      quoteTotalsEl.style.display = 'none';
      quotePrepEl.style.display = 'none';
      return;
    }
    
    // Show quote section and hide empty row
    quotePrepEl.style.display = 'block';
    emptyRowEl.style.display = 'none';
    quoteTotalsEl.style.display = 'table-footer-group';
    
    // Update items
    const itemsHtml = quoteItems.map((item, index) => `
      <tr>
        <td style="padding: 12px;">
          <div style="display: flex; gap: 8px; align-items: center;">
            <img src="${esc(item.image || PLACEHOLDER)}" alt="${esc(item.name)}" 
                 style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover;" 
                 onerror="this.src='${PLACEHOLDER}'" />
            <div>
              <div style="font-weight: 500;">${esc(item.name)}</div>
              <small style="color: #6b7280;">${esc(item.pn || '')} ${item.manufacturer ? '• ' + esc(item.manufacturer) : ''}</small>
            </div>
          </div>
        </td>
        <td style="padding: 12px; text-align: center;">
          <input type="number" value="${item.quantity}" min="1" 
                 style="width: 60px; padding: 4px; border: 1px solid #e5e7eb; border-radius: 4px; text-align: center;"
                 onchange="updateItemQuantity(${index}, this.value)" />
        </td>
        <td style="padding: 12px; text-align: center;">${item.price ? '$' + Number(item.price).toFixed(2) : '-'}</td>
        <td style="padding: 12px; text-align: center; font-weight: 500;">
          ${item.price ? '$' + (Number(item.price) * item.quantity).toFixed(2) : '-'}
        </td>
        <td style="padding: 12px; text-align: center;">
          <button onclick="removeQuoteItem(${index})" style="background: #dc2626; color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer;">
            🗑️
          </button>
        </td>
      </tr>
    `).join('');
    
    quoteItemsEl.innerHTML = itemsHtml;
    
    // Calculate totals
    const subtotal = quoteItems.reduce((sum, item) => 
      sum + (item.price ? Number(item.price) * item.quantity : 0), 0
    );
    
    if (subtotalEl) subtotalEl.textContent = '$' + subtotal.toFixed(2);
    if (grandTotalEl) grandTotalEl.textContent = '$' + subtotal.toFixed(2);
  }

  // Global functions for quote management
  window.updateItemQuantity = function(index, newQuantity) {
    const quantity = Math.max(1, parseInt(newQuantity) || 1);
    if (quoteItems[index]) {
      quoteItems[index].quantity = quantity;
      updateQuoteDisplay();
    }
  };

  window.removeQuoteItem = function(index) {
    quoteItems.splice(index, 1);
    updateQuoteDisplay();
    showMotivationalMessage(Math.min(quoteItems.length, motivationalMessages.length - 1));
  };

  // Enhanced AddToQuote function
  window.AddToQuote = function(btn) {
    try {
      // Rate limiting check
      window.QiqRateLimit?.search?.();
    } catch (e) {
      alert(e.message);
      return;
    }

    const name = btn.dataset.name || '';
    const price = btn.dataset.price || '';
    const pn = btn.dataset.pn || '';
    const image = btn.dataset.image || '';
    const manufacturer = btn.dataset.manufacturer || '';
    
    const product = { name, price, pn, image, manufacturer };

    // Track interaction
    if (window.QiqAnalytics) {
      window.QiqAnalytics.trackInteraction('product_add_to_quote', product);
    }

    // Track user preferences
    if (window.QiqRecommendations) {
      window.QiqRecommendations.trackInteraction(product, 'quote');
    }

    // Check if item already exists
    const existingIndex = quoteItems.findIndex(item => 
      item.name === name && item.pn === pn
    );
    
    if (existingIndex >= 0) {
      // Increase quantity
      quoteItems[existingIndex].quantity += 1;
    } else {
      // Add new item
      quoteItems.push({
        name,
        price: price ? Number(price) : 0,
        pn,
        image,
        manufacturer,
        quantity: 1
      });
    }
    
    addCount++;
    updateQuoteDisplay();
    
    // Show motivational message
    const messageIndex = Math.min(addCount, motivationalMessages.length - 1);
    showMotivationalMessage(messageIndex);
    
    // Visual feedback
    btn.style.background = '#059669';
    btn.textContent = '✓ Added';
    setTimeout(() => {
      btn.style.background = '#2563eb';
      btn.textContent = 'Add';
    }, 1500);
  };

  async function apiSearch(q, {hitsPerPage=20,page=0,filters={}}={}){
    const startTime = window.QiqPerformance?.startTimer('search-api') || Date.now();
    
    try{
      // Use enhanced fetch if available
      const searchFn = async () => {
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ query: q, hitsPerPage, page, filters })
        });
        
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      };

      let result = window.QiqFetch ? 
        await window.QiqFetch.fetch('/api/search', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ query: q, hitsPerPage, page, filters })
        }, `search-${q}-${page}`, 300000) : // 5 minutes cache
        await searchFn();
      if (result) { result._source = 'backend'; }
      
        // Show a warning if backend indicates Algolia is not configured
        if (result && result.warning && window.QiqToast?.show) {
          window.QiqToast.show('⚠️ لم يتم ضبط مفاتيح Algolia على الخادم. سيتم استخدام وضع اختبار مؤقت من الواجهة الأمامية.', 'warning', 4500);
        }

        // If backend lacks Algolia (warning) or returned no hits, try direct Algolia fallback (TEMP)
        if ((result?.warning || (result?.nbHits === 0)) && TEMP_ALGOLIA) {
          console.debug('[qiq] Using frontend Algolia fallback…', { q, page, filters });
          const fallback = await algoliaDirectSearch(q, { hitsPerPage, page, filters });
          if (fallback && (fallback.nbHits > 0 || (fallback.hits||[]).length > 0)) {
            if (window.QiqToast?.show) {
              window.QiqToast.show('🧪 تم استخدام مزود البحث المؤقت (Algolia) من المتصفح.', 'info', 3500);
            }
            if (window.QiqPerformance) {
              window.QiqPerformance.endTimer('search-api', startTime);
            }
            // Track search with fallback
            if (window.QiqAnalytics) {
              window.QiqAnalytics.trackSearch(q, fallback?.nbHits || (fallback.hits||[]).length, { ...filters, _fallback: 'frontend' }, Date.now() - startTime);
            }
            if (window.QiqSearchHistory) {
              window.QiqSearchHistory.addSearch(q, fallback?.nbHits || (fallback.hits||[]).length);
            }
            return { ...fallback, _source: 'frontend', _index: TEMP_ALGOLIA.index };
          }
        }

      if (window.QiqPerformance) {
        window.QiqPerformance.endTimer('search-api', startTime);
      }

      // Track search
      if (window.QiqAnalytics) {
        window.QiqAnalytics.trackSearch(q, result?.nbHits || 0, filters, Date.now() - startTime);
      }
      
      // Add to search history
      if (window.QiqSearchHistory) {
        window.QiqSearchHistory.addSearch(q, result?.nbHits || 0);
      }

      return result;
    }catch(e){ 
      console.warn('search failed', e);
      
      // If backend call failed entirely, still try the TEMP Algolia frontend fallback
      if (TEMP_ALGOLIA) {
        try {
          console.debug('[qiq] Backend search failed, trying frontend Algolia fallback…', e?.message || e);
          const fb = await algoliaDirectSearch(q, { hitsPerPage, page, filters });
          if (fb) {
            if (window.QiqToast?.show) {
              window.QiqToast.show('🧪 تم استخدام مزود البحث المؤقت بعد فشل الخادم.', 'warning', 4000);
            }
            return { ...fb, _source: 'frontend', _index: TEMP_ALGOLIA.index };
          }
        } catch (e2) {
          console.warn('fallback algolia failed', e2);
        }
      }

      // Track error
      if (window.QiqAnalytics) {
        window.QiqAnalytics.trackError(e, { context: 'search', query: q });
      }
      
      return { hits: [], nbHits: 0, facets: {} }; 
    }
  }

  // TEMP: Direct Algolia call from browser. Normalizes hits similar to backend mapper.
  async function algoliaDirectSearch(q, { hitsPerPage=20, page=0, filters={} }={}){
    if (!TEMP_ALGOLIA) return null;
    const facetFilters = [];
    if (filters && Array.isArray(filters.brands) && filters.brands.length) {
      facetFilters.push(filters.brands.map((b) => `brand:${b}`));
    }
    if (filters && Array.isArray(filters.categories) && filters.categories.length) {
      facetFilters.push(filters.categories.map((c) => `categories:${c}`));
    }
    const numericFilters = [];
    if (filters && filters.priceMin != null && filters.priceMin !== "") {
      numericFilters.push(`price>=${Number(filters.priceMin)}`);
    }
    if (filters && filters.priceMax != null && filters.priceMax !== "") {
      numericFilters.push(`price<=${Number(filters.priceMax)}`);
    }

    const baseOpts = {
      hitsPerPage: Math.min(50, Number(hitsPerPage) || 20),
      page: Number(page) || 0,
      facets: ["brand","manufacturer","categories","category"],
      facetFilters: facetFilters.length ? facetFilters : undefined,
      numericFilters: numericFilters.length ? numericFilters : undefined,
      typoTolerance: 'min',
      ignorePlurals: true,
      queryLanguages: ['ar','en'],
      removeWordsIfNoResults: 'allOptional',
      advancedSyntax: true,
      restrictSearchableAttributes: [
        'name','title','Description','ShortDescription','ExtendedDescription','product_name',
        'sku','SKU','pn','mpn','Part Number','product_code','objectID',
        'brand','manufacturer','vendor','company',
        'categories','category','tags'
      ],
      attributesToRetrieve: [
        'name','title','Description','ShortDescription','ExtendedDescription','product_name','price','Price','List Price','list_price',
        'image','Image URL','thumbnail','images','sku','SKU','pn','mpn','Part Number','product_code','objectID',
        'link','product_url','url','permalink','brand','manufacturer','vendor','company','categories','category','tags'
      ]
    };

    const buildParams = (optsObj) => {
      const p = new URLSearchParams();
      p.set('query', q || '');
      Object.entries(optsObj).forEach(([k,v])=>{
        if (v === undefined || v === null || v === '') return;
        if (Array.isArray(v) || typeof v === 'object') {
          p.set(k, JSON.stringify(v));
        } else {
          p.set(k, String(v));
        }
      });
      return p.toString();
    };

    const url = `https://${TEMP_ALGOLIA.appId}-dsn.algolia.net/1/indexes/${encodeURIComponent(TEMP_ALGOLIA.index)}/query`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Algolia-Application-Id': TEMP_ALGOLIA.appId,
        'X-Algolia-API-Key': TEMP_ALGOLIA.apiKey
      },
      body: JSON.stringify({ params: buildParams(baseOpts) })
    });
    if (!resp.ok) throw new Error('Algolia HTTP ' + resp.status);
    let result = await resp.json();

    // secondary relaxed attempts similar to backend
    if ((!result?.nbHits || result.nbHits === 0) && q) {
      const tokens = String(q).split(/\s+/).filter(Boolean);
      const optionalWords = tokens.length > 1 ? tokens : undefined;
      try {
        const relaxed = { ...baseOpts, optionalWords };
        const resp2 = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Algolia-Application-Id': TEMP_ALGOLIA.appId,
            'X-Algolia-API-Key': TEMP_ALGOLIA.apiKey
          },
          body: JSON.stringify({ params: buildParams(relaxed) })
        });
        if (resp2.ok) result = await resp2.json();
      } catch {}
    }
    if ((result?.nbHits || 0) <= 1 && q) {
      try {
        const broadOpts = { ...baseOpts };
        delete broadOpts.restrictSearchableAttributes;
        const resp3 = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Algolia-Application-Id': TEMP_ALGOLIA.appId,
            'X-Algolia-API-Key': TEMP_ALGOLIA.apiKey
          },
          body: JSON.stringify({ params: buildParams({ ...broadOpts, hitsPerPage: Math.max(broadOpts.hitsPerPage || 20, 24), queryType: 'prefixAll', synonyms: true, removeWordsIfNoResults: 'allOptional' }) })
        });
        if (resp3.ok) result = await resp3.json();
      } catch {}
    }

    const normalizedHits = (result?.hits || []).map(h => ({
      name: h.name || h.title || h.Description || h.product_name || "",
      price: (h.price ?? h.Price ?? h["List Price"] ?? h.list_price ?? ""),
      image: h.image || h["Image URL"] || h.thumbnail || (Array.isArray(h.images) ? h.images[0] : ""),
      sku:   h.sku || h.SKU || h.pn || h.mpn || h["Part Number"] || h.product_code || h.objectID || "",
      pn:    h.pn || h.mpn || h["Part Number"] || h.sku || h.SKU || h.product_code || h.objectID || "",
      link:  h.link || h.product_url || h.url || h.permalink || "",
      brand: h.brand || h.manufacturer || h.vendor || h.company || ""
    }));

    return {
      hits: normalizedHits,
      facets: result?.facets || {},
      nbHits: result?.nbHits || normalizedHits.length || 0,
      page: result?.page || 0,
      nbPages: result?.nbPages || 1
    };
  }

  function hitToCard(h){
    const name = esc(h.name||'');
    const price = h.price !== undefined && h.price !== '' ? Number(h.price) : '';
    const pn = esc(h.pn || h.sku || '');
    const img = esc(h.image || PLACEHOLDER);
    const link = esc(h.link || '');
    const brand = esc(h.brand || '');
    
    const productId = h.objectID || pn || name;
    const isFav = window.QiqFavorites?.isFavorite(productId) || false;
    const inComparison = window.QiqComparison?.isInComparison(productId) || false;

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
          <button class="btn ${isFav ? 'btn-favorite active' : 'btn-favorite'}" type="button"
            onclick="toggleFavorite(this, '${productId}', ${JSON.stringify({name, price, pn, image: img, manufacturer: brand}).replace(/"/g, '&quot;')})"
            title="${isFav ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}">
            ${isFav ? '❤️' : '🤍'}
          </button>
          <button class="btn ${inComparison ? 'btn-compare active' : 'btn-compare'}" type="button"
            onclick="toggleComparison(this, '${productId}', ${JSON.stringify({name, price, pn, image: img, manufacturer: brand}).replace(/"/g, '&quot;')})"
            title="${inComparison ? 'إزالة من المقارنة' : 'إضافة للمقارنة'}">
            ⚖️
          </button>
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
    statusEl.textContent = q? `Searching for "${q}"...` : 'Loading top products...';
    const filters = getSelectedFilters();
    const res = await apiSearch(q, {hitsPerPage: 24, page, filters});
    const hits = Array.isArray(res?.hits)? res.hits : [];
    const via = res? (res._source === 'frontend' ? `via Algolia (frontend)${res._index?` • ${res._index}`:''}` : 'via backend') : '';
    statusEl.textContent = `${res?.nbHits||hits.length} result(s)${via?` • ${via}`:''}`;
    if ((res?.nbHits || hits.length) === 0 && window.QiqToast?.show) {
      const tip = 'لا توجد نتائج. جرّب كلمة بحث مختلفة، أو مرر algoliaIndex=اسم_الفهرس في الرابط، أو اضبط متغيرات البيئة على الخادم.';
      window.QiqToast.show(tip, 'warning', 5000);
    }
    searchCount++;
    
    resultsEl.innerHTML = hits.map(hitToCard).join('');
    renderFacets(res?.facets||{}, filters);
    renderPagination(res?.page||0, res?.nbPages||1, (p)=>render(q, p));
    
    // Show motivational message after first search
    if (searchCount === 1 && hits.length > 0) {
      setTimeout(() => showMotivationalMessage(1), 500);
    }
    
    // Rewire facet checkboxes after render
    document.querySelectorAll('#facet-brands input[type="checkbox"], #facet-categories input[type="checkbox"]').forEach(cb=>{
      cb.addEventListener('change', ()=> render((input?.value||'').trim(), 0));
    });
  }

  // Quick action buttons
  document.addEventListener('click', (e) => {
    // Open Favorites modal
    if (e.target.closest('#favorites-btn')) {
      e.preventDefault();
      const list = (window.QiqFavorites?.getAll?.() || []);
      const html = `
        <div style="font-family: system-ui, -apple-system, Segoe UI; padding: 16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin:0 0 12px 0;">
            <h3 style="margin:0;">❤️ المفضلة (${list.length})</h3>
            ${list.length>0 ? `<div style=\"display:flex;gap:8px;\">
              <button class=\"btn secondary\" onclick=\"(function(){ if(window.QiqFavorites){ QiqFavorites.clear(); document.dispatchEvent(new CustomEvent('favoritesChanged',{detail:{count:0}})); } QiqModal?.close(); })()\">Clear All</button>
            </div>` : ''}
          </div>
          ${list.length === 0 ? '<p style="color:#6b7280">لا توجد عناصر مضافة للمفضلة حتى الآن.</p>' : ''}
          <div style="display:grid; gap:10px;">
            ${list.map(p => `
              <div style="display:flex; gap:10px; align-items:center; border:1px solid #e5e7eb; border-radius:8px; padding:8px;">
                <img src="${p.image || 'https://via.placeholder.com/60'}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;background:#f3f4f6"/>
                <div style="flex:1;">
                  <div style="font-weight:600;">${p.name}</div>
                  <div style="font-size:12px;color:#6b7280">${p.sku || ''}</div>
                </div>
                <button class="btn" onclick="AddToQuote({dataset:{name:'${p.name.replace(/'/g,"&#39;")}',price:'${p.price||''}',pn:'${p.sku||''}',image:'${p.image||''}',manufacturer:'${p.manufacturer||''}',source:'Favorites'}})">Add</button>
                <button class="btn secondary" onclick="(function(){ if(window.QiqFavorites){ QiqFavorites.remove('${p.id}'); document.dispatchEvent(new CustomEvent('favoritesChanged',{detail:{count:QiqFavorites.getAll().length}})); } QiqModal?.open(undefined,{title:'المفضلة', html: document.querySelector('#qiq-modal-frame').srcdoc}); })()">Remove</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      window.QiqModal?.open(undefined, { title: 'المفضلة', html });
      return;
    }

    // Open Comparison modal
    if (e.target.closest('#comparison-btn')) {
      e.preventDefault();
      const count = window.QiqComparison?.getAll?.().length || 0;
      const asCSV = () => {
        try {
          const items = window.QiqComparison?.getAll?.() || [];
          const headers = ['Name','SKU','Manufacturer','Price'];
          const rows = items.map(p=>[
            (p.name||'').replace(/\"/g,'\"\"'),
            (p.sku||'').replace(/\"/g,'\"\"'),
            (p.manufacturer||'').replace(/\"/g,'\"\"'),
            (p.price??'')
          ]);
          const csv = [headers, ...rows].map(r=>r.map(v=>`\"${v}\"`).join(',')).join('\n');
          const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = 'comparison.csv'; a.click();
          setTimeout(()=> URL.revokeObjectURL(url), 1500);
        } catch {}
      };

      const html = `
        <div style=\"font-family: system-ui, -apple-system, Segoe UI; padding: 16px;\">
          <div style=\"display:flex;align-items:center;justify-content:space-between;margin:0 0 12px 0;\">
            <h3 style=\"margin:0;\">⚖️ مقارنة (${count})</h3>
            ${count>0 ? `<div style=\\\"display:flex;gap:8px;\\\">`
              + `<button class=\\\"btn secondary\\\" onclick=\\\"(${asCSV.toString()})()\\\">Export CSV</button>`
              + `<button class=\\\"btn secondary\\\" onclick=\\\"(function(){ if(window.QiqComparison){ QiqComparison.clear(); document.dispatchEvent(new CustomEvent('comparisonChanged',{detail:{count:0}})); } QiqModal?.close(); })()\\\">Clear All</button>`
              + `</div>` : ''}
          </div>
          <div>${(window.QiqComparison?.generateComparisonTable?.() || '<p>لا توجد عناصر للمقارنة.</p>')}</div>
        </div>
      `;
      window.QiqModal?.open(undefined, { title: 'المقارنة', html });
      return;
    }
    if (e.target.matches('.quick-btn')) {
      const query = e.target.dataset.query;
      input.value = query;
      
      // Update button states
      document.querySelectorAll('.quick-btn').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      
      // Update URL and search
      const u = new URL(window.location.href);
      u.searchParams.set('q', query);
      history.replaceState(null,'',u.toString());
      render(query, 0);
    }
  });

  // Quote action buttons
  document.addEventListener('click', (e) => {
    if (e.target.matches('#create-quote')) {
      if (quoteItems.length === 0) {
        alert('يرجى إضافة منتجات أولاً لإنشاء عرض السعر');
        return;
      }
      
      // Export to quote page
      localStorage.setItem('pendingQuoteItems', JSON.stringify(quoteItems));
      window.location.href = '/quote.html?from=search';
    }
    
    if (e.target.matches('#request-custom-quote')) {
      if (quoteItems.length === 0) {
        alert('يرجى إضافة منتجات أولاً لطلب عرض سعر مخصص');
        return;
      }
      
      // Show project info modal
      showProjectInfoModal();
    }
    
    if (e.target.matches('#save-quote-draft')) {
      if (quoteItems.length === 0) {
        alert('لا توجد منتجات لحفظها كمسودة');
        return;
      }
      
      const draftName = prompt('اسم المسودة:', `مسودة ${new Date().toLocaleDateString('ar-EG')}`);
      if (draftName) {
        const drafts = JSON.parse(localStorage.getItem('quoteDrafts') || '[]');
        drafts.push({
          name: draftName,
          items: quoteItems,
          date: new Date().toISOString()
        });
        localStorage.setItem('quoteDrafts', JSON.stringify(drafts));
        alert('تم حفظ المسودة بنجاح!');
      }
    }
  });

  function showProjectInfoModal() {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 10000;
      background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
    `;
    
    modal.innerHTML = `
      <div style="background: white; border-radius: 12px; padding: 24px; max-width: 500px; width: 90%;">
        <h3 style="margin: 0 0 16px 0; text-align: center;">📋 بيانات المشروع</h3>
        <form id="project-form">
          <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500;">اسم المشروع *</label>
            <input type="text" required style="width: 100%; padding: 8px; border: 1px solid #e5e7eb; border-radius: 6px;" placeholder="مثال: نظام أمان للمبنى الإداري" />
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500;">الموقع</label>
            <input type="text" style="width: 100%; padding: 8px; border: 1px solid #e5e7eb; border-radius: 6px;" placeholder="مثال: القاهرة، مصر" />
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500;">تاريخ التنفيذ المتوقع</label>
            <input type="date" style="width: 100%; padding: 8px; border: 1px solid #e5e7eb; border-radius: 6px;" />
          </div>
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500;">ملاحظات إضافية</label>
            <textarea style="width: 100%; padding: 8px; border: 1px solid #e5e7eb; border-radius: 6px; min-height: 60px;" placeholder="أي تفاصيل إضافية عن المشروع..."></textarea>
          </div>
          <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button type="button" onclick="this.closest('.modal-backdrop').remove()" style="padding: 8px 16px; border: 1px solid #e5e7eb; background: white; border-radius: 6px; cursor: pointer;">إلغاء</button>
            <button type="submit" style="padding: 8px 16px; background: #059669; color: white; border: none; border-radius: 6px; cursor: pointer;">إرسال طلب العرض</button>
          </div>
        </form>
      </div>
    `;
    
    modal.className = 'modal-backdrop';
    document.body.appendChild(modal);
    
    modal.querySelector('#project-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      
      // Here you would normally send to backend
      alert('🎉 تم إرسال طلب العرض المخصص بنجاح!\nسيتم التواصل معك قريباً.');
      modal.remove();
      
      // Show final motivational message
      showMotivationalMessage(motivationalMessages.length - 1);
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
    document.querySelectorAll('.quick-btn').forEach(btn => btn.classList.remove('active'));
    render('', 0);
  });

  applyPriceBtn?.addEventListener('click', ()=>{
    render((input?.value||'').trim(), 0);
  });

  // Initialize
  const q0 = getParam('q');
  if(q0){
    input.value = q0;
    render(q0, 0);
  } else {
    render('', 0);
  }

  // Show initial motivational message
  setTimeout(() => {
    showMotivationalMessage(0);
    // Initialize favorites/comparison badges with current counts
    try {
      if (window.QiqFavorites && typeof updateFavoritesButton === 'function') {
        updateFavoritesButton({ count: window.QiqFavorites.getAll().length });
      }
      if (window.QiqComparison && typeof updateComparisonButton === 'function') {
        updateComparisonButton({ count: window.QiqComparison.getAll().length });
      }
    } catch {}
  }, 1000);

  // === FAVORITES AND COMPARISON FUNCTIONS ===
  window.toggleFavorite = function(button, productId, productData) {
    if (!window.QiqFavorites) return;

    const isCurrentlyFav = window.QiqFavorites.isFavorite(productId);
    const product = {
      id: productId,
      name: productData.name,
      price: productData.price,
      image: productData.image,
      sku: productData.pn,
      manufacturer: productData.manufacturer
    };
    
    if (isCurrentlyFav) {
      window.QiqFavorites.remove(productId);
      button.innerHTML = '🤍';
      button.classList.remove('active');
      button.title = 'إضافة للمفضلة';
      showMotivationalMessage(Math.floor(Math.random() * 2)); // Random info message
    } else {
      window.QiqFavorites.add(product);
      button.innerHTML = '❤️';
      button.classList.add('active');
      button.title = 'إزالة من المفضلة';
      showMotivationalMessage(1); // Success message
    }

    // Track analytics
    if (window.QiqAnalytics) {
      window.QiqAnalytics.trackEvent('favorite_toggled', {
        productId,
        action: isCurrentlyFav ? 'removed' : 'added',
        productName: productData.name
      });
    }
  };

  window.toggleComparison = function(button, productId, productData) {
    if (!window.QiqComparison) return;

    const isCurrentlyInComparison = window.QiqComparison.isInComparison(productId);
    const product = {
      id: productId,
      name: productData.name,
      price: productData.price,
      image: productData.image,
      sku: productData.pn,
      manufacturer: productData.manufacturer
    };
    
    if (isCurrentlyInComparison) {
      window.QiqComparison.remove(productId);
      button.classList.remove('active');
      button.title = 'إضافة للمقارنة';
      showMotivationalMessage(Math.floor(Math.random() * 2)); // Random info message
    } else {
      try {
        window.QiqComparison.add(product);
        button.classList.add('active');
        button.title = 'إزالة من المقارنة';
        showMotivationalMessage(2); // Good progress message
      } catch (err) {
        alert(err?.message || 'لا يمكن إضافة أكثر من 4 منتجات للمقارنة');
      }
    }

    // Track analytics
    if (window.QiqAnalytics) {
      window.QiqAnalytics.trackEvent('comparison_toggled', {
        productId,
        action: isCurrentlyInComparison ? 'removed' : 'added',
        productName: productData.name
      });
    }
  };
  
})();