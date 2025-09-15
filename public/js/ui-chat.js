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

  // عرض مثال على التصميم الجديد المدمج
  setTimeout(() => {
    const mockHits = [
      {
        name: "Kaspersky Endpoint Security for Business - Advanced",
        price: "$45.99",
        sku: "KL4867AAFTS",
        image: "https://via.placeholder.com/32x32?text=KAS",
        link: "#"
      },
      {
        name: "Kaspersky EDR Optimum",
        price: "$89.99", 
        sku: "KL4906AAFTS",
        image: "https://via.placeholder.com/32x32?text=EDR",
        link: "#"
      },
      {
        name: "Cisco ASA 5506-X Firewall",
        price: "$750.00",
        sku: "ASA5506-K9",
        image: "https://via.placeholder.com/32x32?text=CISCO",
        link: "#"
      },
      {
        name: "Microsoft 365 Business Premium",
        price: "$22.00",
        sku: "CFQ7TTC0LH18",
        image: "https://via.placeholder.com/32x32?text=M365",
        link: "#"
      }
    ];
    const html = renderHitsBlock("مثال على العرض المدمج الجديد", mockHits);
    addMsg("bot", html, true);
  }, 1000);

  /* ---- بناء كارت نتيجة واحدة (نمط خط مدمج) ---- */
  function hitToLineItem(hit) {
    // محاولة استخراج أهم الحقول الشائعة
    const name  = hit?.name || hit?.title || hit?.Description || "(No name)";
    const price = hit?.price || hit?.Price || hit?.list_price || hit?.ListPrice || "";
    const sku   = hit?.sku || hit?.SKU || hit?.pn || hit?.PN || hit?.part_number || hit?.PartNumber || "";
    const img   = hit?.image || hit?.image_url || hit?.thumbnail || (Array.isArray(hit?.images) ? hit.images[0] : "") || "";
    const link  = hit?.link || hit?.url || hit?.product_url || hit?.permalink || "";

    const safeName = esc(String(name));
    const safePrice = esc(String(price));
    const safeSku = esc(String(sku));
    const safeImg = esc(img || PLACEHOLDER_IMG);
    const safeLink = esc(link);

    return `
      <div class="qiq-line-item">
        <img class="qiq-line-img" src="${safeImg}" alt="${safeName}" onerror="this.src='${PLACEHOLDER_IMG}'" />
        <div class="qiq-line-content">
          <div class="qiq-line-name">${safeName}</div>
          ${safeSku ? `<div class="qiq-line-sku">${safeSku}</div>` : `<div class="qiq-line-sku">-</div>`}
          <div class="qiq-line-price">${safePrice || "عند الطلب"}</div>
        </div>
        <div class="qiq-line-actions">
          <button class="qiq-line-btn qiq-line-add" type="button"
            data-name="${safeName}"
            data-price="${safePrice}"
            data-sku="${safeSku}"
            data-image="${safeImg}"
            data-link="${safeLink}"
            data-source="Search"
            onclick="AddToQuote(this)">
            إضافة
          </button>
          ${safeLink ? `<button class="qiq-line-btn qiq-line-view" type="button"
            onclick="window.open('${safeLink}','_blank','noopener')">
            عرض
          </button>` : ""}
        </div>
      </div>
    `;
  }

  /* ---- تصنيف المنتجات حسب الفئة مع تحسينات ---- */
  function categorizeHits(hits) {
    const categories = new Map();
    
    hits.forEach(hit => {
      const name = (hit?.name || hit?.title || hit?.Description || "").toLowerCase();
      const description = (hit?.description || hit?.Description || "").toLowerCase();
      const fullText = (name + " " + description).toLowerCase();
      
      let category = "منتجات عامة"; // Default category
      
      // تصنيف محسن حسب كلمات مفتاحية
      if (fullText.includes("kaspersky") || fullText.includes("endpoint") || fullText.includes("edr") || 
          fullText.includes("antivirus") || fullText.includes("security") || fullText.includes("protection") ||
          fullText.includes("malware") || fullText.includes("threat") || fullText.includes("defend")) {
        category = "Category: Endpoint Security Solution";
      } else if (fullText.includes("cisco") || fullText.includes("network") || fullText.includes("switch") || 
                 fullText.includes("router") || fullText.includes("firewall") || fullText.includes("infrastructure")) {
        category = "Category: Network Infrastructure";
      } else if (fullText.includes("microsoft") || fullText.includes("office") || fullText.includes("windows") || 
                 fullText.includes("azure") || fullText.includes("cloud") || fullText.includes("365")) {
        category = "Category: Cloud & Productivity Solutions";
      } else if (fullText.includes("server") || fullText.includes("storage") || fullText.includes("backup") || 
                 fullText.includes("datacenter") || fullText.includes("dell") || fullText.includes("hp")) {
        category = "Category: Infrastructure & Storage";
      }
      
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category).push(hit);
    });
    
    return categories;
  }

  /* ---- تجميع مجموعة كروت مع عناوين الفئات (نمط خط مدمج) ---- */
  function renderHitsBlock(title, hits) {
    if (!hits || !hits.length) return "";
    
    const categories = categorizeHits(hits);
    let html = `<div class="qiq-section-title">${esc(title)}</div>`;
    
    categories.forEach((categoryHits, categoryName) => {
      html += `<div class="qiq-category-header">${esc(categoryName)}</div>`;
      html += `<div class="qiq-line-style">`;
      categoryHits.forEach(hit => {
        html += hitToLineItem(hit);
      });
      html += `</div>`;
    });
    
    return html;
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
