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

  /* ---- بناء كارت نتيجة واحدة ---- */
  function hitToCard(hit) {
    // محاولة استخراج أهم الحقول الشائعة
    const name  = hit?.name || hit?.title || hit?.Description || "(No name)";
    const price = hit?.price || hit?.Price || hit?.list_price || hit?.ListPrice || "";
    const sku   = hit?.sku || hit?.SKU || hit?.pn || hit?.PN || hit?.part_number || hit?.PartNumber || "";
    const img   = hit?.image || hit?.image_url || hit?.thumbnail || (Array.isArray(hit?.images) ? hit.images[0] : "") || "";
    const link  = hit?.link || hit?.url || hit?.product_url || hit?.permalink || "";

    const safeName = esc(String(name));
    const safeSku = esc(String(sku));
    const safeImg = esc(img || PLACEHOLDER_IMG);
    const safeLink = esc(link);
    
    // Format price with $ sign
    const formattedPrice = price ? `$${esc(String(price))}` : "Price on request";

    return `
      <div class="product-card" style="margin:5px 0; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb; padding: 12px;">
        <table class="qiq-inline-table" style="margin: 0;">
          <tbody>
            <tr>
              <td style="width:68px; padding: 8px;">
                <img class="qiq-inline-img" src="${safeImg}" alt="${safeName}" onerror="this.src='${PLACEHOLDER_IMG}'" style="width: 64px; height: 64px; object-fit: contain;" />
              </td>
              <td style="padding: 8px;">
                <div style="font-weight: 700; margin-bottom: 4px;">${safeName}</div>
                ${safeSku ? `<div class="qiq-chip" style="font-weight: 700;"><strong>PN/SKU: ${safeSku}</strong></div>` : ""}
                <div style="font-weight: 700; color: #059669; margin-top: 4px; font-size: 16px;">${formattedPrice}</div>
                ${safeLink ? `<div style="margin-top:4px"><a class="qiq-link" href="${safeLink}" target="_blank" rel="noopener">View product details</a></div>` : ""}
              </td>
              <td style="width:220px; padding: 8px;">
                <div class="qiq-inline-actions" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                  <button class="qiq-mini qiq-add-btn" type="button"
                    data-name="${safeName}"
                    data-price="${price}"
                    data-sku="${safeSku}"
                    data-image="${safeImg}"
                    data-link="${safeLink}"
                    data-source="Search"
                    onclick="AddToQuote(this)"
                    title="Add this product to quotation"
                    style="background: #2563eb; color: white; border-color: #2563eb;">
                    Add
                  </button>
                  <button class="qiq-mini qiq-shop-btn" type="button"
                    onclick="window.open('${safeLink || '#'}','_blank','noopener')"
                    title="Open store in new tab"
                    style="background: #059669; color: white; border-color: #059669;">
                    Shop
                  </button>
                  <button class="qiq-mini qiq-quote-btn" type="button"
                    onclick="window.location.href='${safeLink && safeLink !== '#' ? '/public/quote.html?product=' + encodeURIComponent(safeName) : '/public/quote.html'}'"
                    title="Add to quotation form"
                    style="background: #ea580c; color: white; border-color: #ea580c;">
                    Add quotation
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  /* ---- تجميع مجموعة كروت ---- */
  function renderHitsBlock(title, hits) {
    if (!hits || !hits.length) return "";
    const cards = hits.map(hitToCard).join("");
    
    // Create unique ID for this block
    const blockId = `hits-block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return `
      <div class="qiq-section-title" style="display: flex; justify-content: space-between; align-items: center; margin: 12px 0 8px;">
        <span>${esc(title)} (${hits.length} products)</span>
        <button class="qiq-btn qiq-success" type="button" 
                onclick="addAllMatchedProducts('${blockId}')"
                title="Add all matched products to quotation"
                style="background: #059669; font-size: 14px; padding: 6px 12px;">
          Add all matched
        </button>
      </div>
      <div id="${blockId}" class="matched-products-container">
        ${cards}
      </div>
    `;
  }

  /* ---- Add all matched products functionality ---- */
  window.addAllMatchedProducts = function(blockId) {
    const container = document.getElementById(blockId);
    if (!container) return;
    
    const addButtons = container.querySelectorAll('.qiq-add-btn');
    let addedCount = 0;
    
    addButtons.forEach(btn => {
      try {
        AddToQuote(btn);
        addedCount++;
      } catch (e) {
        console.warn('Failed to add product:', e);
      }
    });
    
    if (addedCount > 0) {
      // Show success message
      const toast = document.createElement('div');
      toast.className = 'qiq-toast-item';
      toast.style.cssText = `
        position: fixed; 
        top: 20px; 
        right: 20px; 
        background: #059669; 
        color: white; 
        padding: 12px 16px; 
        border-radius: 8px; 
        box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
        z-index: 10000;
        font-weight: 500;
      `;
      toast.textContent = `Added ${addedCount} products to quotation`;
      document.body.appendChild(toast);
      
      setTimeout(() => {
        toast.remove();
      }, 3000);
    }
  };

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
      // Return mock data for development/testing
      return getMockSearchResults(query, hitsPerPage);
    }
  }

  /* ---- Mock data for development/testing ---- */
  function getMockSearchResults(query, hitsPerPage = 5) {
    const mockData = [
      {
        name: "Kaspersky Endpoint Security for Business Select",
        price: "165",
        sku: "KL4863XANFS",
        image: "https://via.placeholder.com/68x68/0066cc/ffffff?text=KS",
        link: "https://www.kaspersky.com/business-security/endpoint-select"
      },
      {
        name: "Kaspersky Anti-Virus 2024",
        price: "",
        sku: "KL1171XCAFS",
        image: "https://via.placeholder.com/68x68/ff6600/ffffff?text=KAV",
        link: "https://www.kaspersky.com/antivirus"
      },
      {
        name: "Kaspersky Internet Security",
        price: "89.99",
        sku: "KL1939XCBFS",
        image: "https://via.placeholder.com/68x68/009900/ffffff?text=KIS",
        link: "https://www.kaspersky.com/internet-security"
      },
      {
        name: "Kaspersky Security Cloud",
        price: "119.95",
        sku: "KL1923XCEFS",
        image: "https://via.placeholder.com/68x68/cc0099/ffffff?text=KSC",
        link: "https://www.kaspersky.com/security-cloud"
      },
      {
        name: "Kaspersky Total Security",
        price: "149.99",
        sku: "KL1949XDEFRS",
        image: "https://via.placeholder.com/68x68/ff3300/ffffff?text=KTS",
        link: "https://www.kaspersky.com/total-security"
      }
    ];
    
    return mockData.slice(0, hitsPerPage);
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

    // 2) نتائج البحث (نفس النص) – نعرض كروت فيها زر AddToQuote
    const hits = await runSearch(userText, 6);
    if (hits.length) {
      const html = renderHitsBlock("Matches & alternatives", hits);
      addMsg("bot", html, true);
    } else {
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
      const html = renderHitsBlock("Search results", results);
      addMsg("bot", html, true);
    } else {
      addMsg("bot", "لا توجد نتائج مطابقة.", true);
    }
  });
})();
