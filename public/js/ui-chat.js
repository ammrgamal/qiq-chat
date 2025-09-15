/* =========================
   QIQ – Chat + Results Table UI
   (uses /api/chat and /api/search)
   ========================= */

/** نقاط تكامل أساسية
 *  - يستخدم QIQBasket لإدارة localStorage الموحد
 *  - عرض النتائج في جدول فقط، بدون كروت في الشات
 *  - حد أقصى 5 نتائج في الجدول
 */

(() => {
  /* ---- DOM Elements ---- */
  const win   = document.getElementById("qiq-window");          // مساحة الرسائل
  const form  = document.getElementById("qiq-form");             // فورم الإدخال
  const input = document.getElementById("qiq-input");            // حقل الإدخال
  const sendBtn = form?.querySelector(".qiq-send");              // زر الإرسال
  
  // Results table elements
  const resultsWrap = document.getElementById("qiq-results-wrap");
  const resultsBody = document.getElementById("qiq-results-body");
  const resultsCount = document.getElementById("qiq-results-count");
  const addAllBtn = document.getElementById("qiq-add-all");
  const showQuoteBtn = document.getElementById("qiq-show-quote");
  const grandTotalEl = document.getElementById("qiq-grand-total");

  /* ---- Helpers ---- */
  const esc = s => (s ?? "").toString().replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c] || c));
  const PLACEHOLDER_IMG = "https://via.placeholder.com/40x40?text=IMG";

  let currentUserMessage = ''; // Store current user message for smart quantity extraction

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
  addMsg("bot", "أهلاً بك في QuickITQuote 👋\nاسأل عن منتج أو رخصة، أو استخدم البحث للعثور على منتجات.");

  /* ---- Results Table Management ---- */
  function updateGrandTotal() {
    if (!grandTotalEl) return;
    const items = [...(resultsBody?.querySelectorAll("tr") || [])];
    let total = 0;
    
    items.forEach(tr => {
      const priceText = tr.dataset.price || '';
      const qtyInput = tr.querySelector('.qiq-qty');
      const qty = qtyInput ? Math.max(1, parseInt(qtyInput.value || '1', 10)) : 1;
      const price = QIQBasket.formatPrice ? 
        parseFloat(String(priceText).replace(/[^\d.]/g, '')) || 0 : 0;
      total += price * qty;
    });
    
    grandTotalEl.textContent = total > 0 ? QIQBasket.formatPrice(total) : '-';
  }

  function updateLineTotal(tr) {
    const priceText = tr.dataset.price || '';
    const qtyInput = tr.querySelector('.qiq-qty');
    const lineTotalEl = tr.querySelector('.qiq-line-total');
    
    if (!qtyInput || !lineTotalEl) return;
    
    const qty = Math.max(1, parseInt(qtyInput.value || '1', 10));
    const price = parseFloat(String(priceText).replace(/[^\d.]/g, '')) || 0;
    const lineTotal = price * qty;
    
    lineTotalEl.textContent = lineTotal > 0 ? QIQBasket.formatPrice(lineTotal) : '-';
    updateGrandTotal();
  }

  function buildResultRow(hit) {
    const name = hit?.name || hit?.title || hit?.Description || "(No name)";
    const price = hit?.price || hit?.Price || hit?.list_price || hit?.ListPrice || "";
    const sku = hit?.sku || hit?.SKU || hit?.pn || hit?.PN || hit?.part_number || hit?.PartNumber || "";
    const img = hit?.image || hit?.image_url || hit?.thumbnail || (Array.isArray(hit?.images) ? hit.images[0] : "") || PLACEHOLDER_IMG;
    const link = hit?.link || hit?.url || hit?.product_url || hit?.permalink || "";

    const tr = document.createElement("tr");
    tr.dataset.price = price;
    tr.dataset.sku = sku;
    tr.dataset.name = name;
    tr.dataset.image = img;
    tr.dataset.link = link;

    const defaultQty = currentUserMessage ? QIQBasket.extractQuantity(currentUserMessage) : 1;

    tr.innerHTML = `
      <td>
        <img class="qiq-results-img" src="${esc(img)}" alt="${esc(name)}" 
             onerror="this.src='${PLACEHOLDER_IMG}'" style="width:40px;height:40px;object-fit:contain;border-radius:4px;" />
      </td>
      <td>
        <div style="font-weight:600">${esc(name)}</div>
        ${sku ? `<div class="qiq-chip">PN/SKU: ${esc(sku)}</div>` : ""}
      </td>
      <td>
        <input type="number" min="1" step="1" value="${defaultQty}" class="qiq-qty" style="width:60px;padding:4px;border:1px solid #d1d5db;border-radius:4px;" />
      </td>
      <td>
        <span class="qiq-unit-price">${price ? QIQBasket.formatPrice(price) : "Price on request"}</span>
      </td>
      <td>
        <span class="qiq-line-total">-</span>
      </td>
      <td>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <button class="qiq-btn qiq-mini qiq-primary" type="button" data-action="add"
                  title="Add to quotation" aria-label="Add to quotation">Add</button>
          ${link ? `<button class="qiq-btn qiq-mini" type="button" data-action="shop"
                            title="View product details" aria-label="View product details">Shop</button>` : ''}
        </div>
      </td>
    `;

    // Event listeners
    const qtyInput = tr.querySelector('.qiq-qty');
    qtyInput?.addEventListener('input', () => updateLineTotal(tr));

    // Add button
    const addBtn = tr.querySelector('[data-action="add"]');
    addBtn?.addEventListener('click', () => {
      const qty = Math.max(1, parseInt(qtyInput?.value || '1', 10));
      const itemData = {
        sku: sku,
        name: name,
        price: price,
        image: img,
        link: link,
        source: 'Search'
      };
      
      if (QIQBasket.addItem) {
        QIQBasket.addItem(itemData, currentUserMessage);
        showToast(`تمت إضافة ${name} إلى العرض بكمية ${qty}`, 'success');
        addBtn.textContent = 'Added ✓';
        addBtn.disabled = true;
        setTimeout(() => {
          addBtn.textContent = 'Add';
          addBtn.disabled = false;
        }, 2000);
      }
    });

    // Shop button
    const shopBtn = tr.querySelector('[data-action="shop"]');
    shopBtn?.addEventListener('click', () => {
      if (link) {
        window.open(link, '_blank', 'noopener');
      }
    });

    // Update line total initially
    updateLineTotal(tr);
    
    return tr;
  }

  function renderResultsTable(hits) {
    if (!resultsBody || !resultsWrap) return;
    
    // Clear previous results
    resultsBody.innerHTML = '';
    
    if (!hits || hits.length === 0) {
      resultsWrap.style.display = 'none';
      return;
    }

    // Limit to 5 results
    const limitedHits = hits.slice(0, 5);
    
    // Build table rows
    limitedHits.forEach(hit => {
      const row = buildResultRow(hit);
      resultsBody.appendChild(row);
    });

    // Update UI elements
    if (resultsCount) {
      resultsCount.textContent = `${limitedHits.length} من ${hits.length} نتيجة`;
    }

    if (addAllBtn) {
      addAllBtn.disabled = limitedHits.length === 0;
    }

    // Show results section
    resultsWrap.style.display = 'block';
    updateGrandTotal();

    // Check if clarification is needed
    if (QIQBasket.shouldShowClarification && QIQBasket.shouldShowClarification(hits)) {
      const clarification = QIQBasket.getClarificationMessage(currentUserMessage, hits.length);
      showClarificationDialog(clarification, hits.length);
    }
  }

  /* ---- Toast Notifications ---- */
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `qiq-toast-item qiq-toast-${type}`;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#059669' : '#374151'};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 9999;
      max-width: 300px;
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  /* ---- Clarification Dialog ---- */
  function showClarificationDialog(clarification, resultCount) {
    if (!clarification) return;
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 400px;
      text-align: center;
    `;
    
    dialog.innerHTML = `
      <h3 style="margin: 0 0 12px; color: #374151;">تحسين البحث</h3>
      <p style="margin: 0 0 16px; color: #6b7280;">${clarification.ar}</p>
      <div style="display: flex; gap: 8px; justify-content: center;">
        <button class="qiq-btn qiq-primary" onclick="this.parentElement.parentElement.remove()">متابعة</button>
        <button class="qiq-btn" onclick="this.parentElement.parentElement.remove(); document.getElementById('qiq-input').focus();">تحسين البحث</button>
      </div>
    `;
    
    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 9999;
    `;
    backdrop.onclick = () => {
      backdrop.remove();
      dialog.remove();
    };
    
    document.body.appendChild(backdrop);
    document.body.appendChild(dialog);
  }

  /* ---- API Calls ---- */
  async function runSearch(query, hitsPerPage = 5) {
    // Use mock function if available (for testing)
    if (typeof window.runSearch === 'function' && window.runSearch !== runSearch) {
      return await window.runSearch(query, hitsPerPage);
    }
    
    try {
      const r = await fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, hitsPerPage: Math.max(hitsPerPage, 10) }) // Get more for clarification
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      return Array.isArray(json?.hits) ? json.hits : [];
    } catch (e) {
      console.warn("Search error:", e);
      return [];
    }
  }

  async function runChat(messages) {
    // Use mock function if available (for testing)
    if (typeof window.runChat === 'function' && window.runChat !== runChat) {
      return await window.runChat(messages);
    }
    
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

  /* ---- Main Logic ---- */
  const messages = [
    {
      role: "system",
      content: "أنت QuickITQuote Intake Bot. بالعربي + الإنجليزي: اجمع بيانات العميل خطوة بخطوة، واسأله إن كان يريد اقتراحات من الكتالوج. عندما يكتب اسم منتج أو موديل، سنعرض نتائج بحث في جدول منفصل."
    }
  ];

  // Form submission
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userText = (input?.value || "").trim();
    if (!userText) return;

    currentUserMessage = userText; // Store for smart quantity extraction
    input.value = "";
    addMsg("user", userText);
    messages.push({ role: "user", content: userText });

    // 1) Chat response
    const thinking = addMsg("bot", "…");
    sendBtn && (sendBtn.disabled = true);
    
    try {
      const reply = await runChat(messages);
      let showReply = reply;
      
      // Handle JSON responses
      try {
        const parsed = JSON.parse(reply);
        if (parsed && (parsed.hits || parsed.reply)) {
          showReply = parsed.reply || "";
        }
      } catch {}
      
      // Show meaningful response only
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
    const hits = await runSearch(userText, 5);
    renderResultsTable(hits);
    
    if (hits.length === 0) {
      addMsg("bot", "لم أجد نتائج مطابقة. حاول كتابة اسم المنتج أو الموديل بدقة أكبر.", true);
    }
  });

  /* ---- Button Event Handlers ---- */
  
  // Add all to quotation
  addAllBtn?.addEventListener('click', () => {
    const rows = resultsBody?.querySelectorAll('tr') || [];
    let addedCount = 0;
    
    rows.forEach(tr => {
      const qtyInput = tr.querySelector('.qiq-qty');
      const qty = Math.max(1, parseInt(qtyInput?.value || '1', 10));
      
      const itemData = {
        sku: tr.dataset.sku || '',
        name: tr.dataset.name || '',
        price: tr.dataset.price || '',
        image: tr.dataset.image || '',
        link: tr.dataset.link || '',
        source: 'Bulk Add'
      };
      
      if (QIQBasket.addItem && QIQBasket.addItem(itemData, currentUserMessage)) {
        addedCount++;
      }
    });
    
    if (addedCount > 0) {
      showToast(`تمت إضافة ${addedCount} عنصر إلى العرض`, 'success');
      addAllBtn.textContent = 'Added ✓';
      addAllBtn.disabled = true;
      setTimeout(() => {
        addAllBtn.textContent = 'Add all to quotation';
        addAllBtn.disabled = false;
      }, 3000);
    }
  });

  // Show the quote
  showQuoteBtn?.addEventListener('click', () => {
    window.location.href = 'quote.html';
  });

})();
