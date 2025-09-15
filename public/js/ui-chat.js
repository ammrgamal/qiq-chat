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

    // توليد عنوان ذكي للمنتج
    const smartTitle = generateSmartTitle(name);
    
    // توليد صورة مناسبة للعنوان
    const titleImage = generateTitleImage(smartTitle);

    const safeName = esc(String(name));
    const safePrice = esc(String(price));
    const safeSku = esc(String(sku));
    const safeImg = esc(img || titleImage);
    const safeLink = esc(link);
    const safeSmartTitle = esc(smartTitle);

    return `
            <tr>
              <td style="width:76px">
                <img class="qiq-img" src="${safeImg}" alt="${safeName}" onerror="this.src='${titleImage}'" />
              </td>
              <td>
                <div style="font-weight:700">${safeName}</div>
                ${safeSku ? `<div class="qiq-chip">PN/SKU: ${safeSku}</div>` : ""}
                <div class="qiq-chip qiq-chip-category" style="background:#f0f9ff;border-color:#0ea5e9;color:#0c4a6e">Category: ${safeSmartTitle}</div>
                ${safeLink ? `<div style="margin-top:4px"><a class="qiq-link" href="${safeLink}" target="_blank" rel="noopener">Open product</a></div>` : ""}
              </td>
              <td style="width:120px">${safePrice ? "$" + safePrice : "-"}</td>
              <td style="width:140px">-</td>
              <td style="width:270px">
                <div class="qiq-actions-row">
                  <button class="qiq-btn qiq-mini qiq-primary" type="button"
                    data-name="${safeName}"
                    data-price="${safePrice}"
                    data-sku="${safeSku}"
                    data-image="${safeImg}"
                    data-link="${safeLink}"
                    data-source="Search"
                    data-smart-title="${safeSmartTitle}"
                    onclick="AddToQuote(this)">
                    Add
                  </button>
                  <button class="qiq-btn qiq-mini" type="button"
                    onclick="window.open('${safeLink || '#'}','_blank','noopener')">
                    Shop
                  </button>
                </div>
              </td>
            </tr>
    `;
  }

  /* ---- توليد عنوان ذكي للمنتج مع تحسينات ---- */
  function generateSmartTitle(productName) {
    const name = (productName || "").toLowerCase();
    
    // قاموس للمطابقات الذكية مرتب حسب الأولوية
    const categoryMap = {
      'kaspersky edr': 'Endpoint Detection & Response',
      'kaspersky endpoint': 'Endpoint Security Solution',
      'kaspersky': 'Endpoint Security Solution',
      'edr expert': 'Endpoint Detection & Response',
      'edr': 'Endpoint Detection & Response', 
      'endpoint security': 'Endpoint Security Solution',
      'endpoint detection': 'Endpoint Detection & Response',
      'endpoint protection': 'Endpoint Security Solution',
      'endpoint': 'Endpoint Security Solution',
      'antivirus': 'Antivirus Protection',
      'defender': 'Security Protection',
      'firewall': 'Network Security Firewall',
      'vpn': 'Virtual Private Network',
      'backup': 'Data Backup Solution',
      'office 365': 'Productivity Suite',
      'office': 'Productivity Suite',
      'windows server': 'Server Operating System',
      'windows': 'Operating System License',
      'adobe creative': 'Creative Software Suite',
      'adobe': 'Creative Software Suite',
      'vmware vsphere': 'Virtualization Platform',
      'vmware': 'Virtualization Platform',
      'cisco catalyst': 'Network Infrastructure',
      'cisco': 'Network Infrastructure',
      'microsoft 365': 'Productivity Suite',
      'microsoft': 'Enterprise Software',
      'server': 'Server Infrastructure',
      'storage': 'Data Storage Solution',
      'cloud': 'Cloud Computing Service',
      'security': 'Cybersecurity Solution',
      'license': 'Software License',
      'subscription': 'Software Subscription'
    };

    // البحث عن مطابقة في اسم المنتج (البحث عن المطابقات الأطول أولاً)
    const sortedKeys = Object.keys(categoryMap).sort((a, b) => b.length - a.length);
    for (const keyword of sortedKeys) {
      if (name.includes(keyword)) {
        return categoryMap[keyword];
      }
    }

    // عنوان افتراضي
    return 'IT Solution';
  }

  /* ---- توليد صورة نص بسيطة للعنوان مع تحسينات ---- */
  function generateTitleImage(title) {
    // استخدام أول حرفين من العنوان أو اختصار ذكي
    const words = title.split(' ');
    let initials = '';
    
    if (words.length >= 2) {
      initials = words[0].charAt(0) + words[1].charAt(0);
    } else if (words.length === 1) {
      const word = words[0];
      initials = word.length >= 2 ? word.substring(0, 2) : word.charAt(0);
    } else {
      initials = 'IT';
    }
    
    // اختيار ألوان مناسبة للفئة
    const colorMap = {
      'Security': { bg: '059669', text: 'ffffff' }, // أخضر للأمان
      'Endpoint': { bg: 'dc2626', text: 'ffffff' }, // أحمر للحماية
      'Network': { bg: '2563eb', text: 'ffffff' }, // أزرق للشبكات
      'Cloud': { bg: '7c3aed', text: 'ffffff' }, // بنفسجي للسحابة
      'Productivity': { bg: 'ea580c', text: 'ffffff' }, // برتقالي للإنتاجية
      'Virtualization': { bg: '0891b2', text: 'ffffff' }, // أزرق فاتح للافتراضية
      'Creative': { bg: 'e11d48', text: 'ffffff' }, // وردي للإبداع
      'Operating': { bg: '374151', text: 'ffffff' }, // رمادي لأنظمة التشغيل
    };
    
    // البحث عن لون مناسب بناء على العنوان
    let colors = { bg: '2563eb', text: 'ffffff' }; // افتراضي أزرق
    for (const [keyword, color] of Object.entries(colorMap)) {
      if (title.includes(keyword)) {
        colors = color;
        break;
      }
    }
    
    const encodedInitials = encodeURIComponent(initials.toUpperCase());
    return `https://via.placeholder.com/64x64/${colors.bg}/${colors.text}?text=${encodedInitials}`;
  }

  /* ---- تجميع مجموعة كروت ---- */
  function renderHitsBlock(title, hits) {
    if (!hits || !hits.length) return "";
    const rows = hits.map(hitToCard).join("");
    return `
      <div class="qiq-chat-table-wrap" style="margin:10px 0">
        <div class="qiq-section-title">${esc(title)}</div>
        <div class="qiq-table-wrap">
          <table class="qiq-table">
            <thead>
              <tr>
                <th style="width:76px">صورة</th>
                <th>الوصف / PN / SKU</th>
                <th style="width:120px">سعر الوحدة</th>
                <th style="width:140px">الإجمالي</th>
                <th style="width:270px">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
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
      // Return mock data for demonstration when API is not available
      return getMockSearchResults(query);
    }
  }

  /* ---- Mock data for demonstration ---- */
  function getMockSearchResults(query) {
    const mockData = [
      {
        name: "Kaspersky Endpoint Security for Business Select",
        price: "45.99",
        sku: "KL4863XAMTS",
        image: "",
        link: "https://www.kaspersky.com/business-security",
        description: "Advanced endpoint protection for business environments"
      },
      {
        name: "Kaspersky EDR Expert",
        price: "89.99", 
        sku: "KL4906XAMTS",
        image: "",
        link: "https://www.kaspersky.com/enterprise-security",
        description: "Expert-level endpoint detection and response"
      },
      {
        name: "Microsoft Defender for Business",
        price: "3.00",
        sku: "CFQ7TTC0LH16",
        image: "",
        link: "https://www.microsoft.com/security/business",
        description: "Microsoft endpoint security solution"
      }
    ];
    
    return mockData.filter(item => 
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      item.sku.toLowerCase().includes(query.toLowerCase())
    );
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
