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

    const tr = document.createElement("tr");
    tr.dataset.unit = price || "";
    tr.dataset.key  = key;
    tr.setAttribute("data-key", key);

    tr.innerHTML = `
      <td><img class="qiq-img" src="${img}" alt="${name}" onerror="this.src='https://via.placeholder.com/68?text=IMG'"></td>
      <td>
        ${link?`<a class="qiq-link" target="_blank" rel="noopener" href="${link}"><strong>${name}</strong></a>`:`<strong>${name}</strong>`}
        ${pn? `<div class="qiq-chip">PN/SKU: ${pn}</div>` : ""}
        <div class="qiq-chip" style="background:#f5f5f5;border-color:#e5e7eb">Source: ${source}</div>
      </td>
      <td><input type="number" min="1" step="1" value="1" class="qiq-qty"></td>
      <td>${price? fmtUSD(price) : "-"}</td>
      <td class="qiq-line">${unitNum? fmtUSD(unitNum*1) : "-"}</td>
      <td>
        <div class="qiq-actions-row">
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
    return {
      name  : el.getAttribute("data-name")  || "",
      price : el.getAttribute("data-price") || "",
      sku   : el.getAttribute("data-sku")   || "",
      pn    : el.getAttribute("data-pn")    || "",
      image : el.getAttribute("data-image") || "",
      link  : el.getAttribute("data-link")  || "",
      source: el.getAttribute("data-source")|| "Add"
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

  /* ========= Export Functionality ========= */
  function exportToCSV() {
    const rows = [...(tbody?.querySelectorAll("tr") || [])];
    if (!rows.length) {
      alert("No data to export");
      return;
    }

    const headers = ["Item", "Description", "PN/SKU", "Qty", "Unit Price", "Line Total"];
    let csvContent = headers.join(",") + "\n";

    rows.forEach((tr, index) => {
      const img = tr.querySelector(".qiq-img")?.alt || "";
      const name = tr.querySelector("strong")?.textContent || "";
      const pnElement = tr.querySelector(".qiq-chip");
      const pn = pnElement ? pnElement.textContent.replace("PN/SKU: ", "") : "";
      const qty = tr.querySelector(".qiq-qty")?.value || "1";
      const unitPrice = tr.dataset.unit || "";
      const lineTotal = tr.querySelector(".qiq-line")?.textContent || "";
      
      const row = [
        `"${index + 1}"`,
        `"${name.replace(/"/g, '""')}"`,
        `"${pn.replace(/"/g, '""')}"`,
        qty,
        `"${unitPrice}"`,
        `"${lineTotal}"`
      ];
      csvContent += row.join(",") + "\n";
    });

    // Add grand total
    const grandTotal = document.getElementById("qiq-grand")?.textContent || "-";
    csvContent += `,,,,Grand Total,"${grandTotal}"\n`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `quote_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  function exportToXLSX() {
    const rows = [...(tbody?.querySelectorAll("tr") || [])];
    if (!rows.length) {
      alert("No data to export");
      return;
    }

    if (typeof XLSX === 'undefined') {
      alert("XLSX library not loaded. Please refresh the page.");
      return;
    }

    const headers = ["Item", "Description", "PN/SKU", "Qty", "Unit Price", "Line Total"];
    const data = [headers];

    rows.forEach((tr, index) => {
      const img = tr.querySelector(".qiq-img")?.alt || "";
      const name = tr.querySelector("strong")?.textContent || "";
      const pnElement = tr.querySelector(".qiq-chip");
      const pn = pnElement ? pnElement.textContent.replace("PN/SKU: ", "") : "";
      const qty = parseInt(tr.querySelector(".qiq-qty")?.value || "1");
      const unitPrice = tr.dataset.unit || "";
      const lineTotal = tr.querySelector(".qiq-line")?.textContent || "";
      
      data.push([
        index + 1,
        name,
        pn,
        qty,
        unitPrice,
        lineTotal
      ]);
    });

    // Add empty row and grand total
    const grandTotal = document.getElementById("qiq-grand")?.textContent || "-";
    data.push([]);
    data.push(["", "", "", "", "Grand Total", grandTotal]);

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Quote");
    XLSX.writeFile(wb, `quote_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  /* ========= Add All Matched Functionality ========= */
  function addAllMatched() {
    const searchResults = document.querySelectorAll('.qiq-inline-actions button[onclick*="AddToQuote"]');
    let addedCount = 0;
    
    searchResults.forEach(btn => {
      if (!btn.disabled) {
        try {
          // Simulate clicking the Add button
          AddToQuote(btn);
          addedCount++;
        } catch (e) {
          console.warn("Error adding item:", e);
        }
      }
    });

    if (addedCount > 0) {
      alert(`تمت إضافة ${addedCount} عنصر إلى عرض السعر`);
    } else {
      alert("لا توجد عناصر جديدة لإضافتها");
    }
  }

  /* ========= Event Listeners ========= */
  // Export CSV
  document.getElementById("qiq-export-csv")?.addEventListener("click", exportToCSV);
  
  // Export XLSX
  document.getElementById("qiq-export-xlsx")?.addEventListener("click", exportToXLSX);
  
  // Add all matched
  document.getElementById("qiq-add-all")?.addEventListener("click", addAllMatched);

  /* ========= Add Placeholder Data for Demo ========= */
  function addPlaceholderData() {
    const sampleItems = [
      {
        name: "Kaspersky Endpoint Security",
        price: "$45.99",
        sku: "KES-2024-50U",
        image: "https://via.placeholder.com/68?text=KES",
        link: "#",
        source: "Sample"
      },
      {
        name: "Microsoft Office 365 Business",
        price: "$12.50",
        sku: "O365-BIZ-1Y",
        image: "https://via.placeholder.com/68?text=O365",
        link: "#",
        source: "Sample"
      }
    ];

    sampleItems.forEach(item => buildRow(item));
  }

  // Add placeholder data if table is empty and it's been 2 seconds since page load
  setTimeout(() => {
    if (!tbody?.children?.length) {
      addPlaceholderData();
    }
  }, 2000);
})();
