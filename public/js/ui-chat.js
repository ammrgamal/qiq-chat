/* =========================
   QIQ – Chat + Product UI
   Uses /api/chat for conversations and /api/search for product search
   ========================= */

(() => {
  /* ---- DOM Elements ---- */
  const win = document.getElementById("qiq-window");
  const form = document.getElementById("qiq-form");
  const input = document.getElementById("qiq-input");
  const sendBtn = form?.querySelector(".qiq-send");

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
    const name  = hit?.name || "(No name)";
    const price = hit?.price || hit?.list_price || "";
    const pn    = hit?.objectID || hit?.sku || "";
    const img   = hit?.image || hit?.image_url || hit?.thumbnail || (Array.isArray(hit?.images) ? hit.images[0] : "") || PLACEHOLDER_IMG;
    const link  = hit?.link || hit?.product_url || hit?.permalink || "";
    const brand = hit?.brand || hit?.manufacturer || hit?.vendor || hit?.company || "غير محدد";

    const safeName = esc(String(name));
    const safePrice = esc(String(price));
    const safePn = esc(String(pn));
    const safeImg = esc(img);
    const safeLink = esc(link);
    const safeBrand = esc(String(brand));

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
                ${safePn ? `<div class="qiq-chip">PN: ${safePn}</div>` : ""}
                ${safeBrand ? `<div class="qiq-chip" style="background:#f0f9ff;border-color:#0ea5e9">الشركة: ${safeBrand}</div>` : ""}
                ${safeLink ? `<div style="margin-top:4px"><a class="qiq-link" href="${safeLink}" target="_blank" rel="noopener">تفاصيل المنتج</a></div>` : ""}
              </td>
              <td style="width:140px">${safePrice ? safePrice + ' USD' : "-"}</td>
              <td style="width:220px">
                <div class="qiq-inline-actions" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                  <button class="qiq-mini primary" type="button"
                    data-name="${safeName}"
                    data-price="${safePrice}"
                    data-pn="${safePn}"
                    data-image="${safeImg}"
                    data-link="${safeLink}"
                    data-manufacturer="${safeBrand}"
                    data-source="Search"
                    onclick="AddToQuote(this)">
                    إضافة للعرض
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
    // اعرض المنتجات في منطقة منفصلة تحت الشات
    const searchResultsDiv = document.getElementById("search-results");
    if (!searchResultsDiv) {
      // إنشاء div جديد لعرض النتائج إذا لم يكن موجوداً
      const resultsDiv = document.createElement("div");
      resultsDiv.id = "search-results";
      resultsDiv.className = "search-results-container";
      // إضافة div بعد منطقة الشات
      document.querySelector("#qiq-chat").after(resultsDiv);
    }
    // عرض النتائج
    document.getElementById("search-results").innerHTML = `
      <div class="results-title">المنتجات المقترحة</div>
      ${hits.map(hitToCard).join("")}
    `;
  }

  // تهيئة المتغيرات العامة
  const messages = [
    {
      role: "system",
      content:
        "أنت QuickITQuote Intake Bot. بالعربي + الإنجليزي: اجمع بيانات العميل خطوة بخطوة، واسأله إن كان يريد اقتراحات من الكتالوج. عندما يكتب اسم منتج أو موديل، سنعرض نتائج بحث أسفل رسالتك."
    }
  ];

  // إرسال الرسالة وتنفيذ البحث
  async function handleSearch(query, fromSearchButton = false) {
    const userText = query.trim();
    if (!userText) return;

    if (!fromSearchButton) {
      addMsg("user", userText);
      messages.push({ role: "user", content: userText });
    }

    // 1) رد الشات (فقط إذا لم يكن من زر البحث)
    if (!fromSearchButton) {
      const thinking = addMsg("bot", "جاري البحث...");
      sendBtn && (sendBtn.disabled = true);
      try {
        const reply = await runChat(messages);
        thinking.textContent = reply || "جاري عرض النتائج...";
      } catch (error) {
        console.error('Chat error:', error);
        thinking.textContent = "عذراً، حدث خطأ في النظام. لكن سأواصل البحث عن منتجات...";
      } finally {
        sendBtn && (sendBtn.disabled = false);
      }
    }

    // 2) البحث عن المنتجات باستخدام Algolia
    try {
      const searchResults = await productsIndex.search(userText, {
        hitsPerPage: 6,
        attributesToRetrieve: [
          'name', 'sku', 'mpn', 'brand', 
          'price', 'image', 'category',
          'availability', 'spec_sheet'
        ]
      });

      if (searchResults.hits.length) {
        displayProductsInTable(searchResults.hits);
        if (!fromSearchButton) {
          addMsg("bot", `تم العثور على ${searchResults.hits.length} نتيجة مطابقة. تحقق من النتائج أدناه.`);
        }
      } else {
        // إذا لم نجد نتائج في Algolia، نجرب البحث المحلي
        const localResults = await runSearch(userText, 6);
        if (localResults.length) {
          displayProductsInTable(localResults);
          if (!fromSearchButton) {
            addMsg("bot", `تم العثور على ${localResults.length} نتيجة مطابقة. تحقق من النتائج أدناه.`);
          }
        } else {
          if (!fromSearchButton) {
            addMsg("bot", "عذراً، لم نجد منتجات مطابقة لبحثك. حاول تعديل كلمات البحث أو استخدم أرقام القطع المحددة.");
          }
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      if (!fromSearchButton) {
        addMsg("bot", "عذراً، حدث خطأ في البحث. حاول مرة أخرى لاحقاً.");
      }
    }
  }

  // معالج النموذج
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userText = (input?.value || "").trim();
    if (!userText) return;
    
    input.value = ""; // مسح حقل الإدخال
    await handleSearch(userText, false);
  });
  });

  /* ---- معالجة زر البحث المستقل ---- */
  const searchBtn = document.getElementById("qiq-search-btn");
  searchBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    const q = (input?.value || "").trim();
    if (!q) return;
    
    searchBtn.disabled = true;
    try {
      await handleSearch(q, true);
    } finally {
      searchBtn.disabled = false;
    }
  });
})();
})();
