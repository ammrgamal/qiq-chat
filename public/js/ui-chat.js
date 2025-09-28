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
  const PLACEHOLDER_IMG = "data:image/svg+xml;utf8," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='100%' height='100%' fill='#f3f4f6'/><text x='50%' y='55%' dominant-baseline='middle' text-anchor='middle' fill='#9ca3af' font-size='28'>IMG</text></svg>");

  // ---- Arabic query cleaning helpers ----
  const normalizeArabic = (t='') => t
    .replace(/[\u064B-\u0652]/g,'') // diacritics
    .replace(/[إأآا]/g,'ا')
    .replace(/ى/g,'ي')
    .replace(/ؤ/g,'و')
    .replace(/ئ/g,'ي')
    .replace(/ة/g,'ه')
    .replace(/["'`،؟:؛!.,\/\\]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();

  const ARABIC_STOP = new Set([
    'عن','على','الى','إلى','من','في','مع','او','أو','ثم','لكن','قد','ما','ماذا','كم','كيف','لماذا','هل','لو','اذا','إن','ال','هذا','هذه','ذلك','تلك','هناك','هنا','اللي','الذي','التى','التي','نوع','ان','أن','الى','يكون','كنت','نفس','عندي','عندنا','عند','رجاء','سمحت','لوسمحت','ممكن','اريد','أريد','عايز','عاوزه','محتاج','ابغى','ابي','نبي','بس','بالسعر','السعر','افضل','أرخص','ارخص','مواصفات','بديل','بدائل','بديله','مقارنة','قارن','عرض','سعر','طلب','توريد','ترخيص','رخصه','الرخصه'
  ]);

  const BRAND_SYNONYMS = new Map([
    ['مايكروسوفت','microsoft'],['اوفيس','microsoft'],
    ['كاسبرسكي','kaspersky'],['كاسبر','kaspersky'],
    ['ڤي ام وير','vmware'],['في ام وير','vmware'],['في إم وير','vmware'],['في اموير','vmware'],
    ['تريند ميكرو','trend micro'],['ترند ميكرو','trend micro'],
    ['بيتدفندر','bitdefender'],
    ['فورتينت','fortinet'],['بالوالتو','palo alto'],['بالو التو','palo alto'],['بالو ألتو','palo alto'],
    ['سيسكو','cisco'],['اتش بي','hp'],['اتش بي اي','hpe'],['ديل','dell'],['لينوفو','lenovo']
  ]);

  const CATEGORY_SYNONYMS = new Map([
    ['جدار ناري','firewall'],['فايروول','firewall'],
    ['مكافحه فيروسات','antivirus'],['مكافحة فيروسات','antivirus'],['حمايه','security'],
    ['رخصه','license'],['ترخيص','license'],
    ['خادم','server'],['سيرفر','server'],
    ['تخزين','storage'],['نسخ احتياطي','backup'],
    ['افتراضيه','virtualization'],['افتراضية','virtualization']
  ]);

  const isPNToken = (tok) => /[a-zA-Z].*\d|\d.*[a-zA-Z]/.test(tok) || /\w+-\w+/.test(tok);

  function cleanSearchQuery(input){
    const original = String(input||'');
    const mappedBrands = Array.from(BRAND_SYNONYMS.entries())
      .reduce((txt,[ar,en])=>txt.replace(new RegExp(ar,'gi'), ' '+en+' '), original);
    const mapped = Array.from(CATEGORY_SYNONYMS.entries())
      .reduce((txt,[ar,en])=>txt.replace(new RegExp(ar,'gi'), ' '+en+' '), mappedBrands);
    const norm = normalizeArabic(mapped.toLowerCase());
    const parts = norm.split(/[^\p{L}\p{N}\-]+/u).filter(Boolean);
    const tokens = [];
    for (const p of parts){
      const t = p.trim();
      if (!t) continue;
      if (ARABIC_STOP.has(t)) continue;
      tokens.push(t);
    }
    const pn = tokens.filter(isPNToken);
    const brands = tokens.filter(t => /^(microsoft|kaspersky|vmware|trend|bitdefender|fortinet|cisco|hp|hpe|dell|lenovo|palo|alto)$/.test(t));
    const rest = tokens.filter(t => !pn.includes(t) && !brands.includes(t));
    const ordered = [...pn, ...brands, ...rest].slice(0,8);
    return ordered.join(' ').trim();
  }

  function buildFallbackQueries(input){
    const cleaned = cleanSearchQuery(input);
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    const pnOnly = tokens.filter(isPNToken).join(' ').trim();
    const brandOnly = tokens.filter(t=>/^(microsoft|kaspersky|vmware|trend|bitdefender|fortinet|cisco|hp|hpe|dell|lenovo|palo|alto)$/.test(t)).join(' ').trim();
    const restOnly = tokens.filter(t=>!isPNToken(t) && !/^(microsoft|kaspersky|vmware|trend|bitdefender|fortinet|cisco|hp|hpe|dell|lenovo|palo|alto)$/.test(t)).join(' ').trim();
    const tries = [];
    if (cleaned) tries.push(cleaned);
    if (pnOnly && pnOnly !== cleaned) tries.push(pnOnly);
    if (brandOnly) tries.push(brandOnly + (restOnly?(' '+restOnly):''));
    if (restOnly && !tries.includes(restOnly)) tries.push(restOnly);
    // End with original input as last resort
    const raw = String(input||'').trim();
    if (raw && !tries.includes(raw)) tries.push(raw);
    return tries.filter(q=>q && q.length>=2).slice(0,5);
  }

  // Initialize Smart Systems
  let chatStateManager = null;
  let smartRecommender = null;
  let isInitialized = false;
  let welcomeShown = false; // لمنع تكرار رسالة الترحيب

  function initSmartSystems() {
    if (!isInitialized && window.ChatStateManager && window.SmartBOQRecommender) {
      chatStateManager = new ChatStateManager();
      smartRecommender = new SmartBOQRecommender();
      isInitialized = true;
      console.log('🧠 Smart chat systems initialized');
    }
  }

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
    
    // إضافة للسجل إذا كان النظام الذكي متاحاً
    if (chatStateManager) {
      chatStateManager.addToLog(role, typeof html === 'string' ? html : bubble.textContent);
    }
    
    return bubble;
  }

  // رسالة ترحيب ذكية
  function showWelcomeMessage() {
    if (welcomeShown) return;
    welcomeShown = true;
    if (chatStateManager && chatStateManager.state.phase === 'initial' && chatStateManager.conversationLog.length === 0) {
      addMsg("bot", "أهلاً بك في QuickITQuote! 👋\n\nأنا مساعدك الذكي في المبيعات والاستشارات التقنية.\n\nيمكنك:\n• البحث عن منتج/موديل (مثل: Kaspersky EDR)\n• وصف احتياجك (مثل: حماية لـ100 مستخدم)\n• طلب مقارنة بين المنتجات\n\nجرب: 'عايز Kaspersky لـ50 مستخدم'");
    } else {
      addMsg("bot", "أهلاً بك في QuickITQuote 👋\nاكتب اسم المنتج/الموديل أو الشركة وسنقترح خيارات مناسبة.");
    }
  }

  // Sample product data for testing (when API is not available)
  const sampleProducts = [
    {
      name: "Kaspersky Endpoint Detection and Response",
      sku: "KES-EDR-120-2Y",
      price: "2500",
  image: PLACEHOLDER_IMG,
      manufacturer: "Kaspersky",
      link: "#"
    },
    {
      name: "Microsoft Office 365 Business Premium",
      sku: "O365-BP-100U",
      price: "1200",
  image: PLACEHOLDER_IMG,
      manufacturer: "Microsoft",
      link: "#"
    },
    {
      name: "VMware vSphere Standard",
      sku: "VMW-VS-STD",
      price: "5000",
  image: PLACEHOLDER_IMG,
      manufacturer: "VMware",
      link: "#"
    }
  ];

  // Clean path: no direct Algolia from chat UI; rely on backend /api/search

  /* ---- بناء كارت نتيجة واحدة ---- */
  function hitToCard(hit) {
    // محاولة استخراج أهم الحقول الشائعة
    const name  = hit?.name || "(No name)";
    const price = hit?.price || hit?.list_price || "";
  const pn    = hit?.pn || hit?.mpn || hit?.sku || hit?.objectID || "";
    const img   = hit?.image || hit?.image_url || hit?.thumbnail || (Array.isArray(hit?.images) ? hit.images[0] : "") || PLACEHOLDER_IMG;
  // Prefer our internal catalog page filtered by PN for details
  const linkTarget = (hit?.objectID || hit?.sku || hit?.pn || hit?.mpn) ? `/products-list.html?q=${encodeURIComponent(hit.objectID || hit.sku || hit.pn || hit.mpn)}` : (hit?.link || hit?.product_url || hit?.permalink || "");
  const brand = hit?.brand || hit?.manufacturer || hit?.vendor || hit?.company || "غير محدد";
  const spec  = hit?.spec_sheet || hit?.specsheet || hit?.datasheet || "";

    const safeName = esc(String(name));
    const safePrice = esc(String(price));
    const safePn = esc(String(pn));
    const safeImg = esc(img);
  const safeLink = esc(linkTarget);
    const safeBrand = esc(String(brand));

    return `
      <div class="qiq-result-card">
        <div class="qiq-result-image">
          <img src="${safeImg}" alt="${safeName}" onerror="this.src='${PLACEHOLDER_IMG}'" />
        </div>
        <div class="qiq-result-content">
          <div class="qiq-result-name">${safeName}</div>
          <div class="qiq-result-details">
            ${safePn ? `<span class="qiq-chip">PN: ${safePn}</span>` : ""}
            ${safeBrand ? `<span class="qiq-chip brand">الشركة: ${safeBrand}</span>` : ""}
          </div>
          <div class="qiq-result-price">${safePrice ? (window.QiqCurrency?window.QiqCurrency.format(Number(safePrice)): (safePrice + ' ' + (window.QiqSession?.currency||'USD'))) : "-"}</div>
          <div class="qiq-result-actions">
            <button class="qiq-btn primary" type="button"
              data-name="${safeName}"
              data-price="${safePrice}"
              data-pn="${safePn}"
              data-image="${safeImg}"
              data-link="${safeLink}"
              data-specsheet="${esc(spec)}"
              data-manufacturer="${safeBrand}"
              data-source="Search"
              onclick="AddToQuote(this)">
              إضافة للعرض
            </button>
            ${safeLink ? `<a class="qiq-btn secondary qiq-open-modal" href="${safeLink}" data-title="تفاصيل المنتج">تفاصيل المنتج</a>` : ""}
          </div>
        </div>
      </div>
    `;
  }

  /* ---- بناء صف نتيجة واحد (شكل جديد) ---- */
  function hitToRow(hit) {
    const name  = hit?.name || "(No name)";
    const price = hit?.price || hit?.list_price || "";
  const pn    = hit?.pn || hit?.mpn || hit?.sku || hit?.objectID || "";
    const img   = hit?.image || hit?.image_url || hit?.thumbnail || (Array.isArray(hit?.images) ? hit.images[0] : "") || PLACEHOLDER_IMG;
  const linkTarget2 = (hit?.objectID || hit?.sku || hit?.pn || hit?.mpn) ? `/products-list.html?q=${encodeURIComponent(hit.objectID || hit.sku || hit.pn || hit.mpn)}` : (hit?.link || hit?.product_url || hit?.permalink || "");
  const brand = hit?.brand || hit?.manufacturer || hit?.vendor || hit?.company || "غير محدد";
  const spec  = hit?.spec_sheet || hit?.specsheet || hit?.datasheet || "";

    const safeName = esc(String(name));
    const safePrice = esc(String(price));
    const safePn = esc(String(pn));
    const safeImg = esc(img);
  const safeLink = esc(linkTarget2);
    const safeBrand = esc(String(brand));

    return `
      <div class="qiq-result-row">
        <img src="${safeImg}" alt="${safeName}" class="qiq-result-row-img" onerror="this.src='${PLACEHOLDER_IMG}'" />
        <span class="qiq-result-row-name">${safeName}</span>
        <div class="qiq-result-row-details">
          ${safePn ? `<span class="qiq-chip">PN: ${safePn}</span>` : ""}
          ${safePrice ? `<span class="qiq-chip price">${window.QiqCurrency?window.QiqCurrency.format(Number(safePrice)):( (window.QiqSession?.currency||'USD')+' '+safePrice)}`+`</span>` : ""}
        </div>
        <div class="qiq-result-row-actions">
          <button class="qiq-btn primary" type="button"
            data-name="${safeName}"
            data-price="${safePrice}"
            data-pn="${safePn}"
            data-image="${safeImg}"
            data-link="${safeLink}"
            data-specsheet="${esc(spec)}"
            data-manufacturer="${safeBrand}"
            data-source="Search"
            onclick="AddToQuote(this)">
            إضافة
          </button>
        </div>
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
  try{ if(window.QiqToast?.info) window.QiqToast.info(`تم تنفيذ البحث: "${esc(query).slice(0,40)}"`);}catch{}
      return Array.isArray(json?.hits) ? json.hits : [];
    } catch (e) {
      console.warn("Search error:", e);
  try{ if(window.QiqToast?.error) window.QiqToast.error('تعذر تنفيذ البحث الآن. سيتم استخدام بيانات محلية للتجربة.');}catch{}
      // Return sample data when API is not available and fallback failed
      return sampleProducts.filter(product =>
        product.name.toLowerCase().includes(query.toLowerCase()) ||
        product.sku.toLowerCase().includes(query.toLowerCase()) ||
        product.manufacturer.toLowerCase().includes(query.toLowerCase())
      ).slice(0, hitsPerPage);
    }
  }
  // (Removed) any direct Algolia calls from chat UI.

  /* ---- استدعاء /api/chat: يرجع كائن { reply, hits? } ---- */
  async function runChat(messages) {
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages })
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      // Prefer JSON. If server sends text, normalize it.
      const contentType = r.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await r.json();
        const reply = typeof data?.reply === 'string' ? data.reply : '';
        const hits  = Array.isArray(data?.hits) ? data.hits : [];
        return { reply, hits };
      } else {
        const text = await r.text();
        return { reply: text || '', hits: [] };
      }
    } catch (e) {
      console.warn("Chat error:", e);
      try { if (window.QiqToast?.error) window.QiqToast.error('تعذر الوصول لخدمة الدردشة الآن. سيتم استخدام ردود سريعة لحين عودة الاتصال.'); } catch {}
      // Fallback: conversational response only (no auto-search)
      const userMessage = messages[messages.length - 1]?.content || "";
      let reply = "أحتاج تفاصيل أكثر عشان أساعدك بشكل دقيق. ما نوع الحل المطلوب وكم مستخدم؟";
      const t = userMessage.toLowerCase();
      if (t.includes('kaspersky')) reply = "هل تحتاج حماية Endpoint أم EDR؟ ما عدد الأجهزة ومدة الترخيص؟";
      else if (t.includes('microsoft') || t.includes('office')) reply = "للتراخيص: كم مستخدم واحتياج البريد/التخزين؟ اشتراك شهري أم سنوي؟";
      else if (t.includes('vmware')) reply = "كم سيرفر وفيه احتياج vCenter؟ عدد المعالجات/الأنوية والتراخيص المطلوبة؟";
      return { reply, hits: [] };
    }
  }

  /* ---- دالة لعرض المنتجات في منطقة منفصلة تحت الشات ---- */
  function displayProductsInTable(hits, source = "Search") {
    const productsList = document.getElementById("qiq-products-list");
    if (!productsList) return;

    if (hits && hits.length) {
      // عرض النتائج
      productsList.innerHTML = hits.map(hit => hitToRow(hit)).join('');
    } else {
      // رسالة في حالة عدم وجود نتائج
      productsList.innerHTML = "<div style='text-align:center;padding:20px;color:#6b7280'>لا توجد نتائج مطابقة.</div>";
    }
  }

  /* ---- المنطق: لو المستخدم كتب كلمة/منتج → نبحث ونظهر كروت بداخلها زر AddToQuote ---- */
  const messages = [
    {
      role: "system",
      content:
        "أنت QuickITQuote Smart Assistant. بالعربي + الإنجليزي: تحدث بطريقة محادثة طبيعية، اجمع بيانات العميل خطوة بخطوة، وقدم اقتراحات ذكية من الكتالوج. " +
        "تجنب تكرار نفس السؤال أو الرد. إذا سألت نفس السؤال مرتين، غير أسلوب الطلب أو أعطي خيارات مختلفة. " +
        "نوع أسلوبك في الكلام - استخدم أحياناً أسئلة مباشرة، وأحياناً اقتراحات، وأحياناً أمثلة عملية. " +
        "إذا لم تحصل على إجابة واضحة، اقترح البدائل أو اعرض الكتالوج مباشرة."
    }
  ];

  // دالة الرد الذكي
  async function generateSmartResponse(userText) {
    if (!isInitialized) {
      initSmartSystems();
    }

    if (chatStateManager && smartRecommender) {
      // تحليل مدخلات المستخدم
      const analysis = chatStateManager.analyzeUserInput(userText);
      const chatAnalysis = smartRecommender.analyzeChatIntent(userText, chatStateManager.state);
      
      console.log('🔍 User input analysis:', { analysis, chatAnalysis });
      
      // تحديد إذا كان نحتاج بحث في الكتالوج
      let shouldSearch = false;
      let searchQuery = '';
      
      if (chatAnalysis.confidence > 0.6 || analysis.intent === 'search') {
        shouldSearch = true;
        searchQuery = chatAnalysis.searchQueries.length > 0 ? 
          chatAnalysis.searchQueries[0] : 
          userText;
      }

      // إنشاء رد ذكي
      const smartReply = smartRecommender.generateSmartReply(chatAnalysis, chatStateManager.state);
      
      // تحديث حالة المحادثة
      if (smartReply.suggestedPhase && smartReply.suggestedPhase !== chatStateManager.state.phase) {
        chatStateManager.updateState({ phase: smartReply.suggestedPhase });
      }

      // إضافة الأسئلة المطروحة للسجل
      if (smartReply.followUpQuestions) {
        smartReply.followUpQuestions.forEach(q => {
          chatStateManager.addAskedQuestion(q);
        });
      }

      return {
        reply: smartReply.reply,
        shouldSearch,
        searchQuery,
        hits: [] // سيتم ملؤها بالبحث
      };
    }

    // Fallback للنظام القديم
    return {
      reply: "احكي لي أكثر عن احتياجك عشان أساعدك بأفضل شكل.",
      shouldSearch: /ابحث|search|عايز|أريد|need|want/.test(userText.toLowerCase()),
      searchQuery: userText,
      hits: []
    };
  }

  // إرسال الرسالة (سلوك حواري ذكي)
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userText = (input?.value || "").trim();
    if (!userText) return;

    input.value = "";
    addMsg("user", userText);

    // إضافة للسجل
    messages.push({ role: "user", content: userText });

    const thinking = addMsg("bot", "…");
    sendBtn && (sendBtn.disabled = true);
    
    try {
      // محاولة الرد الذكي أولاً
      const smartResponse = await generateSmartResponse(userText);
      
      let finalReply = smartResponse.reply;
      let hits = [];

      // إذا كان الرد الذكي يقترح البحث، نفذه باستخدام استعلامات منقّحة ومتعددة المحاولات
      if (smartResponse.shouldSearch) {
        const queries = buildFallbackQueries(smartResponse.searchQuery || userText);
        let usedQuery = '';
        for (const q of queries) {
          console.log('🔍 محاولة بحث:', q);
          const res = await runSearch(q, 8);
          if (Array.isArray(res) && res.length) { hits = res; usedQuery = q; break; }
        }
        // تحسين الرد بناءً على نتائج البحث
        if (hits.length > 0) {
          if (!/وجدت|found/.test(smartResponse.reply)) {
            finalReply += `\n\n✨ تم العثور على ${hits.length} منتج. (بحثنا عن: ${esc(usedQuery)})\nشاهد الاقتراحات في الجدول أدناه.`;
          }
          if (chatStateManager) {
            chatStateManager.state.recommendations = hits.slice(0, 3).map(h => ({ name: h.name, price: h.price, sku: h.sku }));
            chatStateManager.saveState();
          }
        } else {
          finalReply += "\n\nلم نجد نتائج مباشرة. جرّب كتابة PN/الموديل أو اسم الشركة بدقة أكبر.";
        }
      }

      // عرض الرد النهائي مع معالجة التكرار المحسنة
      if (finalReply && finalReply !== '…') {
        
        let finalOutput = finalReply;
        
        // استخدام نظام منع التكرار المتقدم
        if (window.antiRepetition) {
          const conversationHistory = chatStateManager ? chatStateManager.getConversationLog() : [];
          const analysis = window.antiRepetition.analyzeResponse(finalReply, conversationHistory);
          
          if (analysis.isRepeated || analysis.contextNeedsSwitch) {
            console.warn('⚠️ Anti-repetition triggered:', analysis);
            finalOutput = analysis.suggestedVariation || finalReply;
            
            // تسجيل التغيير
            window.antiRepetition.recordResponse(finalOutput);
            
            if (chatStateManager) {
              chatStateManager.addToConversationLog({
                type: 'bot',
                content: finalOutput,
                timestamp: Date.now(),
                wasAlternative: true,
                originalResponse: finalReply
              });
            }
          } else {
            window.antiRepetition.recordResponse(finalReply);
          }
        } 
        // النظام القديم كـ fallback
        else if (chatStateManager && chatStateManager.isRepeatedReply(finalReply)) {
          console.warn('⚠️ Fallback repetition detection');
          const alternatives = [
            "دعني أجرب طريقة أخرى. هل يمكنك توضيح احتياجاتك أكثر؟",
            "ماذا لو بدأنا من زاوية مختلفة؟ ما أهم شيء تبحث عنه؟",
            "يمكنني عرض الكتالوج مباشرة إذا كان ذلك مفيداً أكثر.",
            "دعني أقترح عليك حلول عملية بدلاً من الأسئلة."
          ];
          finalOutput = alternatives[Math.floor(Math.random() * alternatives.length)];
        }
        
        thinking.textContent = finalOutput;
      } else {
        thinking.remove();
      }

      // عرض نتائج البحث
      if (hits.length > 0) {
  displayProductsInTable(hits, "اقتراحات ذكية");
        try { 
          if (window.QiqToast?.success) 
            window.QiqToast.success(`✨ تم العثور على ${hits.length} اقتراح مناسب`);
        } catch {}
      }

      // محاولة Fallback مع الخادم إذا فشل الرد الذكي
      if (!finalReply || finalReply === '…') {
        console.log('🔄 Falling back to server chat');
        const resp = await runChat(messages);
        const showReply = (resp.reply || '').toString();
        
        if (showReply && showReply.length < 1200) {
          thinking.textContent = showReply;
        } else {
          thinking.remove();
        }

        // عرض نتائج الخادم
        if (Array.isArray(resp.hits) && resp.hits.length) {
          displayProductsInTable(resp.hits, "نتائج من الخادم");
          addMsg("bot", `تم العثور على ${resp.hits.length} نتيجة إضافية.`);
          try { 
            if (window.QiqToast?.success) 
              window.QiqToast.success(`عُثر على ${resp.hits.length} عناصر`);
          } catch {}
        }
      }
      
    } catch (error) {
      console.error('Chat error:', error);
      thinking.textContent = "عذراً، حدث خطأ. حاول مرة أخرى أو أعد صياغة سؤالك.";
      try { if (window.QiqToast?.error) window.QiqToast.error('حدث خطأ أثناء الإرسال. حاول مرة أخرى.'); } catch {}
    } finally {
      sendBtn && (sendBtn.disabled = false);
    }
  });

  // Fallback bindings: تأكيد الإرسال عند الضغط على Enter أو زر الإرسال
  // في بعض البيئات قد لا يعمل submit الافتراضي بسبب تداخل سكربتات أخرى.
  if (input) {
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        try { form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); } catch {}
      }
    });
  }
  if (sendBtn) {
    sendBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      try { form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); } catch {}
    });
  }

  /* ---- لو عندك زر مستقل للبحث عن المنتجات (اختياري) اربطه هنا ----
     مثال: زر id="qiq-search-btn" يقرأ من input ويعرض النتائج فقط
  */
  const searchBtn = document.getElementById("qiq-search-btn");
  searchBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    const q = (input?.value || "").trim();
    if (!q) return;
    addMsg("user", q);

    const queries = buildFallbackQueries(q);
    let results = [];
    let usedQuery = '';
    for (const s of queries){
      const r = await runSearch(s, 10);
      if (Array.isArray(r) && r.length){ results = r; usedQuery = s; break; }
    }
    if (results.length) {
      displayProductsInTable(results, "نتائج البحث");
      addMsg("bot", `تم العثور على ${results.length} نتيجة. بحثنا عن: ${esc(usedQuery || q)}.`);
  try{ if(window.QiqToast?.success) window.QiqToast.success(`نتائج: ${results.length}`);}catch{}
    } else {
  addMsg("bot", "لا توجد نتائج مطابقة حاليًا.");
  try{ if(window.QiqToast?.warning) window.QiqToast.warning('لا توجد نتائج');}catch{}
    }
  });

  // أزلنا الأزرار الداخلية واقتراحاتها للحفاظ على بساطة واجهة الشات

  // إضافة زر "إنشاء BOQ ذكي" إذا كان لدينا توصيات
  function addSmartBOQButton() {
    if (chatStateManager && chatStateManager.state.recommendations.length > 0) {
      const existingBtn = document.getElementById('smart-boq-btn');
      if (!existingBtn) {
        const btnHTML = `
          <div style="margin: 10px 0; text-align: center;">
            <button id="smart-boq-btn" class="qiq-btn qiq-primary" type="button" 
                    style="background: linear-gradient(135deg, #10b981, #059669); border: none; padding: 12px 24px; border-radius: 8px; color: white; font-weight: 600;">
              🚀 إنشاء BOQ ذكي من التوصيات
            </button>
          </div>
        `;
        
        const lastMsg = win.lastElementChild;
        if (lastMsg) {
          lastMsg.insertAdjacentHTML('afterend', btnHTML);
          
          document.getElementById('smart-boq-btn').addEventListener('click', async () => {
            await generateSmartBOQ();
          });
        }
      }
    }
  }

  // إنشاء BOQ ذكي من التوصيات
  async function generateSmartBOQ() {
    if (!chatStateManager || !smartRecommender) return;
    
    try {
      const boq = await smartRecommender.generatePreliminaryBOQ(
        chatStateManager.state.userNeeds,
        chatStateManager.state.recommendations
      );
      
      // إضافة العناصر للجدول
      if (window.AddMultipleToQuote && boq.items.length > 0) {
        boq.items.forEach(item => {
          if (item.source === 'catalog') {
            // إضافة المنتجات الحقيقية
            window.AddToQuote({
              dataset: {
                name: item.name,
                price: item.price.toString(),
                pn: item.sku,
                source: 'Smart BOQ'
              }
            });
          }
        });
        
        addMsg("bot", `✨ تم إنشاء BOQ ذكي بـ${boq.items.length} عنصر!\n\nالإجمالي التقريبي: ${boq.totalEstimate.toLocaleString()} ${window.QiqSession?.currency || 'EGP'}\n\n${boq.notes.join('\n')}`);
        
        try {
          if (window.QiqToast?.success) 
            window.QiqToast.success('تم إنشاء BOQ ذكي بنجاح!');
        } catch {}
      }
      
      // تحديث حالة المحادثة
      chatStateManager.updateState({ 
        phase: 'boq_ready',
        boqRequested: true 
      });
      
    } catch (error) {
      console.error('Smart BOQ generation error:', error);
      addMsg("bot", "عذراً، حدث خطأ في إنشاء BOQ. حاول إضافة المنتجات يدوياً.");
    }
  }

  // تحديث دالة عرض المنتجات لتتضمن زر BOQ الذكي
  const originalDisplayProducts = displayProductsInTable;
  displayProductsInTable = function(hits, source) {
    originalDisplayProducts(hits, source);
    
    // إضافة زر BOQ الذكي بعد عرض المنتجات
    setTimeout(() => {
      addSmartBOQButton();
    }, 100);
  };

  // Delegate: open any details link in modal if available
  document.addEventListener('click', function(ev){
    const a = ev.target.closest('a.qiq-open-modal');
    if (!a) return;
    ev.preventDefault();
    const url = a.getAttribute('href');
    const title = a.getAttribute('data-title') || '';
    try{
      if (window.QiqModal) QiqModal.open(url, {title});
      else window.open(url, '_blank', 'noopener');
    }catch{}
  });

  // تهيئة النظام الذكي عند تحميل الصفحة
  document.addEventListener('DOMContentLoaded', function() {
    // انتظار تحميل المكتبات
    let initAttempts = 0;
    const maxAttempts = 10;
    
    const tryInit = () => {
      initAttempts++;
      
      if (window.ChatStateManager && window.SmartBOQRecommender) {
        initSmartSystems();
        showWelcomeMessage();
        
        // إعادة تعيين الأنظمة إذا كانت المحادثة جديدة
        if (chatStateManager && chatStateManager.conversationLog.length === 0) {
          showWelcomeMessage();
        }
        
        console.log('✅ Smart chat system ready');
      } else if (initAttempts < maxAttempts) {
        setTimeout(tryInit, 500);
      } else {
        console.warn('⚠️ Smart systems not loaded, using basic mode');
        showWelcomeMessage();
      }
    };
    
    tryInit();
  });
})();
