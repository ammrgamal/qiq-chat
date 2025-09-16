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

  // Sample product data for testing (when API is not available)
  const sampleProducts = [
    {
      name: "Kaspersky Endpoint Detection and Response",
      sku: "KES-EDR-120-2Y",
      price: "2500",
      image: "https://via.placeholder.com/68x68/0066cc/ffffff?text=KES",
      manufacturer: "Kaspersky",
      link: "#"
    },
    {
      name: "Microsoft Office 365 Business Premium",
      sku: "O365-BP-100U",
      price: "1200",
      image: "https://via.placeholder.com/68x68/ff6600/ffffff?text=O365",
      manufacturer: "Microsoft",
      link: "#"
    },
    {
      name: "VMware vSphere Standard",
      sku: "VMW-VS-STD",
      price: "5000",
      image: "https://via.placeholder.com/68x68/009900/ffffff?text=VMW",
      manufacturer: "VMware",
      link: "#"
    }
  ];

  /* ---- بناء كارت نتيجة واحدة ---- */
  function hitToCard(hit) {
    // محاولة استخراج أهم الحقول الشائعة
    const name  = hit?.name || hit?.title || hit?.Description || "(No name)";
    const price = hit?.price || hit?.Price || hit?.list_price || hit?.ListPrice || "";
    const sku   = hit?.sku || hit?.SKU || hit?.pn || hit?.PN || hit?.part_number || hit?.PartNumber || "";
    const img   = hit?.image || hit?.image_url || hit?.thumbnail || (Array.isArray(hit?.images) ? hit.images[0] : "") || "";
    const link  = hit?.link || hit?.url || hit?.product_url || hit?.permalink || "";
    const manufacturer = hit?.manufacturer || hit?.brand || hit?.vendor || hit?.company || "غير محدد";

    const safeName = esc(String(name));
    const safePrice = esc(String(price));
    const safeSku = esc(String(sku));
    const safeImg = esc(img || PLACEHOLDER_IMG);
    const safeLink = esc(link);
    const safeManufacturer = esc(String(manufacturer));

    return `
      <div class="qiq-inline-wrap" style="margin:10px 0">
        <table class="qiq-inline-table">
          <tbody>
            <tr>
              <td style="width:68px">
                <img class="qiq-inline-img" src="${safeImg}" alt="${safeName}" onerror="this.src='${PLACEHOLDER_IMG}'" />
              </td>
              <td>
                <div style="font-weight:700">${safeName}</div>
                ${safeSku ? `<div class="qiq-chip">PN/SKU: ${safeSku}</div>` : ""}
                ${safeManufacturer ? `<div class="qiq-chip" style="background:#f0f9ff;border-color:#0ea5e9">الشركة: ${safeManufacturer}</div>` : ""}
                ${safeLink ? `<div style="margin-top:4px"><a class="qiq-link" href="${safeLink}" target="_blank" rel="noopener">تفاصيل المنتج</a></div>` : ""}
              </td>
              <td style="width:140px">${safePrice ? safePrice + ' USD' : "-"}</td>
              <td style="width:220px">
                <div class="qiq-inline-actions" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                  <button class="qiq-mini primary" type="button"
                    data-name="${safeName}"
                    data-price="${safePrice}"
                    data-sku="${safeSku}"
                    data-pn="${safeSku}"
                    data-image="${safeImg}"
                    data-link="${safeLink}"
                    data-manufacturer="${safeManufacturer}"
                    data-source="Search"
                    onclick="AddToQuote(this)">
                    إضافة للسلة
                  </button>
                  <button class="qiq-mini" type="button"
                    onclick="window.open('${safeLink || '#'}','_blank','noopener')">
                    تفاصيل المنتج
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
    return `
      <div class="qiq-section-title">${esc(title)}</div>
      ${cards}
    `;
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
      // Return sample data when API is not available
      return sampleProducts.filter(product => 
        product.name.toLowerCase().includes(query.toLowerCase()) ||
        product.sku.toLowerCase().includes(query.toLowerCase()) ||
        product.manufacturer.toLowerCase().includes(query.toLowerCase())
      ).slice(0, hitsPerPage);
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
      // Return a helpful fallback response when API is not available
      const userMessage = messages[messages.length - 1]?.content || "";
      if (userMessage.toLowerCase().includes('kaspersky')) {
        return "ممتاز! لدينا حلول Kaspersky متنوعة. يمكنك الاطلاع على النتائج أدناه واختيار ما يناسبك.";
      } else if (userMessage.toLowerCase().includes('microsoft') || userMessage.toLowerCase().includes('office')) {
        return "لدينا مجموعة شاملة من منتجات Microsoft Office. راجع الخيارات المتاحة أدناه.";
      } else if (userMessage.toLowerCase().includes('vmware')) {
        return "حلول VMware للافتراضية متوفرة. تحقق من المنتجات أدناه.";
      } else {
        return "تم البحث عن منتجات مطابقة لاستفسارك. راجع النتائج أدناه.";
      }
    }
  }

  /* ---- دالة لعرض المنتجات مباشرة في الجدول ---- */
  function displayProductsInTable(hits, source = "Search") {
    hits.forEach(hit => {
      const productData = {
        name: hit?.name || hit?.title || hit?.Description || "(No name)",
        price: hit?.price || hit?.Price || hit?.list_price || hit?.ListPrice || "",
        sku: hit?.sku || hit?.SKU || hit?.pn || hit?.PN || hit?.part_number || hit?.PartNumber || "",
        pn: hit?.sku || hit?.SKU || hit?.pn || hit?.PN || hit?.part_number || hit?.PartNumber || "",
        image: hit?.image || hit?.image_url || hit?.thumbnail || (Array.isArray(hit?.images) ? hit.images[0] : "") || "",
        link: hit?.link || hit?.url || hit?.product_url || hit?.permalink || "",
        manufacturer: hit?.manufacturer || hit?.brand || hit?.vendor || hit?.company || "غير محدد",
        source: source
      };
      
      // استخدام دالة AddToQuote الموجودة
      if (window.AddToQuote && typeof window.AddToQuote === 'function') {
        window.AddToQuote(productData);
      }
    });
    
    // التمرير إلى الجدول
    const tableSection = document.getElementById("qiq-boq-wrap");
    if (tableSection) {
      tableSection.scrollIntoView({ behavior: "smooth", block: "start" });
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

    // 2) نتائج البحث (نفس النص) – نعرض في الجدول مباشرة
    const hits = await runSearch(userText, 6);
    if (hits.length) {
      // إضافة النتائج مباشرة إلى الجدول بدلاً من إظهارها في الشات
      displayProductsInTable(hits, "Matches & alternatives");
      // رسالة قصيرة في الشات
      addMsg("bot", `تم العثور على ${hits.length} نتيجة مطابقة. تحقق من الجدول أدناه.`);
    } else {
      addMsg("bot", "ملقيناش تطابق مباشر. حاول تكتب اسم المنتج/الموديل بدقة أكبر أو جرّب رفع BOQ.");
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
      displayProductsInTable(results, "Search results");
      addMsg("bot", `تم العثور على ${results.length} نتيجة بحث. تحقق من الجدول أدناه.`);
    } else {
      addMsg("bot", "لا توجد نتائج مطابقة.");
    }
  });
})();
