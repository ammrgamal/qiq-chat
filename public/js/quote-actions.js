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

    // Create image element with proper loading handling
    const imgElement = document.createElement("img");
    imgElement.className = "qiq-img";
    imgElement.alt = name;
    imgElement.style.opacity = "0.8";
    
    // Use a local placeholder or data URL instead of external URL
    const localPlaceholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjgiIGhlaWdodD0iNjgiIHZpZXdCb3g9IjAgMCA2OCA2OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY4IiBoZWlnaHQ9IjY4IiBmaWxsPSIjRjVGNUY1IiBzdHJva2U9IiNFNUU3RUIiLz4KPHRleHQgeD0iMzQiIHk9IjM4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IiM5OTkiPklNRzwvdGV4dD4KPC9zdmc+';
    
    // Set up loading states to prevent flickering
    imgElement.onload = function() {
      if (this.src !== localPlaceholder) {
        this.style.opacity = "1";
      }
    };
    
    imgElement.onerror = function() {
      // Only set placeholder if it's not already set to prevent infinite loops
      if (this.src !== localPlaceholder) {
        this.src = localPlaceholder;
        this.style.opacity = "0.7";
      }
    };
    
    // Set source after setting up handlers, but validate URL first
    if (img && img.startsWith('http') && !img.includes('placeholder')) {
      imgElement.src = img;
    } else {
      imgElement.src = localPlaceholder;
    }

    const imgCell = document.createElement("td");
    imgCell.appendChild(imgElement);

    tr.innerHTML = `
      <td class="img-cell"></td>
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

    // Replace the empty img cell with our properly configured one
    tr.querySelector(".img-cell").replaceWith(imgCell);

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
  
  // Helper function to get table data for export
  function getTableData() {
    const data = [];
    const rows = tbody?.querySelectorAll("tr") || [];
    
    rows.forEach(row => {
      const cells = row.querySelectorAll("td");
      if (cells.length >= 4) {
        const imgSrc = cells[0].querySelector("img")?.src || "";
        const description = cells[1].textContent.trim();
        const unitPrice = cells[2].textContent.trim();
        const qty = row.querySelector(".qiq-qty")?.value || "1";
        const total = cells[3].textContent.trim();
        
        data.push({
          image: imgSrc,
          description: description,
          unitPrice: unitPrice,
          quantity: qty,
          total: total
        });
      }
    });
    
    return data;
  }

  // Export to CSV
  function exportToCSV() {
    const data = getTableData();
    if (data.length === 0) {
      alert("لا توجد بيانات للتصدير");
      return;
    }

    const headers = ["الوصف", "سعر الوحدة", "الكمية", "الإجمالي"];
    const csvContent = [
      headers.join(","),
      ...data.map(row => [
        `"${row.description.replace(/"/g, '""')}"`,
        `"${row.unitPrice}"`,
        `"${row.quantity}"`,
        `"${row.total}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `quote_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // Export to XLSX
  function exportToXLSX() {
    const data = getTableData();
    if (data.length === 0) {
      alert("لا توجد بيانات للتصدير");
      return;
    }

    // Check if XLSX library is loaded
    if (typeof XLSX === 'undefined') {
      alert("مكتبة XLSX غير محملة. يرجى إعادة تحميل الصفحة.");
      return;
    }

    const worksheetData = [
      ["الوصف", "سعر الوحدة", "الكمية", "الإجمالي"],
      ...data.map(row => [
        row.description,
        row.unitPrice,
        row.quantity,
        row.total
      ])
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Quote");

    // Auto-size columns
    const maxWidth = worksheetData.reduce((acc, row) => {
      return row.map((cell, i) => Math.max(acc[i] || 0, String(cell).length));
    }, []);
    worksheet['!cols'] = maxWidth.map(w => ({ width: Math.min(w + 2, 50) }));

    XLSX.writeFile(workbook, `quote_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  // Add all matched items function  
  function addAllMatched() {
    // Look for "Add" buttons in the chat results area
    const addButtons = document.querySelectorAll('.qiq-mini.primary[onclick*="AddToQuote"]');
    
    if (addButtons.length === 0) {
      alert("لا توجد عناصر متطابقة للإضافة");
      return;
    }

    let addedCount = 0;
    const startingRows = tbody?.children?.length || 0;
    
    addButtons.forEach(button => {
      try {
        // Simulate clicking the button to add the item
        if (!button.disabled) {
          button.click();
          addedCount++;
        }
      } catch (e) {
        console.warn("Failed to add item:", e);
      }
    });

    // Wait a bit and check if items were actually added
    setTimeout(() => {
      const endingRows = tbody?.children?.length || 0;
      const actuallyAdded = endingRows - startingRows;
      
      if (actuallyAdded > 0) {
        alert(`تمت إضافة ${actuallyAdded} عنصر للعرض`);
        // Scroll to the table to show the new items
        if (tbody) {
          tbody.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      } else if (addedCount > 0) {
        alert("تم محاولة الإضافة ولكن قد تكون العناصر موجودة مسبقاً");
      } else {
        alert("لم يتم إضافة أي عناصر");
      }
    }, 500);
  }

  /* ========= Event Listeners ========= */
  
  // Export CSV button
  const exportCSVBtn = document.getElementById("qiq-export-csv");
  if (exportCSVBtn) {
    exportCSVBtn.addEventListener("click", exportToCSV);
  }

  // Export XLSX button  
  const exportXLSXBtn = document.getElementById("qiq-export-xlsx");
  if (exportXLSXBtn) {
    exportXLSXBtn.addEventListener("click", exportToXLSX);
  }

  // Add all matched button
  if (addAllBtn) {
    addAllBtn.addEventListener("click", addAllMatched);
  }
})();
