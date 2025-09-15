/* ========= Helpers ========= */
(function () {
  const tbody     = document.getElementById("qiq-body");     // جدول البنود
  const grandCell = document.getElementById("qiq-grand");    // الإجمالي
  const addAllBtn = document.getElementById("qiq-add-all");  // زرار Add all matched (لو موجود)

  // تنسيقات الأسعار
  function fmtUSD(v){
    const n = Number(String(v||"").replace(/[^\d.]/g,""));
    if(!isFinite(n)) return "-";
    try { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n); }
    catch { return `$${n.toFixed(2)}`; }
  }
  function numFromPrice(v){
    return Number(String(v||"").replace(/[^\d.]/g,"")) || 0;
  }

  // توليد عنوان ذكي للمنتج مع تحسينات
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

  // توليد صورة نص بسيطة للعنوان مع تحسينات
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

  // إعادة حساب الإجمالي وحالة زرار Add all
  function recalcTotals(){
    let grand = 0;
    [...(tbody?.querySelectorAll("tr")||[])].forEach(tr=>{
      const unit = numFromPrice(tr.dataset.unit||"");
      const qty  = Math.max(1, parseInt(tr.querySelector(".qiq-qty")?.value||"1",10));
      const line = unit * qty;
      const cell = tr.querySelector(".qiq-line");
      if(cell) cell.textContent = unit? fmtUSD(line) : "-";
      grand += line;
    });
    if(grandCell) grandCell.textContent = grand ? fmtUSD(grand) : "-";
    if(addAllBtn){
      const addables = tbody?.querySelectorAll('button[data-sku]:not(:disabled)')?.length || 0;
      addAllBtn.disabled = addables === 0;
    }
  }

  // يبني صف في جدول الكوت
  function buildRow(data){
    if(!tbody) return;

    const sku     = (data.sku || data.pn || "").toString().trim();
    const key     = sku ? sku.toUpperCase() : (data.name||"").toUpperCase();
    if(!key) return;

    // منع التكرار بنفس الـ SKU
    if(tbody.querySelector(`tr[data-key="${CSS.escape(key)}"]`)) return;

    const name    = data.name  || "—";
    const price   = data.price || "";
    const unitNum = numFromPrice(price);
    const img     = data.image || "https://via.placeholder.com/68?text=IMG";
    const link    = data.link  || "";
    const source  = data.source|| "Add";
    const pn      = data.pn    || data.sku || "";

    // توليد عنوان ذكي وصورة مناسبة 
    const smartTitle = data.smartTitle || generateSmartTitle(name);
    const titleImage = generateTitleImage(smartTitle);

    const tr = document.createElement("tr");
    tr.dataset.unit = price || "";
    tr.dataset.key  = key;
    tr.setAttribute("data-key", key);

    tr.innerHTML = `
      <td><img class="qiq-img" src="${img}" alt="${name}" onerror="this.src='${titleImage}'"></td>
      <td>
        ${link?`<a class="qiq-link" target="_blank" rel="noopener" href="${link}"><strong>${name}</strong></a>`:`<strong>${name}</strong>`}
        ${pn? `<div class="qiq-chip">PN/SKU: ${pn}</div>` : ""}
        <div class="qiq-chip qiq-chip-category" style="background:#f0f9ff;border-color:#0ea5e9;color:#0c4a6e">Category: ${smartTitle}</div>
        <div class="qiq-chip" style="background:#f5f5f5;border-color:#e5e7eb">Source: ${source}</div>
      </td>
      <td>${price? fmtUSD(price) : "-"}</td>
      <td class="qiq-line">${unitNum? fmtUSD(unitNum*1) : "-"}</td>
      <td>
        <div class="qiq-actions-row">
          <input type="number" min="1" step="1" value="1" class="qiq-qty">
          <button class="qiq-btn" type="button" data-detail-sku="${sku}">Product details</button>
          <button class="qiq-btn qiq-primary" type="button" data-sku="${sku}" data-slug="">Add to quotation</button>
        </div>
      </td>
    `;

    tr.querySelector(".qiq-qty").addEventListener("input", recalcTotals);

    // فتح التفاصيل (لو حابب تستخدم نفس الـ endpoint اللي عندك، سيبه/عدّله لاحقًا)
    tr.querySelector('[data-detail-sku]').addEventListener('click', (ev)=>{
      ev.preventDefault();
      try{
        const url = link || `/shop/?s=${encodeURIComponent(sku)}&post_type=product`;
        window.open(url, "_blank", "noopener");
      }catch{}
    });

    // Add to quotation (Woo/Cart) — Stub: عدّل النداء حسب API عربيتك لو موجود
    tr.querySelector('[data-sku]').addEventListener('click', async (ev)=>{
      ev.preventDefault();
      const btn = ev.currentTarget;
      const qty = Math.max(1, parseInt(tr.querySelector('.qiq-qty')?.value||"1",10));
      btn.disabled = true;
      const old = btn.textContent;
      btn.textContent = "Adding…";
      try {
        // TODO: اربط هنا مع /wp-json/qiq/v1/cart/add لو عندك الباك اند
        await new Promise(r=>setTimeout(r,400)); // محاكاة نجاح
        btn.textContent = "Added ✓";
      } catch {
        btn.textContent = "Error";
      } finally {
        setTimeout(()=>{ btn.textContent = old; btn.disabled = false; }, 900);
      }
    });

    tbody.appendChild(tr);
    recalcTotals();
  }

  // تجهّز الداتا من زرار عليه data-*
  function dataFromElement(el){
    const smartTitle = el.getAttribute("data-smart-title") || generateSmartTitle(el.getAttribute("data-name") || "");
    return {
      name  : el.getAttribute("data-name")  || "",
      price : el.getAttribute("data-price") || "",
      sku   : el.getAttribute("data-sku")   || "",
      pn    : el.getAttribute("data-pn")    || "",
      image : el.getAttribute("data-image") || "",
      link  : el.getAttribute("data-link")  || "",
      source: el.getAttribute("data-source")|| "Add",
      smartTitle: smartTitle
    };
  }

  /* ========= API عامّة =========
     — تقدر تنادي AddToQuote بطريقتين:
       1) AddToQuote({name, price, sku, pn, image, link, source})
       2) AddToQuote(this) لو الزرار عليه data-*
  ================================= */
  window.AddToQuote = function (arg){
    try{
      if(!tbody){ alert("Table not found (qiq-body)"); return; }
      let payload = null;

      if (arg && typeof arg === "object" && !(arg instanceof Element)) {
        payload = arg;
      } else if (arg instanceof Element) {
        payload = dataFromElement(arg);
      } else {
        alert("Invalid AddToQuote call.");
        return;
      }

      buildRow(payload);
      // تمرير تلقائي إلى جدول البنود بعد الإضافة
      if (tbody) {
        tbody.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      // مِسچ بسيط
      // eslint-disable-next-line no-alert
      alert("تمت إضافة البند إلى عرض السعر.");
    }catch(e){
      // eslint-disable-next-line no-alert
      alert("حدث خطأ أثناء إضافة العنصر.");
      console.warn(e);
    }
  };
})();
