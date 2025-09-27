/* ========= Enhanced Quote Actions with Search ========= */
(function () {
  // Inline SVG fallback image (avoids blocked external placeholders)
  const FALLBACK_IMG = "data:image/svg+xml;utf8," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='100%' height='100%' fill='#f3f4f6'/><text x='50%' y='55%' dominant-baseline='middle' text-anchor='middle' fill='#9ca3af' font-size='28'>IMG</text></svg>");

  // Dispatch a global event whenever staged items change
  function emitStagedItemsChanged() {
    try {
      const count = (JSON.parse(localStorage.getItem('qiq_staged_items') || '[]') || []).length;
      document.dispatchEvent(new CustomEvent('stagedItemsChanged', { detail: { count } }));
    } catch {}
  }
  const tbody     = document.getElementById("qiq-body");     // جدول البنود
  const grandCell = document.getElementById("qiq-grand");    // الإجمالي
  const addAllBtn = document.getElementById("qiq-add-all");  // زرار Add all matched (لو موجود)
  const clearAllBtn = document.getElementById("qiq-clear-all"); // زرار Clear all
  const exportCsvBtn = document.getElementById("qiq-export-csv"); // زرار Export CSV (قد لا يكون موجودًا)
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
      const cur = (window.QiqSession?.currency||'EGP').toUpperCase();
      try { return new Intl.NumberFormat('en-US',{style:'currency',currency: cur}).format(n); }
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
      // Keep fallback visible until user clicks it
      notification.addEventListener('click', ()=> notification.remove());
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
      const visibleRows = [...(tbody?.querySelectorAll('tr')||[])].filter(tr=>tr.style.display !== 'none').length;
      addAllBtn.disabled = visibleRows === 0;
    }
  }

  // يبني صف في جدول الكوت
  function buildRow(data){
  // تحسين بسيط: طباعة اسم المنتج في الكونسول عند إضافة صف جديد
  console.log("تمت إضافة المنتج:", data.name || "—");
    if(!tbody) return;

    const key     = (data.pn || data.name || "").toString().trim().toUpperCase();
    if(!key) return;
    // منع التكرار بنفس الـ objectID
    if(tbody.querySelector(`tr[data-key="${CSS.escape(key)}"]`)) {
      showNotification("هذا المنتج موجود بالفعل في الجدول", "warning");
      return;
    }
    const name    = data.name  || "—";
    const price   = data.price || "";
    const unitNum = numFromPrice(price);
  const img     = data.image || FALLBACK_IMG;
  const link    = data.link  || "";
  const spec    = data.spec_sheet || "";
    const source  = data.source|| "Add";
    const pn      = data.pn    || "";
    const manufacturer = data.manufacturer || data.brand || data.vendor || "غير محدد";
    const tr = document.createElement("tr");
    tr.dataset.unit = price || "";
    tr.dataset.key  = key;
    tr.setAttribute("data-key", key);
    tr.innerHTML = `
      <td>
        <img class="qiq-img" src="${img}" alt="${name}"
          width="32" height="32"
          style="max-width:32px;max-height:32px;cursor:pointer;border-radius:6px"
          onerror="this.src='"+FALLBACK_IMG+"'"
          onclick="openImagePreview('${img}')"
          title="اضغط لمعاينة الصورة">
      </td>
      <td>
        <div class="product-desc">
          <span class="product-name">${link?`<a class="qiq-link" target="_blank" rel="noopener" href="${link}">${name}</a>`:`${name}`}</span>
          <div class="product-details">
            ${pn ? `<span class="product-pn">${pn}</span>` : ''}
            ${manufacturer ? `<span class="product-brand">${manufacturer}</span>` : ''}
            ${spec ? `<a class="qiq-spec" href="${spec}" target="_blank" rel="noopener" title="Spec Sheet" aria-label="Spec Sheet" style="margin-left:6px;display:inline-flex;align-items:center;color:#2563eb"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" style=\"vertical-align:middle\"><path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><polyline points=\"14 2 14 8 20 8\"/><text x=\"7\" y=\"17\" font-size=\"8\" fill=\"#dc2626\" font-family=\"sans-serif\">PDF</text></svg></a>` : ''}
          </div>
        </div>
      </td>
      <td><input type="number" min="1" step="1" value="1" class="qiq-qty qty-input"></td>
      <td class="numeric">${price? fmtUSD(price) : "-"}</td>
      <td class="qiq-line numeric">${unitNum? fmtUSD(unitNum*1) : "-"}</td>
      <td class="qiq-notes">${buildNoteText(data)}</td>
      <td>
        <div class="action-icons">
          <button class="action-btn edit" type="button" data-detail-pn="${pn}" title="تفاصيل المنتج">ℹ️</button>
          <button class="action-btn delete" type="button" data-remove-pn="${pn}" title="حذف هذا البند">🗑️</button>
        </div>
      </td>
    `;

    const qtyInput = tr.querySelector(".qiq-qty");
    if (qtyInput) qtyInput.addEventListener("input", () => {
      recalcTotals();
      updateStagedItemsFromTable();
    });

    // فتح التفاصيل (يجب التأكد من وجود الزر)
    const detailBtn = tr.querySelector('[data-detail-pn]');
    if (detailBtn) {
      detailBtn.addEventListener('click', (ev)=>{
        ev.preventDefault();
        const title = 'تفاصيل المنتج';
        const html = `
          <div style="display:flex;gap:12px;align-items:flex-start">
            <img src="${img}" alt="${name}" style="width:96px;height:96px;border-radius:10px;object-fit:cover;background:#f3f4f6" onerror="this.src='${FALLBACK_IMG}'"/>
            <div>
              <div style="font-weight:700;margin-bottom:6px">${name}</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0">
                ${pn ? `<span style="background:#f3f4f6;border-radius:999px;padding:2px 8px;font-size:12px;color:#374151">PN: ${pn}</span>` : ''}
                ${manufacturer ? `<span style="background:#f3f4f6;border-radius:999px;padding:2px 8px;font-size:12px;color:#374151">${manufacturer}</span>` : ''}
                ${unitNum? `<span style="background:#eef2ff;border-radius:999px;padding:2px 8px;font-size:12px;color:#3730a3">USD ${unitNum}</span>`:''}
                ${unitNum? `<span style="background:#eef2ff;border-radius:999px;padding:2px 8px;font-size:12px;color:#3730a3">${(window.QiqSession?.currency||'EGP')} ${unitNum}</span>`:''}
              </div>
              ${link ? `<a href="${link}" target="_blank" rel="noopener" style="color:#2563eb">Open product page</a>` : ''}
            </div>
          </div>`;
        try{
          if (window.QiqModal) QiqModal.open('#', { title, html, size: 'sm' });
          else alert(name);
        }catch{}
      });
    }

    // Add to quotation (Woo/Cart) — Enhanced with proper feedback and navigation
    const skuBtn = tr.querySelector('[data-sku]');
    if (skuBtn) {
      skuBtn.addEventListener('click', async (ev)=>{
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
          showNotification("تمت إضافة المنتج للعرض بنجاح", "success");
          
          // Auto-navigate to quote.html after adding
          setTimeout(() => {
            if (confirm("تم إضافة المنتج بنجاح. هل تريد الانتقال لصفحة المعاينة؟")) {
              window.location.href = "quote.html";
            }
          }, 800);
          
        } catch {
          btn.textContent = "خطأ";
          showNotification("خطأ في إضافة المنتج للعرض", "error");
        } finally {
          setTimeout(()=>{ btn.textContent = old; btn.disabled = false; }, 900);
        }
      });
    }

    // Remove item with confirmation
  const removeBtn = tr.querySelector('[data-remove-pn]');
    if (removeBtn) {
      removeBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        const itemName = name.length > 50 ? name.substring(0, 50) + '...' : name;
        const confirmMessage = `هل أنت متأكد من حذف هذا البند؟\n\n"${itemName}"\n\nهذا الإجراء لا يمكن التراجع عنه.`;
        
        if (confirm(confirmMessage)) {
          tr.remove();
          recalcTotals();
          updateStagedItemsFromTable();
          showNotification("تم حذف البند بنجاح", "success");
          
          // إضافة إلى السجل
          addToLog('حذف', itemName, '');
          
          // إعادة تطبيق البحث بعد الحذف
          if (searchInput && searchInput.value.trim()) {
            filterTable(searchInput.value);
          }
        }
      });
    }

    tbody.appendChild(tr);
    recalcTotals();
  updateStagedItemsFromTable();
    emitStagedItemsChanged();
    
    // إضافة إلى السجل
    addToLog('إضافة', name, `المصدر: ${source}`);
  }
  function buildNoteText(data){
    const notes = [];
    if (data.isAlternative) notes.push('بديل');
    if (data.availability === 'in-stock') notes.push('متوفر');
    if (data.availability === 'backorder') notes.push('على طلب');
    return notes.join(' • ');
  }
  // حفظ كل المنتجات الحالية في الجدول في localStorage
  function updateStagedItemsFromTable() {
    if (!tbody) return;
    const products = [];
    tbody.querySelectorAll('tr').forEach(row => {
      const name = row.querySelector('.product-name')?.textContent?.trim() || '';
      const pn = row.querySelector('.product-pn')?.textContent?.replace(/^PN:\s*/i,'').trim() || (row.getAttribute('data-key') || '');
      const priceText = row.dataset.unit || '';
      const unit = numFromPrice(priceText);
      const qty = Math.max(1, parseInt(row.querySelector('.qiq-qty')?.value || '1', 10));
      const manufacturer = row.querySelector('.product-brand')?.textContent?.trim() || '';
      const image = row.querySelector('.qiq-img')?.src || '';
      const link = row.querySelector('.qiq-link')?.href || '';
      const spec = row.querySelector('.qiq-spec')?.href || row.getAttribute('data-specsheet') || '';
      if (name) {
        products.push({
          name,
          pn,
          sku: pn,
          price: unit,
          unitPrice: unit,
          qty,
          manufacturer,
          image,
          link,
          spec_sheet: spec,
          source: 'Staged'
        });
      }
    });
    localStorage.setItem('qiq_staged_items', JSON.stringify(products));
  emitStagedItemsChanged();
    // If a reference is active, also save snapshot under that reference key
    try{
      const ref = localStorage.getItem('qiq_boq_current_ref') || '';
      if (ref) {
        const mapKey = 'qiq_boq_refs_map';
        const refs = JSON.parse(localStorage.getItem(mapKey) || '{}');
        refs[ref] = { items: products, savedAt: new Date().toISOString() };
        localStorage.setItem(mapKey, JSON.stringify(refs));
      }
    }catch{}
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
      spec_sheet: el.getAttribute("data-specsheet") || "",
      availability: el.getAttribute("data-availability") || "",
      manufacturer: el.getAttribute("data-manufacturer") || "غير محدد",
      source: el.getAttribute("data-source")|| "Add"
    };
  }

  // ===== دالة حفظ المنتج في localStorage =====
  function saveProductToQuote(payload) {
    try {
      // الحصول على المنتجات المحفوظة مسبقاً
      let existingProducts = [];
      const savedData = localStorage.getItem('qiq_staged_items');
      if (savedData) {
        existingProducts = JSON.parse(savedData);
      }
      
      // إضافة المنتج الجديد
      const productToSave = {
        name: payload.name || 'منتج غير محدد',
        sku: payload.sku || payload.pn || '',
        pn: payload.sku || payload.pn || '',
        price: payload.price || '',
        unit: payload.price || '',
        image: payload.image || '',
        link: payload.link || '',
        spec_sheet: payload.spec_sheet || '',
        availability: payload.availability || '',
        manufacturer: payload.manufacturer || '',
        source: payload.source || 'Chat',
        qty: 1,
        timestamp: new Date().toISOString()
      };
      
      existingProducts.push(productToSave);
      
    // حفظ القائمة المحدثة
    localStorage.setItem('qiq_staged_items', JSON.stringify(existingProducts));
    emitStagedItemsChanged();
      
      console.log('Product saved to localStorage:', productToSave);
    } catch (error) {
      console.error('Error saving product to localStorage:', error);
    }
  }

  /* ========= API عامّة =========
     — تقدر تنادي AddToQuote بطريقتين:
       1) AddToQuote({name, price, sku, pn, image, link, source})
       2) AddToQuote(this) لو الزرار عليه data-*
  ================================= */
  window.AddToQuote = function (arg){
    try{
      let payload = null;
      if (arg && typeof arg === "object" && !(arg instanceof Element)) {
        payload = arg;
      } else if (arg instanceof Element) {
        payload = dataFromElement(arg);
      } else {
        alert("Invalid AddToQuote call.");
        return;
      }

      // تحقق من القيم الأساسية (السعر اختياري)
      if (!payload.name || !payload.pn) {
        showNotification("يجب أن يحتوي المنتج على اسم ورقم PN (objectID)", "error");
        return;
      }
      if (payload.price === undefined || payload.price === null) {
        payload.price = '';
      }
      if (!payload.image) {
  payload.image = 'data:image/svg+xml;utf8,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='68' height='68'><rect width='100%' height='100%' fill='#f3f4f6'/><text x='50%' y='55%' dominant-baseline='middle' text-anchor='middle' fill='#9ca3af' font-size='12'>IMG</text></svg>");
      }

      // أضف المنتج للجدول فعلياً
      buildRow(payload);
      // ثم احفظه في localStorage
      saveProductToQuote(payload);
      showNotification("تمت إضافة المنتج للجدول وحفظه في قائمة العرض. يمكنك الانتقال لصفحة عرض السعر من الزر أسفل الجدول.", "success");
    }catch(e){
      showNotification("حدث خطأ أثناء إضافة العنصر: " + (e?.message || e), "error");
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
      const name = tr.querySelector(".product-name")?.textContent || "";
      const pn = tr.querySelector(".product-pn")?.textContent.replace("PN: ","") || "";
      const priceText = tr.dataset.unit || "";
      const unit = numFromPrice(priceText);
      const qty = Math.max(1, parseInt(tr.querySelector(".qiq-qty")?.value || "1", 10));
      const total = unit * qty;

      // تجاهل الصفوف الفارغة أو التي ليس بها اسم أو سعر
      if (name && name.trim() && unit > 0) {
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
      updateStagedItemsFromTable();
      showNotification("تم مسح جميع البنود", "success");
    }
  }

  // ===== Event Listeners =====
  clearAllBtn?.addEventListener('click', clearAllItems);
  // قد يتم إخفاء زر CSV بناءً على الإعدادات
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
  let fileInput = document.getElementById("qiq-file");

  function ensureFileInput(){
    if (fileInput && fileInput.tagName) return fileInput;
    // Create a hidden file input if not present (more robust across pages)
    const form = document.getElementById('qiq-form') || document.body;
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'qiq-file';
    fileInput.accept = '.xlsx,.xls,.csv';
    fileInput.style.position = 'absolute';
    fileInput.style.left = '-9999px';
    fileInput.style.width = '1px';
    fileInput.style.height = '1px';
    fileInput.setAttribute('aria-hidden','true');
    form.appendChild(fileInput);
    // Bind change once when we create it
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) importFromExcel(file);
      // reset value so selecting the same file again re-triggers change
      try{ e.target.value = ''; }catch{}
    });
    return fileInput;
  }

  importBtn?.addEventListener('click', () => {
    const inp = ensureFileInput();
    try{ inp.value = ''; }catch{}
    inp.click();
  });

  // If input exists in DOM already, ensure change handler is attached
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) importFromExcel(file);
      try{ e.target.value = ''; }catch{}
    }, { once:false });
  }

  function importFromExcel(file) {
    const isExcel = /\.(xlsx|xls)$/i.test(file?.name || '');
    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        // Send to backend parser for consistent logic + notes
        let payload = null;
        if (isExcel && typeof XLSX !== 'undefined' && e.target.result) {
          const wb = XLSX.read(e.target.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
          payload = { rows: aoa };
        } else {
          const text = e.target.result || '';
          if (typeof text !== 'string') { showNotification('تعذر قراءة الملف، حاول مرة أخرى كـ CSV', 'error'); return; }
          if (/^PK/.test(text)) { showNotification('تم رفع ملف Excel ثنائي. لو سمحت ارفعه كـ .xlsx (سيتم استخدام SheetJS).', 'error'); return; }
          const rows = text.split(/\r?\n/).map(r=> r.split(/[;\t,]/).map(c=> String(c||'').trim().replace(/^"|"$/g,'')) ).filter(r=> r.some(c=>c && c.length));
          payload = { rows };
        }
        // Try backend parser; if 404 or network error, fallback to local parsing
        let parsed = null;
        try{
          const resp = await fetch('/api/boq/parse', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) });
          if (resp.ok) parsed = await resp.json();
          else if (resp.status !== 404) throw new Error('HTTP '+resp.status);
        }catch(err){ console.warn('backend parse error, will fallback:', err); }

        let rows = Array.isArray(parsed?.items) ? parsed.items : [];
        let notes = Array.isArray(parsed?.notes) ? parsed.notes : [];
        if (!rows.length) {
          // Local fallback: implement minimal fromRows equivalent
          function fromRowsLocal(aoa){
            if (!Array.isArray(aoa) || aoa.length===0) return { items: [], notes:['BOQ: no rows'] };
            const header = aoa[0].map(x=> String(x||'').toLowerCase());
            const col = { pn:-1, qty:-1, desc:-1, price:-1 };
            header.forEach((h,i)=>{
              if (col.pn<0 && /(pn|mpn|sku|part|رقم|كود|موديل)/i.test(h)) col.pn=i;
              if (col.qty<0 && /(qty|quantity|عدد|كمية)/i.test(h)) col.qty=i;
              if (col.price<0 && /(price|unit|cost|سعر)/i.test(h)) col.price=i;
              if (col.desc<0 && /(desc|name|وصف|البند|item)/i.test(h)) col.desc=i;
            });
            const probe = aoa.slice(1,4);
            function likelyPn(v){ const s=String(v||''); return /[a-z]{1,3}?\d|\d+[a-z]/i.test(s) && /[a-z0-9]/i.test(s) && s.length>=3; }
            function likelyQty(v){ const n=Number(String(v||'').replace(/[^\d.]/g,'')); return Number.isFinite(n)&&n>0&&Math.floor(n)===n; }
            function likelyPrice(v){ const s=String(v||''); return /(usd|sar|egp|aed|eur|\$)/i.test(s) || (Number(String(s).replace(/[^\d.]/g,''))>0 && s.includes('.')); }
            if (col.pn<0 || col.qty<0){
              for (let i=0;i<(aoa[1]?.length||0);i++){
                const vals = probe.map(r=>r[i]);
                if (col.pn<0 && vals.filter(likelyPn).length>=2) col.pn=i;
                if (col.qty<0 && vals.filter(likelyQty).length>=2) col.qty=i;
              }
            }
            if (col.price<0){
              for (let i=0;i<(aoa[1]?.length||0);i++){
                const vals = probe.map(r=>r[i]);
                if (vals.filter(likelyPrice).length>=1){ col.price=i; break; }
              }
            }
            if (col.desc<0){ for (let i=0;i<(aoa[1]?.length||0);i++){ if(i!==col.pn && i!==col.qty){ col.desc=i; break; } } }
            const notes=[]; if (col.pn<0 || col.qty<0) notes.push('لم نتمكن من تحديد PN/QTY بدقة — سيتم الافتراض (أول عمود PN والثاني QTY).');
            if (col.pn<0) col.pn=0; if (col.qty<0) col.qty=1;
            const out=[];
            for (let i=1;i<aoa.length;i++){
              const r = aoa[i]; if (!r) continue;
              const pn   = r[col.pn] ?? '';
              const qty  = r[col.qty] ?? 1;
              const desc = col.desc>=0 ? r[col.desc] : '';
              const priceRaw = col.price>=0 ? r[col.price] : '';
              const price = priceRaw ? Number(String(priceRaw).replace(/[^\d.]/g,'')) : undefined;
              if (!pn && !desc) continue;
              const q = Number(String(qty).replace(/[^\d.]/g,'')) || 1;
              out.push({ pn: String(pn||'').toString(), qty: q, description: desc? String(desc) : undefined, price });
            }
            return { items: out, notes };
          }
          const fallbackAoA = payload.rows || [];
          const f = fromRowsLocal(fallbackAoA);
          rows = f.items; notes = f.notes;
        }

        if (!rows.length) { showNotification('الملف فارغ أو غير صالح', 'error'); return; }

        // Helper: search backend for a PN or description
        async function searchCatalog(q){
          try{
            const resp = await fetch('/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:q,hitsPerPage:3})});
            if(!resp.ok) throw new Error('HTTP '+resp.status);
            const data = await resp.json();
            return Array.isArray(data?.hits)? data.hits : [];
          }catch(err){ console.warn('searchCatalog error',err); return []; }
        }

        // Helper: add base row
        function addBaseRow({name,pn,qty,price,manufacturer,image,link,source,note,isAlternative,availability}){
          const payload = {
            name: name || (pn? `Item ${pn}` : 'Imported Item'),
            pn: pn || '',
            sku: pn || '',
            price: price || '',
            manufacturer: manufacturer || '',
            image: image || '',
            link: link || '',
            source: source || 'Import',
            isAlternative: !!isAlternative,
            availability: availability || ''
          };
          buildRow(payload);
          // set qty if provided
          const tr = tbody?.lastElementChild;
          if (tr && qty && Number(qty)>1) {
            const q = tr.querySelector('.qiq-qty');
            if (q) { q.value = String(Math.max(1, parseInt(qty,10))); }
          }
          if (note) { try{ if(window.QiqToast?.info) window.QiqToast.info(note);}catch{} }
          if (isAlternative) { addToLog('إضافة', payload.name, 'بديل مقترح'); }
        }

        let importedCount = 0;
        for (const row of rows){
          const pn = String(row.pn||'').trim();
          const qty = Number(row.qty||1) || 1;
          const desc = String(row.description||'').trim();
          const price = row.price!=null ? String(row.price).replace(/[^\d.]/g,'') : '';
          if (!(pn||desc)) continue;

          // 1) Try PN exact/close match
          let hits = [];
          if (pn) hits = await searchCatalog(pn);
          if (!hits.length && desc) hits = await searchCatalog(desc);

          if (hits.length) {
            const h = hits[0];
            addBaseRow({
              name: h?.name || desc || pn,
              pn: h?.pn || h?.mpn || h?.sku || h?.objectID || pn,
              qty,
              price: h?.price || h?.list_price || price || '',
              manufacturer: h?.brand || h?.manufacturer || h?.vendor || '',
              image: h?.image || h?.image_url || h?.thumbnail || '',
              link: (h?.objectID||h?.sku||h?.pn||h?.mpn)? `/products-list.html?q=${encodeURIComponent(h.objectID||h.sku||h.pn||h.mpn)}` : (h?.link||h?.product_url||''),
              source: 'Import+Catalog',
              availability: h?.availability || ''
            });
            importedCount++;
          } else {
            addBaseRow({ name: desc || `Item ${pn}`, pn, qty, price, source:'Import', note:'غير موجود في الكتالوج — يرجى اختيار بديل.' });
            let altQ = '';
            if (pn) {
              const parts = pn.split(/[-_\s]/).filter(Boolean);
              altQ = parts.slice(0,2).join(' ');
            }
            if (!altQ && desc) {
              const words = desc.split(/\s+/).filter(w=>w.length>2);
              altQ = words.slice(0,3).join(' ');
            }
            if (altQ) {
              const altHits = await searchCatalog(altQ);
              if (altHits.length) {
                const a = altHits[0];
                addBaseRow({
                  name: `[بديل] ${a?.name || altQ}`,
                  pn: a?.pn || a?.mpn || a?.sku || a?.objectID || '',
                  qty,
                  price: a?.price || a?.list_price || '',
                  manufacturer: a?.brand || a?.manufacturer || a?.vendor || '',
                  image: a?.image || a?.image_url || a?.thumbnail || '',
                  link: (a?.objectID||a?.sku||a?.pn||a?.mpn)? `/products-list.html?q=${encodeURIComponent(a.objectID||a.sku||a.pn||a.mpn)}` : (a?.link||a?.product_url||''),
                  source: 'Alternative',
                  isAlternative: true,
                  availability: a?.availability || ''
                });
              }
            }
          }
        }

  if (notes.length) { try{ window.QiqToast?.warning?.(notes.join('\n'));}catch{} }
        if (importedCount > 0) { showNotification(`تم استيراد ${importedCount} عنصر بنجاح`, 'success'); }
        else { showNotification('لم يتم العثور على بيانات صالحة للاستيراد', 'error'); }

        // Persist staged
        updateStagedItemsFromTable();
      } catch (error) {
        showNotification('خطأ في قراءة الملف. تأكد من صحة التنسيق', 'error');
        console.error('Import error:', error);
      } finally {
        fileInput.value = '';
      }
    };
    if (isExcel && typeof XLSX !== 'undefined') reader.readAsArrayBuffer(file); else reader.readAsText(file, 'UTF-8');
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

  addAllBtn?.addEventListener('click', function() {
    updateStagedItemsFromTable();
    showNotification('تم حفظ كل المنتجات في قائمة عرض السعر. يمكنك الآن الانتقال لصفحة عرض السعر.', 'success');
  });

  // ===== BOQ Reference Utilities (exposed) =====
  (function(){
    function genRef(){
      const d = new Date();
      const ts = d.toISOString().replace(/[-:T.Z]/g,'').slice(0,12);
      return `QIQ-${ts}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    }
    function getMap(){ try{ return JSON.parse(localStorage.getItem('qiq_boq_refs_map')||'{}')||{}; }catch{ return {}; } }
    function setMap(m){ try{ localStorage.setItem('qiq_boq_refs_map', JSON.stringify(m)); }catch{} }
    function currentItems(){ try{ return JSON.parse(localStorage.getItem('qiq_staged_items')||'[]')||[]; }catch{ return []; } }
    function setCurrentRef(ref){ try{ localStorage.setItem('qiq_boq_current_ref', String(ref||'')); }catch{} }
    function getCurrentRef(){ try{ return localStorage.getItem('qiq_boq_current_ref') || ''; }catch{ return ''; } }
    function saveAs(ref){
      const r = String(ref||'').trim() || genRef();
      const map = getMap();
      map[r] = { items: currentItems(), savedAt: new Date().toISOString() };
      setMap(map);
      setCurrentRef(r);
      return r;
    }
    function load(ref){
      const r = String(ref||'').trim();
      if (!r) return false;
      const map = getMap();
      const obj = map[r];
      if (!obj || !Array.isArray(obj.items)) return false;
      // Write to staged
      localStorage.setItem('qiq_staged_items', JSON.stringify(obj.items));
      setCurrentRef(r);
      // If a table exists on this page, re-render rows quickly
      if (tbody) {
        tbody.innerHTML = '';
        obj.items.forEach(item => {
          buildRow({
            name: item.name || item.description || '-',
            pn: item.pn || item.sku || '',
            sku: item.pn || item.sku || '',
            price: item.price || item.unit || item.unit_price || '',
            image: item.image || '',
            manufacturer: item.manufacturer || item.brand || '',
            link: item.link || '',
            source: 'Ref'
          });
        });
        recalcTotals();
      }
      return true;
    }
    function list(){
      const map = getMap();
      return Object.keys(map).map(k=>({ ref:k, savedAt: map[k]?.savedAt || null, count: Array.isArray(map[k]?.items)? map[k].items.length : 0 }))
        .sort((a,b)=> String(b.savedAt||'').localeCompare(String(a.savedAt||'')));
    }
    window.QiqBOQ = { newRef: genRef, saveCurrentAsRef: saveAs, loadRef: load, listRefs: list, getCurrentRef, setCurrentRef };
  })();

})();
