/* =========================
   QIQ – Chat + Product UI
   (uses /api/chat and renders results in table below chat)
   ========================= */

(() => {
  /* ---- DOM ---- */
  const win   = document.getElementById("qiq-window");          // مساحة الرسائل
  const form  = document.getElementById("qiq-form");             // فورم الإدخال
  const input = document.getElementById("qiq-input");            // حقل الإدخال
  const sendBtn = form?.querySelector(".qiq-send");              // زر الإرسال (لو موجود)
  const resultsBody = document.getElementById("qiq-body");       // جدول النتائج
  const grandTotal = document.getElementById("qiq-grand");       // الإجمالي
  const addAllBtn = document.getElementById("qiq-add-all");      // زر إضافة الكل

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

  // Update grand total display
  function updateGrandTotal() {
    const total = window.QuoteStorage ? window.QuoteStorage.total() : 0;
    const formatted = window.QuoteStorage ? window.QuoteStorage.formatPrice(total) : '$0.00';
    if (grandTotal) {
      grandTotal.innerHTML = `<strong>${formatted}</strong>`;
    }
  }

  // Wait for QuoteStorage to be available and then update
  setTimeout(() => {
    updateGrandTotal();
  }, 100);

  /* ---- Render search results in table ---- */
  function renderResultsInTable(hits) {
    if (!resultsBody) return;

    // Clear existing results
    resultsBody.innerHTML = '';

    if (!hits || hits.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td colspan="5" style="text-align: center; padding: 20px; color: #6b7280;">
          No matches found. Try another model/PN.
        </td>
      `;
      resultsBody.appendChild(tr);
      updateAddAllButtonState();
      return;
    }

    // Limit to 5 results max
    const limitedHits = hits.slice(0, 5);

    limitedHits.forEach(hit => {
      const name = hit?.name || hit?.title || hit?.Description || "(No name)";
      const price = hit?.price || hit?.Price || hit?.list_price || hit?.ListPrice || "";
      const sku = hit?.sku || hit?.SKU || hit?.pn || hit?.PN || hit?.part_number || hit?.PartNumber || "";
      const img = hit?.image || hit?.image_url || hit?.thumbnail || (Array.isArray(hit?.images) ? hit.images[0] : "") || "";
      const link = hit?.link || hit?.url || hit?.product_url || hit?.permalink || "";

      const priceNum = window.QuoteStorage ? window.QuoteStorage.formatPrice(price, false) : '0';
      const displayPrice = priceNum === '0' ? 'Price on request' : `$${priceNum}`;

      const tr = document.createElement('tr');
      tr.className = 'result-row';
      tr.dataset.sku = sku;
      tr.dataset.name = name;
      tr.dataset.price = price;
      tr.dataset.image = img || PLACEHOLDER_IMG;
      tr.dataset.link = link;

      tr.innerHTML = `
        <td style="text-align: center;">
          <img class="product-img" src="${esc(img || PLACEHOLDER_IMG)}" alt="${esc(name)}" 
               onerror="this.src='${PLACEHOLDER_IMG}'" />
        </td>
        <td>
          <div style="font-weight: bold; margin-bottom: 4px;">${esc(name)}</div>
          ${sku ? `<div style="color: #6b7280; font-size: 12px;">PN/SKU: ${esc(sku)}</div>` : ''}
        </td>
        <td style="text-align: center;">
          ${displayPrice}
        </td>
        <td style="text-align: center;">
          –
        </td>
        <td>
          <div style="display: flex; gap: 8px; align-items: center; justify-content: center;">
            <button class="qiq-btn qiq-primary add-to-quotation" type="button" 
                    title="Add this item to quotation"
                    aria-label="Add ${esc(name)} to quotation">
              Add to quotation
            </button>
            <button class="qiq-btn item-details" type="button"
                    title="Open product page in new tab"
                    aria-label="View details for ${esc(name)}"
                    ${!link ? 'disabled title="No details available"' : ''}>
              Item details
            </button>
          </div>
        </td>
      `;

      resultsBody.appendChild(tr);
    });

    // Add event listeners to buttons
    resultsBody.querySelectorAll('.add-to-quotation').forEach(btn => {
      btn.addEventListener('click', function() {
        const row = this.closest('tr');
        const item = {
          sku: row.dataset.sku,
          name: row.dataset.name,
          price: row.dataset.price,
          image: row.dataset.image,
          link: row.dataset.link,
          qty: 1
        };

        if (window.QuoteStorage && window.QuoteStorage.addItem(item)) {
          // Navigate to quote page
          window.location.href = '/quote.html';
        } else {
          alert('Failed to add item to quotation');
        }
      });
    });

    resultsBody.querySelectorAll('.item-details').forEach(btn => {
      btn.addEventListener('click', function() {
        const row = this.closest('tr');
        const link = row.dataset.link;
        if (link) {
          window.open(link, '_blank', 'noopener,noreferrer');
        }
      });
    });

    updateAddAllButtonState();
  }

  /* ---- Update Add All button state ---- */
  function updateAddAllButtonState() {
    if (!addAllBtn) return;

    const resultRows = resultsBody ? resultsBody.querySelectorAll('.result-row') : [];
    addAllBtn.disabled = resultRows.length === 0;
  }

  /* ---- Add All functionality ---- */
  if (addAllBtn) {
    addAllBtn.addEventListener('click', function() {
      const resultRows = resultsBody ? resultsBody.querySelectorAll('.result-row') : [];
      
      if (resultRows.length === 0) return;

      const items = Array.from(resultRows).map(row => ({
        sku: row.dataset.sku,
        name: row.dataset.name,
        price: row.dataset.price,
        image: row.dataset.image,
        link: row.dataset.link,
        qty: 1
      }));

      if (window.QuoteStorage && window.QuoteStorage.addMany(items)) {
        // Navigate to quote page
        window.location.href = '/quote.html';
      } else {
        alert('Failed to add items to quotation');
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
      return [];
    }
  }

  /* ---- استدعاء /api/chat ---- */
  async function runChat(messages) {
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages })
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      
      const json = await r.json();
      
      // Extract reply and hits from response
      const reply = json.reply || '';
      const hits = json.hits || [];
      
      return { reply, hits };
    } catch (e) {
      console.warn("Chat error:", e);
      return { reply: "حصل خطأ أثناء الاتصال بالخادم.", hits: [] };
    }
  }

  /* ---- المنطق: لو المستخدم كتب كلمة/منتج → نبحث ونظهر كروت بداخلها زر AddToQuote ---- */
  const messages = [
    {
      role: "system",
      content:
        "أنت QuickITQuote Intake Bot. بالعربي + الإنجليزي: اجمع بيانات العميل خطوة بخطوة، واسأله إن كان يريد اقتراحات من الكتالوج. عندما يكتب اسم منتج أو موديل، سنعرض نتائج بحث أسفل رسالتك."
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
      const chatResponse = await runChat(messages);
      
      // Show bot reply in chat (text only)
      if (chatResponse.reply && chatResponse.reply.length < 400 && !chatResponse.reply.startsWith("{")) {
        thinking.textContent = chatResponse.reply;
        messages.push({ role: "assistant", content: chatResponse.reply });
      } else {
        thinking.remove();
      }

      // 2) Render search results in table below (not in chat)
      if (chatResponse.hits && chatResponse.hits.length > 0) {
        renderResultsInTable(chatResponse.hits);
      } else {
        // Try direct search as fallback
        const searchResults = await runSearch(userText, 5);
        renderResultsInTable(searchResults);
      }

    } finally {
      sendBtn && (sendBtn.disabled = false);
    }

    // Update grand total
    updateGrandTotal();
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

    const results = await runSearch(q, 5);
    renderResultsInTable(results);
    updateGrandTotal();
  });

  // Initial state update
  updateAddAllButtonState();
})();
