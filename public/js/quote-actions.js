/* ========= Enhanced Quote Actions with Search ========= */
(function () {
  const tbody     = document.getElementById("qiq-body");     // جدول البنود
  const grandCell = document.getElementById("qiq-grand");    // الإجمالي
  const addAllBtn = document.getElementById("qiq-add-all");  // زرار Add all matched (لو موجود)
  const clearAllBtn = document.getElementById("qiq-clear-all"); // زرار Clear all
  const exportCsvBtn = document.getElementById("qiq-export-csv"); // زرار Export CSV
  const exportXlsxBtn = document.getElementById("qiq-export-xlsx"); // زرار Export XLSX
  const searchInput = document.getElementById("qiq-search-input"); // مربع البحث
  const searchCount = document.getElementById("qiq-search-count"); // عداد النتائج
  const saveDraftBtn = document.getElementById("qiq-save-draft"); // زرار حفظ المسودة
  const loadDraftBtn = document.getElementById("qiq-load-draft"); // زرار تحميل المسودة
  const logSection = document.getElementById("qiq-log-section"); // قسم السجل
  const logContent = document.getElementById("qiq-log-content"); // محتوى السجل
  const toggleLogBtn = document.getElementById("qiq-toggle-log"); // زرار إظهار/إخفاء السجل
  const clearLogBtn = document.getElementById("qiq-clear-log"); // زرار مسح السجل
  const showLogBtn = document.getElementById("qiq-show-log"); // زرار إظهار السجل من الجدول

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

  // Use the global toast system instead of inline notifications
  const showNotification = (message, type = 'info') => {
    if (window.QiqToast && window.QiqToast.show) {
      window.QiqToast.show(message, type);
    } else {
      // Fallback for legacy compatibility
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
    }
  };

  // ===== Operations Log Functions =====
  function addToLog(action, productName, details = '') {
    if (!logContent) return;
    
    const timestamp = new Date().toLocaleString('ar-EG');
    const logEntry = document.createElement('div');
    logEntry.style.cssText = 'margin-bottom: 4px; padding: 4px; border-bottom: 1px solid #e5e7eb;';
    
    const actionColor = action === 'إضافة' ? '#059669' : action === 'حذف' ? '#dc2626' : '#6b7280';
    logEntry.innerHTML = `
      <span style="color: ${actionColor}; font-weight: 600;">[${action}]</span> 
      <span style="color: #374151;">${productName}</span>
      ${details ? `<span style="color: #6b7280;"> - ${details}</span>` : ''}
      <span style="float: left; color: #9ca3af; font-size: 10px;">${timestamp}</span>
    `;
    
    // Add to top of log
    logContent.insertBefore(logEntry, logContent.firstChild);
    
    // Show log section if hidden
    if (logSection) {
      logSection.style.display = 'block';
    }
    
    // Limit log entries to 50
    const entries = logContent.children;
    if (entries.length > 50) {
      for (let i = entries.length - 1; i >= 50; i--) {
        entries[i].remove();
      }
    }
  }

  function clearLog() {
    if (logContent) {
      logContent.innerHTML = '';
      addToLog('نظام', 'تم مسح السجل', '');
    }
  }

  function toggleLog() {
    if (!logSection || !toggleLogBtn) return;
    
    const isVisible = logSection.style.display !== 'none';
    logSection.style.display = isVisible ? 'none' : 'block';
    toggleLogBtn.textContent = isVisible ? 'إظهار السجل' : 'إخفاء';
    
    // Update show log button text
    if (showLogBtn) {
      showLogBtn.textContent = isVisible ? 'إظهار السجل' : 'إخفاء السجل';
    }
  }

  // ===== Search/Filter Functionality =====
  function filterTable(searchTerm) {
    if (!tbody) return;
    
    const term = searchTerm.toLowerCase().trim();
    const rows = Array.from(tbody.querySelectorAll('tr'));
    let visibleCount = 0;
    
    rows.forEach(row => {
      if (!term) {
        row.style.display = '';
        visibleCount++;
        return;
      }
      
      // البحث في الاسم و PN/SKU
      const nameElement = row.querySelector('strong');
      const chipElement = row.querySelector('.qiq-chip');
      const name = nameElement ? nameElement.textContent.toLowerCase() : '';
      const chip = chipElement ? chipElement.textContent.toLowerCase() : '';
      
      const matches = name.includes(term) || chip.includes(term) || 
                     (row.dataset.key && row.dataset.key.toLowerCase().includes(term));
      
      row.style.display = matches ? '' : 'none';
      if (matches) visibleCount++;
    });
    
    // تحديث عداد النتائج
    if (searchCount) {
      if (term) {
        searchCount.textContent = `${visibleCount} من ${rows.length} عنصر`;
        searchCount.style.color = visibleCount === 0 ? '#dc2626' : '#059669';
      } else {
        searchCount.textContent = '';
      }
    }
    
    recalcTotals(); // إعادة حساب الإجماليات للعناصر المرئية فقط
  }

  // إضافة مستمع البحث
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      filterTable(e.target.value);
    });
    
    // مفاتيح الاختصار
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.target.value = '';
        filterTable('');
        e.target.blur();
      }
    });
  }

  // إعادة حساب الإجمالي وحالة زرار Add all (فقط للصفوف المرئية)
  function recalcTotals(){
    let grand = 0;
    [...(tbody?.querySelectorAll("tr")||[])].forEach(tr=>{
      // تجاهل الصفوف المخفية في البحث
      if (tr.style.display === 'none') return;
      
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
  // تحسين بسيط: طباعة اسم المنتج في الكونسول عند إضافة صف جديد
  console.log("تمت إضافة المنتج:", data.name || "—");
    if(!tbody) return;

    const sku     = (data.sku || data.pn || "").toString().trim();
    const key     = sku ? sku.toUpperCase() : (data.name||"").toUpperCase();
    if(!key) return;

    // منع التكرار بنفس الـ SKU
    if(tbody.querySelector(`tr[data-key="${CSS.escape(key)}"]`)) {
      showNotification("هذا المنتج موجود بالفعل في الجدول", "warning");
      return;
    }

    const name    = data.name  || "—";
    const price   = data.price || "";
    const unitNum = numFromPrice(price);
    const img     = data.image || "https://via.placeholder.com/68?text=IMG";
    const link    = data.link  || "";
    const source  = data.source|| "Add";
    const pn      = data.pn    || data.sku || "";
    const manufacturer = data.manufacturer || data.brand || data.vendor || "غير محدد";

    const tr = document.createElement("tr");
    tr.dataset.unit = price || "";
    tr.dataset.key  = key;
    tr.setAttribute("data-key", key);

    tr.innerHTML = `
      <td>
        <img class="qiq-img" src="${img}" alt="${name}"
          onerror="this.src='https://via.placeholder.com/68?text=IMG'"
          onclick="openImagePreview('${img}')"
          style="cursor:pointer"
          title="اضغط لمعاينة الصورة">
      </td>
      <td>
        <div class="product-desc">
          <span class="product-name">${link?`<a class="qiq-link" target="_blank" rel="noopener" href="${link}">${name}</a>`:`${name}`}</span>
          <div class="product-details">
            ${pn && manufacturer ? `<span class="product-pn">(PN: ${pn})</span> - <span class="product-brand">${manufacturer}</span>` : 
              pn ? `<span class="product-pn">PN: ${pn}</span>` : 
              manufacturer ? `<span class="product-brand">${manufacturer}</span>` : ''}
          </div>
        </div>
      </td>
      <td class="numeric">${price? fmtUSD(price) : "-"}</td>
      <td class="qiq-line numeric">${unitNum? fmtUSD(unitNum*1) : "-"}</td>
      <td><input type="number" min="1" step="1" value="1" class="qiq-qty qty-input"></td>
      <td>
        <div class="action-icons">
          <button class="action-btn edit" type="button" data-detail-sku="${sku}" title="تفاصيل المنتج">ℹ️</button>
          <button class="action-btn duplicate" type="button" data-sku="${sku}" data-slug="" title="إضافة للسلة">➕</button>
          <button class="action-btn delete" type="button" data-remove-sku="${sku}" title="حذف هذا البند">🗑️</button>
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

    // Add to quotation (Woo/Cart) — Enhanced with proper feedback and navigation
    tr.querySelector('[data-sku]').addEventListener('click', async (ev)=>{
      ev.preventDefault();
      const btn = ev.currentTarget;
      const qty = Math.max(1, parseInt(tr.querySelector('.qiq-qty')?.value||"1",10));
      btn.disabled = true;
      const old = btn.textContent;
      btn.textContent = "جاري الإضافة…";
      try {
        // TODO: اربط هنا مع /wp-json/qiq/v1/cart/add لو عندك الباك اند
        await new Promise(r=>setTimeout(r,400)); // محاكاة نجاح
        btn.textContent = "تم ✓";
        showNotification("تمت إضافة المنتج للسلة بنجاح", "success");
        
        // Auto-navigate to quote.html after adding
        setTimeout(() => {
          if (confirm("تم إضافة المنتج بنجاح. هل تريد الانتقال لصفحة المعاينة؟")) {
            window.location.href = "/quote.html";
          }
        }, 800);
        
      } catch {
        btn.textContent = "خطأ";
        showNotification("خطأ في إضافة المنتج للسلة", "error");
      } finally {
        setTimeout(()=>{ btn.textContent = old; btn.disabled = false; }, 900);
      }
    });

    // Remove item with confirmation
    tr.querySelector('[data-remove-sku]').addEventListener('click', (ev) => {
      ev.preventDefault();
      const itemName = name.length > 50 ? name.substring(0, 50) + '...' : name;
      const confirmMessage = `هل أنت متأكد من حذف هذا البند؟\n\n"${itemName}"\n\nهذا الإجراء لا يمكن التراجع عنه.`;
      
      if (confirm(confirmMessage)) {
        tr.remove();
        recalcTotals();
        showNotification("تم حذف البند بنجاح", "success");
        
        // إضافة إلى السجل
        addToLog('حذف', itemName, '');
        
        // إعادة تطبيق البحث بعد الحذف
        if (searchInput && searchInput.value.trim()) {
          filterTable(searchInput.value);
        }
      }
    });

    tbody.appendChild(tr);
    recalcTotals();
    
    // إضافة إلى السجل
    addToLog('إضافة', name, `المصدر: ${source}`);
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
      manufacturer: el.getAttribute("data-manufacturer") || "غير محدد",
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

  // ===== Draft Save/Load Functions =====
  function saveDraftToStorage() {
    try {
      const draftData = getTableData().map(item => ({
        ...item,
        timestamp: new Date().toISOString()
      }));
      
      localStorage.setItem('qiq-draft', JSON.stringify({
        items: draftData,
        savedAt: new Date().toISOString(),
        version: '1.0'
      }));
      
      showNotification(`تم حفظ المسودة بنجاح (${draftData.length} عنصر)`, "success");
    } catch (error) {
      showNotification("خطأ في حفظ المسودة", "error");
      console.error('Draft save error:', error);
    }
  }

  function loadDraftFromStorage() {
    try {
      const draftJson = localStorage.getItem('qiq-draft');
      if (!draftJson) {
        showNotification("لا توجد مسودة محفوظة", "warning");
        return;
      }
      
      const draft = JSON.parse(draftJson);
      if (!draft.items || !Array.isArray(draft.items)) {
        showNotification("المسودة المحفوظة تالفة", "error");
        return;
      }
      
      // Clear existing table
      if (tbody) tbody.innerHTML = '';
      
      // Load draft items
      let loadedCount = 0;
      draft.items.forEach(item => {
        if (item.name) {
          buildRow({
            name: item.name,
            sku: item.pn || '',
            pn: item.pn || '',
            price: item.unit || '',
            source: 'Draft',
            image: '',
            link: ''
          });
          loadedCount++;
        }
      });
      
      recalcTotals();
      showNotification(`تم تحميل المسودة بنجاح (${loadedCount} عنصر)`, "success");
      
      // Scroll to table
      if (tbody) {
        tbody.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      
    } catch (error) {
      showNotification("خطأ في تحميل المسودة", "error");
      console.error('Draft load error:', error);
    }
  }

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
  saveDraftBtn?.addEventListener('click', saveDraftToStorage);
  loadDraftBtn?.addEventListener('click', () => {
    if (tbody && tbody.children.length > 0) {
      if (confirm("سيتم استبدال البيانات الحالية بالمسودة المحفوظة. هل تريد المتابعة؟")) {
        loadDraftFromStorage();
      }
    } else {
      loadDraftFromStorage();
    }
  });
  toggleLogBtn?.addEventListener('click', toggleLog);
  showLogBtn?.addEventListener('click', toggleLog);
  clearLogBtn?.addEventListener('click', () => {
    if (confirm("هل تريد مسح سجل العمليات؟")) {
      clearLog();
    }
  });

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
