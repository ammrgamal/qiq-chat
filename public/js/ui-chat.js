/* =========================
   QIQ – Chat + Product UI
   (uses /api/chat and /api/search)
   ========================= */

/** Session Storage Integration
 *  - Products stored in sessionStorage under 'qiq_quote_items'
 *  - Format: array of {sku, name, price, image, link, qty, Description, _dup?}
 */

(() => {
  /* ---- DOM ---- */
  const win   = document.getElementById("qiq-window");          // مساحة الرسائل
  const form  = document.getElementById("qiq-form");             // فورم الإدخال
  const input = document.getElementById("qiq-input");            // حقل الإدخال
  const sendBtn = form?.querySelector(".qiq-send");              // زر الإرسال (لو موجود)
  const addAllBtn = document.getElementById("qiq-add-all-to-quotation"); // زر Add all to quotation

  /* ---- Session Storage Management ---- */
  const STORAGE_KEY = 'qiq_quote_items';

  function getStoredItems() {
    try {
      const items = sessionStorage.getItem(STORAGE_KEY);
      return items ? JSON.parse(items) : [];
    } catch (e) {
      console.warn('Error reading stored items:', e);
      return [];
    }
  }

  function storeItems(items) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Error storing items:', e);
    }
  }

  function findItemBySku(sku) {
    const items = getStoredItems();
    return items.find(item => item.sku === sku);
  }

  function addItemToStorage(itemData, asDuplicate = false) {
    const items = getStoredItems();
    const newItem = {
      sku: itemData.sku || '',
      name: itemData.name || '',
      price: itemData.price || '',
      image: itemData.image || '',
      link: itemData.link || '',
      qty: 1,
      Description: itemData.Description || itemData.description || ''
    };
    
    if (asDuplicate) {
      newItem._dup = true;
    }
    
    items.push(newItem);
    storeItems(items);
  }

  function increaseItemQuantity(sku) {
    const items = getStoredItems();
    const item = items.find(item => item.sku === sku);
    if (item) {
      item.qty = (item.qty || 1) + 1;
      storeItems(items);
    }
  }

  /* ---- Modal Management ---- */
  function showDuplicateModal(itemData) {
    return new Promise((resolve) => {
      const modal = document.getElementById('qiq-duplicate-modal');
      const increaseBtn = document.getElementById('qiq-increase-qty');
      const duplicateBtn = document.getElementById('qiq-add-duplicate');
      const cancelBtn = document.getElementById('qiq-cancel-duplicate');
      
      if (!modal) {
        resolve('cancel');
        return;
      }

      const handleChoice = (choice) => {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        resolve(choice);
      };

      increaseBtn.onclick = () => handleChoice('increase');
      duplicateBtn.onclick = () => handleChoice('duplicate');
      cancelBtn.onclick = () => handleChoice('cancel');
      
      // Close on backdrop click
      modal.querySelector('.qiq-modal__backdrop').onclick = () => handleChoice('cancel');

      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
    });
  }

  /* ---- Helpers ---- */
  const esc = s => (s ?? "").toString().replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c] || c));
  const PLACEHOLDER_IMG = "https://via.placeholder.com/40x40?text=IMG";

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

  /* ---- بناء كارت نتيجة واحدة (Compact Row Format) ---- */
  function hitToCompactRow(hit) {
    // محاولة استخراج أهم الحقول الشائعة
    const name  = hit?.name || hit?.title || hit?.Description || "(No name)";
    const price = hit?.price || hit?.Price || hit?.list_price || hit?.ListPrice || "";
    const sku   = hit?.sku || hit?.SKU || hit?.pn || hit?.PN || hit?.part_number || hit?.PartNumber || "";
    const img   = hit?.image || hit?.image_url || hit?.thumbnail || (Array.isArray(hit?.images) ? hit.images[0] : "") || "";
    const link  = hit?.link || hit?.url || hit?.product_url || hit?.permalink || "";
    const description = hit?.description || hit?.Description || hit?.short_description || "";

    const safeName = esc(String(name));
    const safePrice = esc(String(price));
    const safeSku = esc(String(sku));
    const safeImg = esc(img || PLACEHOLDER_IMG);
    const safeLink = esc(link);
    const safeDescription = esc(String(description).substring(0, 90));

    return `
      <div class="qiq-compact-row" data-sku="${safeSku}">
        <img class="qiq-compact-img" src="${safeImg}" alt="${safeName}" onerror="this.src='${PLACEHOLDER_IMG}'" />
        <div class="qiq-compact-name" title="${safeName}">${safeName}</div>
        <div class="qiq-compact-details">
          ${safeSku ? `<span class="qiq-compact-sku">PN/SKU: ${safeSku}</span>` : ""}
          <span class="qiq-compact-price">${safePrice || "-"}</span>
          ${safeDescription ? `<span class="qiq-compact-desc" title="${esc(description)}">${safeDescription}${description.length > 90 ? '...' : ''}</span>` : ""}
        </div>
        <div class="qiq-compact-actions">
          <button class="qiq-compact-btn" type="button" onclick="window.open('${safeLink || '#'}','_blank','noopener')">Shop</button>
          <a href="/quote.html" target="_blank" class="qiq-compact-btn">Add quotation</a>
          <button class="qiq-compact-btn primary" type="button" onclick="handleAddToQuote(this)"
            data-name="${safeName}"
            data-price="${safePrice}"
            data-sku="${safeSku}"
            data-image="${safeImg}"
            data-link="${safeLink}"
            data-description="${esc(description)}">
            Add
          </button>
        </div>
      </div>
    `;
  }

  /* ---- تجميع مجموعة كروت ---- */
  function renderHitsBlock(title, hits) {
    if (!hits || !hits.length) return "";
    // Limit to maximum 5 results
    const limitedHits = hits.slice(0, 5);
    const cards = limitedHits.map(hitToCompactRow).join("");
    return `
      <div class="qiq-section-title">${esc(title)}</div>
      ${cards}
    `;
  }

  /* ---- Handle Add to Quote ---- */
  window.handleAddToQuote = async function(button) {
    const itemData = {
      name: button.getAttribute('data-name') || '',
      price: button.getAttribute('data-price') || '',
      sku: button.getAttribute('data-sku') || '',
      image: button.getAttribute('data-image') || '',
      link: button.getAttribute('data-link') || '',
      description: button.getAttribute('data-description') || ''
    };

    if (!itemData.sku) {
      alert('No SKU found for this item');
      return;
    }

    const existingItem = findItemBySku(itemData.sku);
    
    if (existingItem) {
      const choice = await showDuplicateModal(itemData);
      
      switch (choice) {
        case 'increase':
          increaseItemQuantity(itemData.sku);
          alert('Quantity increased for existing item');
          break;
        case 'duplicate':
          addItemToStorage(itemData, true);
          alert('Item added as duplicate');
          break;
        case 'cancel':
        default:
          return;
      }
    } else {
      addItemToStorage(itemData);
      alert('Item added to quotation');
    }
  };

  /* ---- Add All to Quotation ---- */
  function handleAddAllToQuotation() {
    const compactRows = document.querySelectorAll('.qiq-compact-row');
    let addedCount = 0;
    
    compactRows.forEach(row => {
      const sku = row.getAttribute('data-sku');
      if (!sku || findItemBySku(sku)) {
        return; // Skip if no SKU or already exists
      }
      
      const addBtn = row.querySelector('button[data-sku]');
      if (addBtn) {
        const itemData = {
          name: addBtn.getAttribute('data-name') || '',
          price: addBtn.getAttribute('data-price') || '',
          sku: addBtn.getAttribute('data-sku') || '',
          image: addBtn.getAttribute('data-image') || '',
          link: addBtn.getAttribute('data-link') || '',
          description: addBtn.getAttribute('data-description') || ''
        };
        addItemToStorage(itemData);
        addedCount++;
      }
    });
    
    if (addedCount > 0) {
      alert(`Added ${addedCount} items to quotation`);
      // Redirect to quote.html
      window.location.href = '/quote.html';
    } else {
      alert('No new items to add');
    }
  }

  // Attach event listener to Add All button
  if (addAllBtn) {
    addAllBtn.addEventListener('click', handleAddAllToQuotation);
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
      // Return test products (Mock Data) when API is not available
      return getMockProducts(query, hitsPerPage);
    }
  }

  /* ---- Mock Products for Testing ---- */
  function getMockProducts(query, limit = 5) {
    const mockProducts = [
      {
        name: "Kaspersky Security for Business",
        price: "$29.99",
        sku: "KL4054IAYRS",
        image: "https://via.placeholder.com/40x40/007acc/fff?text=KS",
        link: "https://example.com/kaspersky-security",
        description: "Advanced security solution with endpoint protection and response capabilities for business environments. Includes threat detection, prevention, and investigation tools."
      },
      {
        name: "Norton 365 Business Premium", 
        price: "$22.00",
        sku: "CFQTTCCDK70R",
        image: "https://via.placeholder.com/40x40/ff6b00/fff?text=N365",
        link: "https://example.com/norton-365",
        description: "Comprehensive business security suite with cloud-based management, advanced threat protection, and centralized administration for small to medium enterprises."
      },
      {
        name: "VMware vSphere Essentials",
        price: "$875.00", 
        sku: "VS7-ESTD-G-SSS-C",
        image: "https://via.placeholder.com/40x40/00B4A6/fff?text=VS",
        link: "https://example.com/vsphere-essentials",
        description: "Virtualization platform that enables businesses to create and manage virtual machines with centralized management and high availability features."
      },
      {
        name: "Microsoft Office 365 Business Standard",
        price: "$12.50",
        sku: "CFQ7TTC0LH18",
        image: "https://via.placeholder.com/40x40/0078d4/fff?text=O365",
        link: "https://example.com/office-365",
        description: "Cloud-based productivity suite including Word, Excel, PowerPoint, Outlook, Teams, and OneDrive with 1TB storage per user for business collaboration."
      },
      {
        name: "Adobe Creative Cloud Business",
        price: "$52.99",
        sku: "65270749BA01A12",
        image: "https://via.placeholder.com/40x40/ff0000/fff?text=CC",
        link: "https://example.com/adobe-cc",
        description: "Complete creative software package with Photoshop, Illustrator, InDesign, Premiere Pro, and more. Includes cloud storage and collaboration tools."
      }
    ];

    // Filter based on query if provided
    let filteredProducts = mockProducts;
    if (query && query.trim()) {
      const searchTerm = query.toLowerCase();
      filteredProducts = mockProducts.filter(product => 
        product.name.toLowerCase().includes(searchTerm) ||
        product.description.toLowerCase().includes(searchTerm) ||
        product.sku.toLowerCase().includes(searchTerm)
      );
    }

    return filteredProducts.slice(0, limit);
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
      // Provide a simple fallback response when API is not available
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.content) {
        return `شكرًا لك على استفسارك: "${lastMessage.content}". سأبحث عن المنتجات المناسبة لك.`;
      }
      return "أهلاً بك! كيف يمكنني مساعدتك اليوم؟";
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
    const hits = await runSearch(userText, 5); // Limited to 5 results
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

    const results = await runSearch(q, 5); // Limited to 5 results
    if (results.length) {
      const html = renderHitsBlock("Search results", results);
      addMsg("bot", html, true);
    } else {
      addMsg("bot", "لا توجد نتائج مطابقة.", true);
    }
  });

  /* ---- Test Products Button ---- */
  const testBtn = document.getElementById("qiq-test-products");
  testBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    addMsg("user", "Test Products (Mock Data)");

    const results = await runSearch("", 5); // Get all mock products
    if (results.length) {
      const html = renderHitsBlock("Test Products (Mock Data)", results);
      addMsg("bot", html, true);
    } else {
      addMsg("bot", "لا توجد منتجات تجريبية.", true);
    }
  });
})();
