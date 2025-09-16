/* =========================
   QIQ – Chat + Product UI
   (uses /api/chat and /api/search)
   ========================= */

/** نقاط تكامل أساسية
 *  - الزر "Add" في كروت النتائج يستدعي AddToQuote(this)
 *  - لازم يكون ملف public/js/quote-actions.js محمّل قبله وفيه الدالة AddToQuote
 */

(() => {
  /* ---- DOM ---- */
  const win   = document.getElementById("qiq-window");          // مساحة الرسائل
  const form  = document.getElementById("qiq-form");             // فورم الإدخال
  const input = document.getElementById("qiq-input");            // حقل الإدخال
  const sendBtn = form?.querySelector(".qiq-send");              // زر الإرسال (لو موجود)
  
  // Search results elements
  const searchResultsSection = document.getElementById("qiq-search-results");
  const searchResultsBody = document.getElementById("qiq-search-results-body");
  const resultsSearchInput = document.getElementById("qiq-results-search-input");
  const resultsSearchCount = document.getElementById("qiq-results-search-count");
  const addAllResultsBtn = document.getElementById("qiq-add-all-results");
  const clearResultsBtn = document.getElementById("qiq-clear-results");

  /* ---- Helpers ---- */
  const esc = s => (s ?? "").toString().replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c] || c));
  const PLACEHOLDER_IMG = "https://via.placeholder.com/68?text=IMG";

  function addMsg(role, html, asHtml=false) {
    const wrap = document.createElement("div");
    wrap.className = "qiq-msg " + (role === "user" ? "user" : "bot");
    const bubble = document.createElement("div");
    bubble.className = "qiq-bubble";
    bubble.dir = "auto";
    if (asHtml) bubble.innerHTML = html; else bubble.textContent = html;
    wrap.appendChild(bubble);
    win.appendChild(wrap);
    win.scrollTop = win.scrollHeight;
    return bubble;
  }

  // رسالة ترحيب
  addMsg("bot", "أهلاً بك في QuickITQuote 👋\nاسأل عن منتج أو رخصة، أو استخدم زر \"البحث عن منتجات\".");

  /* ---- Mock data for demonstration ---- */
  const mockSearchData = [
    {
      name: "Kaspersky Endpoint Security for Business",
      sku: "KES-BSN-100",
      price: "45.99",
      manufacturer: "Kaspersky",
      image: "https://via.placeholder.com/68/059669/fff?text=KES",
      link: "#"
    },
    {
      name: "Kaspersky Anti-Virus",
      sku: "KAV-HOME-3",
      price: "29.99", 
      manufacturer: "Kaspersky",
      image: "https://via.placeholder.com/68/2563eb/fff?text=KAV",
      link: "#"
    },
    {
      name: "Kaspersky Internet Security",
      sku: "KIS-MULTI-5",
      price: "39.99",
      manufacturer: "Kaspersky", 
      image: "https://via.placeholder.com/68/dc2626/fff?text=KIS",
      link: "#"
    }
  ];

  function fmtUSD(v){
    const n = Number(String(v||"").replace(/[^\d.]/g,""));
    if(!isFinite(n)) return "-";
    try { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n); }
    catch { return `$${n.toFixed(2)}`; }
  }

  function numFromPrice(v){
    return Number(String(v||"").replace(/[^\d.]/g,"")) || 0;
  }

  /* ---- Build search results table row ---- */
  function buildSearchResultRow(hit, index) {
    const name = hit?.name || hit?.title || hit?.Description || "(No name)";
    const price = hit?.price || hit?.Price || hit?.list_price || hit?.ListPrice || "";
    const sku = hit?.sku || hit?.SKU || hit?.pn || hit?.PN || hit?.part_number || hit?.PartNumber || "";
    const manufacturer = hit?.manufacturer || hit?.brand || hit?.vendor || "Unknown";
    const img = hit?.image || hit?.image_url || hit?.thumbnail || (Array.isArray(hit?.images) ? hit.images[0] : "") || "";
    const link = hit?.link || hit?.url || hit?.product_url || hit?.permalink || "";

    const safeName = esc(String(name));
    const safePrice = esc(String(price));
    const safeSku = esc(String(sku));
    const safeManufacturer = esc(String(manufacturer));
    const safeImg = esc(img || PLACEHOLDER_IMG);
    const safeLink = esc(link);
    const rowId = `search-result-${index}`;

    const tr = document.createElement("tr");
    tr.id = rowId;
    tr.dataset.searchName = name.toLowerCase();
    tr.dataset.searchSku = sku.toLowerCase();
    
    const unitPrice = numFromPrice(price);
    const defaultQty = 1;
    const subtotal = unitPrice * defaultQty;

    tr.innerHTML = `
      <td><code>${safeSku || 'N/A'}</code></td>
      <td>
        <strong>${safeName}</strong>
        ${safeLink ? `<div style="margin-top:4px"><a class="qiq-link" href="${safeLink}" target="_blank" rel="noopener">عرض المنتج</a></div>` : ""}
      </td>
      <td>
        <img class="qiq-img" src="${safeImg}" alt="${safeName}" 
             onerror="this.src='${PLACEHOLDER_IMG}'" style="width:48px;height:48px;"/>
      </td>
      <td>
        <input type="number" min="1" step="1" value="${defaultQty}" class="qiq-qty-input" 
               onchange="updateSearchResultSubtotal('${rowId}', ${unitPrice})">
      </td>
      <td><span class="qiq-manufacturer">${safeManufacturer}</span></td>
      <td>${fmtUSD(price)}</td>
      <td class="subtotal-cell">${fmtUSD(subtotal)}</td>
      <td>
        <div class="qiq-cart-actions">
          <button class="qiq-cart-btn add" type="button" 
                  data-name="${safeName}"
                  data-price="${safePrice}"
                  data-sku="${safeSku}"
                  data-image="${safeImg}"
                  data-link="${safeLink}"
                  data-manufacturer="${safeManufacturer}"
                  data-source="Search"
                  onclick="addToCartFromSearch(this, '${rowId}')">
            🛒 إضافة للعربة
          </button>
          <button class="qiq-cart-btn delete" type="button" onclick="removeSearchResult('${rowId}')">
            🗑️
          </button>
        </div>
      </td>
    `;

    return tr;
  }

  /* ---- Update subtotal for search result row ---- */
  window.updateSearchResultSubtotal = function(rowId, unitPrice) {
    const row = document.getElementById(rowId);
    if (!row) return;
    
    const qtyInput = row.querySelector('.qiq-qty-input');
    const subtotalCell = row.querySelector('.subtotal-cell');
    
    if (qtyInput && subtotalCell) {
      const qty = Math.max(1, parseInt(qtyInput.value || "1", 10));
      const subtotal = unitPrice * qty;
      subtotalCell.textContent = fmtUSD(subtotal);
    }
  };

  /* ---- Add to cart from search results ---- */
  window.addToCartFromSearch = function(button, rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;
    
    const qtyInput = row.querySelector('.qiq-qty-input');
    const qty = Math.max(1, parseInt(qtyInput.value || "1", 10));
    
    // Prepare data for AddToQuote
    const data = {
      name: button.getAttribute("data-name") || "",
      price: button.getAttribute("data-price") || "",
      sku: button.getAttribute("data-sku") || "",
      pn: button.getAttribute("data-sku") || "",
      image: button.getAttribute("data-image") || "",
      link: button.getAttribute("data-link") || "",
      manufacturer: button.getAttribute("data-manufacturer") || "",
      source: button.getAttribute("data-source") || "Search"
    };
    
    // Disable button temporarily
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = "جاري الإضافة...";
    
    try {
      // Add to quote table
      if (window.AddToQuote) {
        window.AddToQuote(data);
      }
      
      // Show success notification
      if (window.QiqToast && window.QiqToast.success) {
        window.QiqToast.success("تمت إضافة المنتج للعربة بنجاح");
      }
      
      // Change button state
      button.textContent = "✓ تمت الإضافة";
      button.classList.remove('add');
      button.classList.add('success');
      
      // Auto navigate to preview section after 1 second
      setTimeout(() => {
        const boqSection = document.getElementById("qiq-boq-wrap");
        if (boqSection) {
          boqSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 1000);
      
    } catch (error) {
      console.error("Error adding to cart:", error);
      if (window.QiqToast && window.QiqToast.error) {
        window.QiqToast.error("خطأ في إضافة المنتج للعربة");
      }
    } finally {
      // Reset button after 2 seconds
      setTimeout(() => {
        button.disabled = false;
        button.textContent = originalText;
        button.classList.remove('success');
        button.classList.add('add');
      }, 2000);
    }
  };

  /* ---- Remove search result ---- */
  window.removeSearchResult = function(rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;
    
    const productName = row.querySelector('strong')?.textContent || 'هذا المنتج';
    const confirmMessage = `هل أنت متأكد من حذف "${productName}" من نتائج البحث؟`;
    
    if (confirm(confirmMessage)) {
      row.remove();
      updateSearchResultsCount();
      
      if (window.QiqToast && window.QiqToast.success) {
        window.QiqToast.success("تم حذف المنتج من النتائج");
      }
      
      // Hide section if no results remain
      if (!searchResultsBody?.children.length) {
        hideSearchResults();
      }
    }
  };

  /* ---- Display search results in table ---- */
  function displaySearchResults(hits) {
    if (!searchResultsSection || !searchResultsBody) return;
    
    // Clear previous results
    searchResultsBody.innerHTML = '';
    
    if (!hits || !hits.length) {
      hideSearchResults();
      return;
    }
    
    // Build table rows
    hits.forEach((hit, index) => {
      const row = buildSearchResultRow(hit, index);
      searchResultsBody.appendChild(row);
    });
    
    // Show the section
    searchResultsSection.style.display = 'block';
    updateSearchResultsCount();
    
    // Scroll to results
    setTimeout(() => {
      searchResultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  function hideSearchResults() {
    if (searchResultsSection) {
      searchResultsSection.style.display = 'none';
    }
  }

  function updateSearchResultsCount() {
    if (!resultsSearchCount || !searchResultsBody) return;
    
    const totalResults = searchResultsBody.children.length;
    const visibleResults = Array.from(searchResultsBody.children).filter(row => 
      row.style.display !== 'none'
    ).length;
    
    if (resultsSearchInput?.value.trim()) {
      resultsSearchCount.textContent = `${visibleResults} من ${totalResults} نتيجة`;
      resultsSearchCount.style.color = visibleResults === 0 ? '#dc2626' : '#059669';
    } else {
      resultsSearchCount.textContent = `${totalResults} نتيجة`;
      resultsSearchCount.style.color = '#6b7280';
    }
    
    // Update add all button state
    if (addAllResultsBtn) {
      addAllResultsBtn.disabled = visibleResults === 0;
    }
  }

  /* ---- Search filter for results ---- */
  function filterSearchResults(searchTerm) {
    if (!searchResultsBody) return;
    
    const term = searchTerm.toLowerCase().trim();
    const rows = Array.from(searchResultsBody.children);
    
    rows.forEach(row => {
      if (!term) {
        row.style.display = '';
        return;
      }
      
      const name = row.dataset.searchName || '';
      const sku = row.dataset.searchSku || '';
      
      const matches = name.includes(term) || sku.includes(term);
      row.style.display = matches ? '' : 'none';
    });
    
    updateSearchResultsCount();
  }

  // Add event listeners for search results filtering
  if (resultsSearchInput) {
    resultsSearchInput.addEventListener('input', (e) => {
      filterSearchResults(e.target.value);
    });
    
    resultsSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.target.value = '';
        filterSearchResults('');
        e.target.blur();
      }
    });
  }

  // Clear results button
  if (clearResultsBtn) {
    clearResultsBtn.addEventListener('click', () => {
      if (confirm('هل أنت متأكد من مسح جميع نتائج البحث؟')) {
        hideSearchResults();
        if (window.QiqToast && window.QiqToast.success) {
          window.QiqToast.success("تم مسح نتائج البحث");
        }
      }
    });
  }

  // Add all results to cart
  if (addAllResultsBtn) {
    addAllResultsBtn.addEventListener('click', () => {
      const visibleRows = Array.from(searchResultsBody?.children || []).filter(row => 
        row.style.display !== 'none'
      );
      
      if (!visibleRows.length) return;
      
      const confirmMessage = `هل تريد إضافة جميع النتائج المرئية (${visibleRows.length} منتج) للعربة؟`;
      if (!confirm(confirmMessage)) return;
      
      let addedCount = 0;
      visibleRows.forEach(row => {
        const addButton = row.querySelector('.qiq-cart-btn.add');
        if (addButton && !addButton.disabled) {
          addButton.click();
          addedCount++;
        }
      });
      
      if (addedCount > 0 && window.QiqToast && window.QiqToast.success) {
        window.QiqToast.success(`تمت إضافة ${addedCount} منتج للعربة`);
      }
    });
  }

  /* ---- استدعاء /api/search ---- */
  async function runSearch(query, hitsPerPage = 5) {
    try {
      const r = await fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, hitsPerPage })
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      return Array.isArray(json?.hits) ? json.hits : [];
    } catch (e) {
      console.warn("Search error:", e);
      // Return mock data for demonstration
      const queryLower = query.toLowerCase();
      return mockSearchData.filter(item => 
        item.name.toLowerCase().includes(queryLower) ||
        item.sku.toLowerCase().includes(queryLower)
      );
    }
  }

  /* ---- استدعاء /api/chat (نفس الموجود قبل كده) ---- */
  async function runChat(messages) {
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages })
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const text = await r.text();
      return text || "";
    } catch (e) {
      console.warn("Chat error:", e);
      return "حصل خطأ أثناء الاتصال بالخادم.";
    }
  }

  /* ---- المنطق: لو المستخدم كتب كلمة/منتج → نبحث ونظهر في الجدول ---- */
  const messages = [
    {
      role: "system",
      content:
        "أنت QuickITQuote Intake Bot. بالعربي + الإنجليزي: اجمع بيانات العميل خطوة بخطوة، واسأله إن كان يريد اقتراحات من الكتالوج. عندما يكتب اسم منتج أو موديل، سنعرض نتائج بحث في جدول منفصل."
    }
  ];

  // إرسال الرسالة
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userText = (input?.value || "").trim();
    if (!userText) return;

    input.value = "";
    addMsg("user", userText);
    messages.push({ role: "user", content: userText });

    // 1) رد الشات
    const thinking = addMsg("bot", "…");
    sendBtn && (sendBtn.disabled = true);
    try {
      const reply = await runChat(messages);
      let showReply = reply;
      // إذا كان الرد JSON أو يحتوي على hits، تجاهله
      try {
        const parsed = JSON.parse(reply);
        if (parsed && (parsed.hits || parsed.reply)) {
          showReply = parsed.reply || "";
        }
      } catch {}
      // إذا كان الرد نفسه JSON أو طويل وغير مفهوم، لا تعرضه
      if (showReply && showReply.length < 400 && !showReply.startsWith("{")) {
        thinking.textContent = showReply;
      } else {
        thinking.remove();
      }
    } finally {
      sendBtn && (sendBtn.disabled = false);
    }

    // 2) نتائج البحث (نفس النص) – نعرض في الجدول الجديد
    const hits = await runSearch(userText, 6);
    if (hits.length) {
      displaySearchResults(hits);
      addMsg("bot", `تم العثور على ${hits.length} نتيجة مطابقة. تحقق من الجدول أسفل لرؤية النتائج والبدائل.`);
    } else {
      hideSearchResults();
      addMsg("bot", "ملقيناش تطابق مباشر. حاول تكتب اسم المنتج/الموديل بدقة أكبر أو جرّب رفع BOQ.", true);
    }
  });

  /* ---- لو عندك زر مستقل للبحث عن المنتجات (اختياري) اربطه هنا ----
     مثال: زر id="qiq-search-btn" يقرأ من input ويعرض النتائج فقط
  */
  const searchBtn = document.getElementById("qiq-search-btn");
  searchBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    const q = (input?.value || "").trim();
    if (!q) return;
    addMsg("user", q);

    const results = await runSearch(q, 8);
    if (results.length) {
      displaySearchResults(results);
      addMsg("bot", `تم العثور على ${results.length} نتيجة. راجع الجدول أسفل.`);
    } else {
      hideSearchResults();
      addMsg("bot", "لا توجد نتائج مطابقة.", true);
    }
  });
})();
