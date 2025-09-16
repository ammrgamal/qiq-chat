/* ========= Helpers ========= */
(function () {
  const tbody     = document.getElementById("qiq-body");     // جدول البنود
  const grandCell = document.getElementById("qiq-grand");    // الإجمالي
  const addAllBtn = document.getElementById("qiq-add-all");  // زرار Add all matched (لو موجود)
  const clearAllBtn = document.getElementById("qiq-clear-all"); // زرار Clear all
  const exportCsvBtn = document.getElementById("qiq-export-csv"); // زرار Export CSV
  const exportXlsxBtn = document.getElementById("qiq-export-xlsx"); // زرار Export XLSX

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

  // Enhanced notification system
  const showNotification = (message, type = 'info') => {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 10000;
      padding: 12px 16px; border-radius: 8px; color: white;
      background: ${type === 'success' ? '#059669' : type === 'error' ? '#dc2626' : '#2563eb'};
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  };

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
      <td><img class="qiq-img" src="${img}" alt="${name}" 
              onerror="this.src='https://via.placeholder.com/68?text=IMG'"
              onclick="openImagePreview('${img}')" 
              style="cursor:pointer" 
              title="اضغط لمعاينة الصورة"></td>
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

    // Add to quotation (Woo/Cart) — Enhanced with proper feedback
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
        showNotification("تمت إضافة المنتج للعربة بنجاح", "success");
      } catch {
        btn.textContent = "Error";
        showNotification("خطأ في إضافة المنتج للعربة", "error");
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
      // إشعار محسّن
      showNotification("تمت إضافة البند إلى عرض السعر", "success");
    }catch(e){
      showNotification("حدث خطأ أثناء إضافة العنصر", "error");
      console.warn(e);
    }
  };

  // ===== Export Functions =====
  function getTableData() {
    const data = [];
    tbody?.querySelectorAll("tr").forEach(tr => {
      const img = tr.querySelector(".qiq-img")?.src || "";
      const name = tr.querySelector("strong")?.textContent || "";
      const pnChip = tr.querySelector(".qiq-chip");
      const pn = pnChip ? pnChip.textContent.replace("PN/SKU: ", "") : "";
      const priceText = tr.dataset.unit || "";
      const unit = numFromPrice(priceText);
      const qty = Math.max(1, parseInt(tr.querySelector(".qiq-qty")?.value || "1", 10));
      const total = unit * qty;

      if (name) { // Only include rows with actual data
        data.push({ name, pn, unit, qty, total });
      }
    });
    return data;
  }

  function exportToCSV() {
    const data = getTableData();
    if (!data.length) {
      showNotification("لا توجد بيانات للتصدير", "error");
      return;
    }

    const csvContent = [
      ['الوصف', 'PN/SKU', 'سعر الوحدة', 'الكمية', 'الإجمالي'].join(','),
      ...data.map(row => [
        `"${row.name.replace(/"/g, '""')}"`,
        `"${row.pn.replace(/"/g, '""')}"`,
        row.unit,
        row.qty,
        row.total
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `boq-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification("تم تصدير ملف CSV بنجاح", "success");
  }

  function exportToExcel() {
    const data = getTableData();
    if (!data.length) {
      showNotification("لا توجد بيانات للتصدير", "error");
      return;
    }

    // Fallback Excel export using CSV with .xls extension
    const csvContent = [
      ['الوصف', 'PN/SKU', 'سعر الوحدة', 'الكمية', 'الإجمالي'].join('\t'),
      ...data.map(row => [
        row.name,
        row.pn,
        row.unit,
        row.qty,
        row.total
      ].join('\t'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `boq-${new Date().toISOString().slice(0, 10)}.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification("تم تصدير ملف Excel بنجاح", "success");
  }

  function clearAllItems() {
    if (!tbody) return;
    if (confirm("هل أنت متأكد من حذف جميع البنود؟ هذا الإجراء لا يمكن التراجع عنه.")) {
      tbody.innerHTML = '';
      recalcTotals();
      showNotification("تم مسح جميع البنود", "success");
    }
  }

  // ===== Event Listeners =====
  clearAllBtn?.addEventListener('click', clearAllItems);
  exportCsvBtn?.addEventListener('click', exportToCSV);
  exportXlsxBtn?.addEventListener('click', exportToExcel);

  // Import BOQ functionality
  const importBtn = document.getElementById("qiq-import-btn");
  const fileInput = document.getElementById("qiq-file");

  importBtn?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      importFromExcel(file);
    }
  });

  function importFromExcel(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const text = e.target.result;
        const rows = text.split('\n').map(row => 
          row.split(/[,\t]/).map(cell => cell.trim().replace(/"/g, ''))
        );
        
        let importedCount = 0;
        // Skip header row and process data
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length >= 2 && (row[0] || row[1])) { // At least name or SKU
            const itemData = {
              name: String(row[0] || 'Imported Item'),
              sku: String(row[1] || ''),
              price: String(row[2] || '0'),
              source: 'Import'
            };
            buildRow(itemData);
            importedCount++;
          }
        }
        
        if (importedCount > 0) {
          showNotification(`تم استيراد ${importedCount} عنصر بنجاح`, "success");
        } else {
          showNotification("لم يتم العثور على بيانات صالحة للاستيراد", "error");
        }
      } catch (error) {
        showNotification("خطأ في قراءة الملف. تأكد من صحة التنسيق", "error");
        console.error('Import error:', error);
      } finally {
        fileInput.value = ''; // Clear the input
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  // ===== Image Preview Functions =====
  window.openImagePreview = function(imgSrc) {
    const overlay = document.getElementById("image-preview-overlay");
    const previewImg = document.getElementById("preview-image");
    if (overlay && previewImg) {
      previewImg.src = imgSrc;
      overlay.style.display = "flex";
    }
  };

  window.closeImagePreview = function() {
    const overlay = document.getElementById("image-preview-overlay");
    if (overlay) {
      overlay.style.display = "none";
    }
  };

})();
