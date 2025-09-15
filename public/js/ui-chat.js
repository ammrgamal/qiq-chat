/* =========================
   QIQ – Chat + Product UI with Table Results
   (uses /api/chat and /api/search)
   ========================= */

(() => {
  // Initialize global basket instance
  if (typeof QiqBasket !== 'undefined') {
    window.qiqBasket = new QiqBasket();
  }

  /* ---- DOM Elements ---- */
  const win = document.getElementById("qiq-window");
  const form = document.getElementById("qiq-form");
  const input = document.getElementById("qiq-input");
  const sendBtn = form?.querySelector(".qiq-send");
  
  // Results table elements
  const resultsWrap = document.getElementById("qiq-results-wrap");
  const resultsBody = document.getElementById("qiq-results-body");
  const addAllResultsBtn = document.getElementById("qiq-add-all-results");
  const showQuoteBtn = document.getElementById("qiq-show-quote");
  const grandTotalEl = document.getElementById("qiq-grand-total");
  const resultsStatusEl = document.getElementById("qiq-results-status");
  const clarificationDiv = document.getElementById("qiq-clarification");
  const filterButtonsDiv = document.getElementById("qiq-filter-buttons");

  /* ---- Helpers ---- */
  const esc = s => (s ?? "").toString().replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c] || c));
  const PLACEHOLDER_IMG = "https://via.placeholder.com/40x40?text=IMG";

  // Current search results for table display
  let currentResults = [];

  function addMsg(role, html, asHtml = false) {
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

  // Welcome message
  addMsg("bot", "أهلاً بك في QuickITQuote 👋\nاسأل عن منتج أو رخصة، أو استخدم البحث للحصول على عروض الأسعار.");

  /* ---- Smart quantity extraction ---- */
  function extractQuantityFromText(text) {
    // Look for quantity patterns in Arabic and English
    const patterns = [
      /(\d+)\s*مستخدم/i,
      /(\d+)\s*user/i,
      /(\d+)\s*جهاز/i,
      /(\d+)\s*device/i,
      /(\d+)\s*رخصة/i,
      /(\d+)\s*license/i,
      /quantity[:\s]*(\d+)/i,
      /qty[:\s]*(\d+)/i,
      /كمية[:\s]*(\d+)/i,
      /عدد[:\s]*(\d+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const qty = parseInt(match[1]);
        if (qty > 0 && qty <= 10000) { // reasonable limits
          return qty;
        }
      }
    }
    return 1; // default quantity
  }

  /* ---- Build table row for search result ---- */
  function buildResultRow(hit, index) {
    const name = hit?.name || hit?.title || hit?.Description || "(No name)";
    const price = hit?.price || hit?.Price || hit?.list_price || hit?.ListPrice || "";
    const sku = hit?.sku || hit?.SKU || hit?.pn || hit?.PN || hit?.part_number || hit?.PartNumber || "";
    const img = hit?.image || hit?.image_url || hit?.thumbnail || (Array.isArray(hit?.images) ? hit.images[0] : "") || "";
    const link = hit?.link || hit?.url || hit?.product_url || hit?.permalink || "";

    const safeName = esc(String(name));
    const safePrice = esc(String(price));
    const safeSku = esc(String(sku));
    const safeImg = esc(img || PLACEHOLDER_IMG);
    const safeLink = esc(link);

    // Parse numeric price for calculations
    const numericPrice = parseFloat(String(price).replace(/[^\d.-]/g, '')) || 0;
    const defaultQty = extractQuantityFromText(input?.value || '');

    const tr = document.createElement('tr');
    tr.dataset.index = index;
    tr.dataset.price = numericPrice;
    tr.innerHTML = `
      <td>
        <img src="${safeImg}" alt="${safeName}" onerror="this.src='${PLACEHOLDER_IMG}'" 
             style="width:40px;height:40px;object-fit:contain;border-radius:6px;border:1px solid #e5e7eb" />
      </td>
      <td>
        <div class="product-info">${safeName}</div>
        ${safeSku ? `<div class="product-badge">SKU: ${safeSku}</div>` : ""}
        ${safeLink ? `<div style="margin-top:4px"><a href="${safeLink}" target="_blank" rel="noopener" style="color:#2563eb;font-size:12px">View details</a></div>` : ""}
      </td>
      <td>
        <input type="number" class="qty-input" min="1" max="9999" value="${defaultQty}" data-index="${index}" 
               style="width:60px;padding:6px;border:1px solid #d1d5db;border-radius:6px;text-align:center" />
      </td>
      <td class="price-cell" style="text-align:right;font-weight:600">
        ${numericPrice > 0 ? `$${numericPrice.toFixed(2)}` : 'Price on request'}
      </td>
      <td class="line-total" style="text-align:right;color:#6b7280;font-weight:500">
        ${numericPrice > 0 ? `$${(numericPrice * defaultQty).toFixed(2)}` : '-'}
      </td>
      <td>
        <div class="actions" style="display:flex;gap:6px;align-items:center">
          <button class="btn-add" type="button" data-index="${index}"
                  aria-label="Add item to quotation" title="إضافة للعرض"
                  style="background:#059669;color:#fff;border:0;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500">
            Add
          </button>
          <button class="btn-details" type="button" onclick="window.open('${safeLink || '#'}','_blank','noopener')"
                  aria-label="View product details" title="عرض التفاصيل"
                  style="background:#6b7280;color:#fff;border:0;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px">
            Details
          </button>
        </div>
      </td>
    `;

    return tr;
  }

  /* ---- Update line totals when quantity changes ---- */
  function updateLineTotal(row) {
    const qtyInput = row.querySelector('.qty-input');
    const lineTotalCell = row.querySelector('.line-total');
    const price = parseFloat(row.dataset.price) || 0;
    const qty = parseInt(qtyInput.value) || 1;
    const lineTotal = price * qty;

    if (price > 0) {
      lineTotalCell.textContent = `$${lineTotal.toFixed(2)}`;
    } else {
      lineTotalCell.textContent = '-';
    }

    updateGrandTotal();
  }

  /* ---- Update grand total display from basket ---- */
  function updateGrandTotal() {
    let grandTotal = 0;
    resultsBody.querySelectorAll('tr').forEach(row => {
      const price = parseFloat(row.dataset.price) || 0;
      const qty = parseInt(row.querySelector('.qty-input').value) || 1;
      grandTotal += price * qty;
    });

    // Add basket total if basket exists
    if (window.qiqBasket) {
      const basketTotal = window.qiqBasket.getGrandTotal();
      grandTotal += basketTotal;
    }

    if (grandTotalEl) {
      grandTotalEl.textContent = grandTotal > 0 ? `$${grandTotal.toFixed(2)}` : '-';
    }

    // Update add all button state
    if (addAllResultsBtn) {
      addAllResultsBtn.disabled = currentResults.length === 0;
    }
  }

  /* ---- Display search results in table ---- */
  function displayResults(hits, query) {
    currentResults = hits.slice(0, 5); // Max 5 items as required
    
    if (!resultsWrap || !resultsBody) return;

    // Clear previous results
    resultsBody.innerHTML = '';

    if (currentResults.length === 0) {
      resultsWrap.style.display = 'none';
      return;
    }

    // Show clarification dialog if we have more than 5 results
    if (hits.length > 5) {
      showClarificationDialog(hits, query);
    } else {
      clarificationDiv.style.display = 'none';
    }

    // Build table rows
    currentResults.forEach((hit, index) => {
      const row = buildResultRow(hit, index);
      resultsBody.appendChild(row);
    });

    // Show results section
    resultsWrap.style.display = 'block';
    updateGrandTotal();

    // Update status
    if (resultsStatusEl) {
      const total = hits.length;
      const showing = currentResults.length;
      resultsStatusEl.textContent = `Showing ${showing} of ${total} results`;
    }
  }

  /* ---- Show clarification dialog for many results ---- */
  function showClarificationDialog(hits, query) {
    if (!clarificationDiv || !filterButtonsDiv) return;

    // Extract common categories/brands for filtering
    const categories = new Set();
    const brands = new Set();
    
    hits.forEach(hit => {
      const category = hit.category || hit.type || hit.product_type;
      const brand = hit.brand || hit.manufacturer;
      
      if (category) categories.add(category);
      if (brand) brands.add(brand);
    });

    // Create filter buttons
    filterButtonsDiv.innerHTML = '';
    
    const addFilterButton = (text, filterQuery) => {
      const btn = document.createElement('button');
      btn.className = 'filter-btn';
      btn.textContent = text;
      btn.onclick = () => {
        input.value = filterQuery;
        performSearch(filterQuery);
        clarificationDiv.style.display = 'none';
      };
      filterButtonsDiv.appendChild(btn);
    };

    // Add brand filters
    Array.from(brands).slice(0, 3).forEach(brand => {
      addFilterButton(brand, `${query} ${brand}`);
    });

    // Add category filters
    Array.from(categories).slice(0, 3).forEach(category => {
      addFilterButton(category, `${query} ${category}`);
    });

    clarificationDiv.style.display = 'block';
  }

  /* ---- Search API call ---- */
  async function runSearch(query, hitsPerPage = 20) {
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
      // Return mock data for testing when API is not available
      return getMockSearchResults(query);
    }
  }

  /* ---- Mock search results for testing ---- */
  function getMockSearchResults(query) {
    const mockData = [
      {
        name: "Kaspersky Endpoint Security for Business Advanced",
        price: "45.99",
        sku: "KES-ADV-2024",
        image: "https://via.placeholder.com/40x40?text=KAS",
        link: "https://www.kaspersky.com/enterprise-security",
        category: "Antivirus",
        brand: "Kaspersky"
      },
      {
        name: "Kaspersky Security Center",
        price: "299.99",
        sku: "KSC-MGMT-2024",
        image: "https://via.placeholder.com/40x40?text=KSC",
        link: "https://www.kaspersky.com/security-center",
        category: "Management",
        brand: "Kaspersky"
      },
      {
        name: "McAfee Total Protection Business",
        price: "39.99",
        sku: "MCAF-TOTAL-BIZ",
        image: "https://via.placeholder.com/40x40?text=MCAF",
        link: "https://www.mcafee.com/business",
        category: "Antivirus",
        brand: "McAfee"
      },
      {
        name: "Symantec Endpoint Protection",
        price: "55.00",
        sku: "SEP-14-ADV",
        image: "https://via.placeholder.com/40x40?text=SYM",
        link: "https://www.broadcom.com/products/cybersecurity",
        category: "Antivirus",
        brand: "Symantec"
      },
      {
        name: "Trend Micro Worry-Free Business Security",
        price: "42.50",
        sku: "WFBS-SERV-ADV",
        image: "https://via.placeholder.com/40x40?text=TREND",
        link: "https://www.trendmicro.com/business",
        category: "Antivirus",
        brand: "Trend Micro"
      },
      {
        name: "BitDefender GravityZone Business Security",
        price: "48.99",
        sku: "BDGZ-BIZ-PREM",
        image: "https://via.placeholder.com/40x40?text=BD",
        link: "https://www.bitdefender.com/business",
        category: "Antivirus",
        brand: "BitDefender"
      }
    ];

    // Filter results based on query keywords
    const keywords = query.toLowerCase().split(' ');
    return mockData.filter(item => {
      const searchText = `${item.name} ${item.brand} ${item.category}`.toLowerCase();
      return keywords.some(keyword => searchText.includes(keyword));
    });
  }

  /* ---- Chat API call ---- */
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
      // Return mock response for testing
      const lastMessage = messages[messages.length - 1]?.content || '';
      return getMockChatResponse(lastMessage);
    }
  }

  /* ---- Mock chat response for testing ---- */
  function getMockChatResponse(userMessage) {
    const responses = [
      "شكرًا لاستفسارك عن منتجات الأمان. سأعرض لك أفضل الخيارات المتاحة.",
      "فهمت احتياجك. دعني أعرض عليك المنتجات المناسبة لمتطلباتك.",
      "ممتاز! هذه هي أفضل المنتجات التي تلبي احتياجاتك.",
      "بناءً على طلبك، إليك أفضل الحلول المتاحة في الكتالوج."
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /* ---- Perform search and display results ---- */
  async function performSearch(query) {
    if (!query.trim()) return;

    const hits = await runSearch(query, 20);
    displayResults(hits, query);
  }

  /* ---- Chat system ---- */
  const messages = [
    {
      role: "system",
      content: "أنت QuickITQuote Intake Bot. بالعربي + الإنجليزي: اجمع بيانات العميل خطوة بخطوة، واسأله إن كان يريد اقتراحات من الكتالوج. عندما يكتب اسم منتج أو موديل، سنعرض نتائج بحث في جدول أسفل رسالتك."
    }
  ];

  // Form submission handler
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userText = (input?.value || "").trim();
    if (!userText) return;

    const originalInput = input.value;
    input.value = "";
    addMsg("user", userText);
    messages.push({ role: "user", content: userText });

    // 1) Chat response
    const thinking = addMsg("bot", "…");
    sendBtn && (sendBtn.disabled = true);
    
    try {
      const reply = await runChat(messages);
      let showReply = reply;
      
      try {
        const parsed = JSON.parse(reply);
        if (parsed && (parsed.hits || parsed.reply)) {
          showReply = parsed.reply || "";
        }
      } catch {}
      
      if (showReply && showReply.length < 400 && !showReply.startsWith("{")) {
        thinking.textContent = showReply;
        messages.push({ role: "assistant", content: showReply });
      } else {
        thinking.remove();
      }
    } finally {
      sendBtn && (sendBtn.disabled = false);
    }

    // 2) Search results in table
    await performSearch(userText);
  });

  /* ---- Event delegation for table interactions ---- */
  if (resultsBody) {
    resultsBody.addEventListener('input', (e) => {
      if (e.target.classList.contains('qty-input')) {
        const row = e.target.closest('tr');
        if (row) updateLineTotal(row);
      }
    });

    resultsBody.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-add')) {
        const index = parseInt(e.target.dataset.index);
        const row = e.target.closest('tr');
        const qtyInput = row.querySelector('.qty-input');
        const qty = parseInt(qtyInput.value) || 1;
        
        if (currentResults[index]) {
          const hit = currentResults[index];
          const itemData = {
            sku: hit.sku || hit.SKU || hit.pn || hit.PN || '',
            name: hit.name || hit.title || hit.Description || '',
            unitPrice: hit.price || hit.Price || hit.list_price || hit.ListPrice || 0,
            qty: qty,
            image: hit.image || hit.image_url || '',
            link: hit.link || hit.url || '',
            source: 'Search',
            pn: hit.pn || hit.PN || hit.sku || hit.SKU || ''
          };
          
          if (window.qiqBasket) {
            window.qiqBasket.addItem(itemData);
            e.target.textContent = 'Added ✓';
            e.target.disabled = true;
            setTimeout(() => {
              e.target.textContent = 'Add';
              e.target.disabled = false;
            }, 1500);
          }
        }
      }
    });
  }

  /* ---- Add all results to basket ---- */
  if (addAllResultsBtn) {
    addAllResultsBtn.addEventListener('click', () => {
      if (!window.qiqBasket || currentResults.length === 0) return;

      let addedCount = 0;
      currentResults.forEach((hit, index) => {
        const row = resultsBody.querySelector(`tr[data-index="${index}"]`);
        const qtyInput = row?.querySelector('.qty-input');
        const qty = parseInt(qtyInput?.value) || 1;

        const itemData = {
          sku: hit.sku || hit.SKU || hit.pn || hit.PN || '',
          name: hit.name || hit.title || hit.Description || '',
          unitPrice: hit.price || hit.Price || hit.list_price || hit.ListPrice || 0,
          qty: qty,
          image: hit.image || hit.image_url || '',
          link: hit.link || hit.url || '',
          source: 'Bulk Add',
          pn: hit.pn || hit.PN || hit.sku || hit.SKU || ''
        };

        if (window.qiqBasket.addItem(itemData)) {
          addedCount++;
        }
      });

      if (addedCount > 0) {
        addAllResultsBtn.textContent = `Added ${addedCount} items ✓`;
        addAllResultsBtn.disabled = true;
        setTimeout(() => {
          addAllResultsBtn.textContent = 'Add all to quotation';
          addAllResultsBtn.disabled = false;
        }, 2000);
      }
    });
  }

  /* ---- Show quote page ---- */
  if (showQuoteBtn) {
    showQuoteBtn.addEventListener('click', () => {
      window.location.href = 'quote.html';
    });
  }

  /* ---- Initialize UI ---- */
  if (window.qiqBasket) {
    window.qiqBasket.updateUI();
  }
})();
