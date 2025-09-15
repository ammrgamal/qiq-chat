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

  /* ========= Export Functions ========= */
  
  // Export to CSV
  function exportToCSV() {
    if (!tbody) {
      alert("لا توجد بيانات للتصدير");
      return;
    }
    
    const rows = [...tbody.querySelectorAll("tr")];
    if (rows.length === 0) {
      alert("لا توجد بنود في الجدول للتصدير");
      return;
    }
    
    // CSV headers
    const headers = ["الوصف", "PN/SKU", "سعر الوحدة", "الكمية", "الإجمالي"];
    let csvContent = headers.join(",") + "\n";
    
    // Add data rows
    rows.forEach(row => {
      const name = row.querySelector("strong")?.textContent || "";
      const pnElement = row.querySelector(".qiq-chip");
      const pn = pnElement ? pnElement.textContent.replace("PN/SKU: ", "") : "";
      const unitPrice = row.dataset.unit || "";
      const qty = row.querySelector(".qiq-qty")?.value || "1";
      const lineTotal = row.querySelector(".qiq-line")?.textContent || "";
      
      // Escape commas and quotes in CSV
      const escapeCsv = (str) => {
        str = str.toString().replace(/"/g, '""');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          str = `"${str}"`;
        }
        return str;
      };
      
      const rowData = [
        escapeCsv(name),
        escapeCsv(pn),
        escapeCsv(unitPrice),
        escapeCsv(qty),
        escapeCsv(lineTotal)
      ];
      
      csvContent += rowData.join(",") + "\n";
    });
    
    // Add grand total
    const grandTotal = grandCell?.textContent || "-";
    csvContent += `"الإجمالي الكلي","","","","${grandTotal}"\n`;
    
    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `qiq-quote-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  
  // Export to XLSX
  function exportToXLSX() {
    if (!tbody) {
      alert("لا توجد بيانات للتصدير");
      return;
    }
    
    const rows = [...tbody.querySelectorAll("tr")];
    if (rows.length === 0) {
      alert("لا توجد بنود في الجدول للتصدير");
      return;
    }
    
    // Check if XLSX library is available
    if (typeof XLSX === 'undefined') {
      alert("مكتبة XLSX غير متوفرة. تأكد من تحميلها.");
      return;
    }
    
    // Prepare data for XLSX
    const data = [];
    
    // Headers
    data.push(["الوصف", "PN/SKU", "سعر الوحدة", "الكمية", "الإجمالي"]);
    
    // Add data rows
    rows.forEach(row => {
      const name = row.querySelector("strong")?.textContent || "";
      const pnElement = row.querySelector(".qiq-chip");
      const pn = pnElement ? pnElement.textContent.replace("PN/SKU: ", "") : "";
      const unitPrice = row.dataset.unit || "";
      const qty = row.querySelector(".qiq-qty")?.value || "1";
      const lineTotal = row.querySelector(".qiq-line")?.textContent || "";
      
      data.push([name, pn, unitPrice, qty, lineTotal]);
    });
    
    // Add grand total
    const grandTotal = grandCell?.textContent || "-";
    data.push(["الإجمالي الكلي", "", "", "", grandTotal]);
    
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Quote");
    
    // Download XLSX
    XLSX.writeFile(wb, `qiq-quote-${new Date().toISOString().split('T')[0]}.xlsx`);
  }
  
  // Event listeners for export buttons
  document.addEventListener('DOMContentLoaded', function() {
    const csvBtn = document.getElementById('qiq-export-csv');
    const xlsxBtn = document.getElementById('qiq-export-xlsx');
    
    if (csvBtn) {
      csvBtn.addEventListener('click', exportToCSV);
    }
    
    if (xlsxBtn) {
      xlsxBtn.addEventListener('click', exportToXLSX);
    }
  });
})();
