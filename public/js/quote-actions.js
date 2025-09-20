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

  // أسعار الصرف الرسمية
  const exchangeRates = {
    USD: 1,
    EUR: 0.93,
    EGP: 30.90,
    AED: 3.67,
    SAR: 3.75
  };

  // العملة الحالية
  let currentCurrency = 'EGP';

  // تنسيقات الأسعار
  function formatPrice(value, currency = currentCurrency) {
    const n = Number(String(value||"").replace(/[^\d.]/g,""));
    if (!isFinite(n)) return "-";
    try {
      // تحويل السعر من الدولار إلى العملة المطلوبة
      const exchangeRate = exchangeRates[currency] || 1;
      const convertedPrice = n * exchangeRate;
      
      const options = { style: 'currency', currency };
      return new Intl.NumberFormat(currency === 'EGP' ? 'ar-EG' : 'en-US', options).format(convertedPrice);
    } catch {
      return `${currency} ${n.toFixed(2)}`;
    }
  }

  function numFromPrice(v) {
    return Number(String(v||"").replace(/[^\d.]/g,"")) || 0;
  }

  // تحديث العملة وإعادة حساب الأسعار
  function updateCurrency(newCurrency) {
    currentCurrency = newCurrency;
    recalcTotals();
  }

  // استمع لتغييرات العملة
  document.getElementById('currency')?.addEventListener('change', (e) => {
    updateCurrency(e.target.value);
  });

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
  function recalcTotals() {
    let grand = 0;
    [...(tbody?.querySelectorAll("tr")||[])].forEach(tr => {
      // تجاهل الصفوف المخفية في البحث
      if (tr.style.display === 'none') return;
      
      const unit = numFromPrice(tr.dataset.unit||"");
      const qty  = Math.max(1, parseInt(tr.querySelector(".qiq-qty")?.value||"1",10));
      const line = unit * qty;
      const cell = tr.querySelector(".qiq-line");
      if(cell) cell.textContent = unit ? formatPrice(line) : "-";
      
      // تحديث سعر الوحدة أيضاً بالعملة الجديدة
      const unitCell = tr.querySelector("td.numeric");
      if (unitCell) unitCell.textContent = unit ? formatPrice(unit) : "-";
      
      grand += line;
    });
    if(grandCell) grandCell.textContent = grand ? formatPrice(grand) : "-";
    if(addAllBtn) {
      const addables = tbody?.querySelectorAll('button[data-sku]:not(:disabled)')?.length || 0;
      addAllBtn.disabled = addables === 0;
    }
  }

  // يبني صف في جدول الكوت
  function buildRow(data) {
    if(!tbody) return;

    const key = (data.pn || data.name || "").toString().trim().toUpperCase();
    if(!key) return;
    // منع التكرار بنفس الـ objectID
    if(tbody.querySelector(`tr[data-key="${CSS.escape(key)}"]`)) {
      showNotification("هذا المنتج موجود بالفعل في الجدول", "warning");
      return;
    }
    const name = data.name || "—";
    const price = data.price || "";
    const unitNum = numFromPrice(price);
    const img = data.image || "https://via.placeholder.com/68?text=IMG";
    const link = data.link || "";
    const source = data.source || "Add";
    const pn = data.pn || "";
    const manufacturer = data.manufacturer || data.brand || data.vendor || "غير محدد";

    const tr = document.createElement("tr");
    tr.dataset.unit = price || "";
    tr.dataset.key = key;
    tr.setAttribute("data-key", key);

    // تحسين عرض البيانات وإضافة معاينة للصور
    tr.innerHTML = `
      <td style="width:68px;text-align:center">
        <div class="product-image-container" style="position:relative;width:64px;height:64px;margin:auto">
          <img class="qiq-img" src="${img}" alt="${name}"
            style="width:100%;height:100%;object-fit:contain;cursor:pointer;border-radius:8px;border:1px solid #e5e7eb"
            onerror="this.src='https://via.placeholder.com/64?text=NO+IMAGE'"
            onclick="openImagePreview('${img}')"
            title="انقر لمعاينة الصورة">
        </div>
      </td>
      <td>
        <div class="product-info" style="display:flex;flex-direction:column;gap:4px">
          <div class="product-name" style="font-weight:600;color:#111827">
            ${link ? `<a class="qiq-link" target="_blank" rel="noopener" href="${link}">${name}</a>` : name}
          </div>
          <div class="product-meta" style="display:flex;flex-wrap:wrap;gap:8px;font-size:12px">
            ${pn ? `<span class="meta-tag" style="background:#f3f4f6;padding:2px 8px;border-radius:4px;color:#374151">P/N: ${pn}</span>` : ''}
            ${manufacturer ? `<span class="meta-tag" style="background:#e0f2fe;padding:2px 8px;border-radius:4px;color:#0369a1">${manufacturer}</span>` : ''}
          </div>
        </div>
      </td>
      <td style="width:80px">
        <input type="number" min="1" step="1" value="1" class="qiq-qty qty-input"
          style="width:100%;padding:4px;border:1px solid #e5e7eb;border-radius:6px;text-align:center">
      </td>
      <td class="numeric" style="width:120px;color:#374151;font-weight:500">
        ${price ? formatPrice(unitNum) : "-"}
      </td>
      <td class="qiq-line numeric" style="width:120px;color:#374151;font-weight:500">
        ${unitNum ? formatPrice(unitNum) : "-"}
      </td>
      <td style="width:100px">
        <div style="display:flex;gap:8px;justify-content:flex-end">
          ${link ? `
            <button type="button" class="action-btn" 
              onclick="openProductDetails('${link}')" 
              style="padding:6px;border:none;background:#f3f4f6;border-radius:6px;cursor:pointer"
              title="تفاصيل المنتج">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
              </svg>
            </button>
          ` : ''}
          <button type="button" class="action-btn delete"
            data-remove-pn="${pn}"
            style="padding:6px;border:none;background:#fee2e2;border-radius:6px;cursor:pointer;color:#dc2626"
            title="حذف هذا البند">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </td>
    `;

    const qtyInput = tr.querySelector(".qiq-qty");
    if (qtyInput) qtyInput.addEventListener("input", recalcTotals);

    // فتح التفاصيل (يجب التأكد من وجود الزر)
    const detailBtn = tr.querySelector('[data-detail-pn]');
    if (detailBtn) {
      detailBtn.addEventListener('click', (ev)=>{
        ev.preventDefault();
        try{
          const url = link || `/shop/?s=${encodeURIComponent(pn)}&post_type=product`;
          window.open(url, "_blank", "noopener");
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
    const removeBtn = tr.querySelector('[data-remove-sku]');
    if (removeBtn) {
      removeBtn.addEventListener('click', (ev) => {
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
    }

    tbody.appendChild(tr);
    recalcTotals();
    
    // إضافة إلى السجل
    addToLog('إضافة', name, `المصدر: ${source}`);
  }
      // تفاصيل المنتج في نافذة منبثقة
    window.openProductDetails = function(link) {
      // إنشاء نافذة منبثقة إذا لم تكن موجودة
      let modal = document.getElementById('product-details-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'product-details-modal';
        modal.style.cssText = `
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          display: none;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        `;
        modal.innerHTML = `
          <div style="position:relative;background:#fff;padding:20px;border-radius:12px;width:90%;max-width:800px;max-height:90vh;overflow:auto">
            <button onclick="this.closest('#product-details-modal').style.display='none'" 
                    style="position:absolute;top:10px;right:10px;background:none;border:none;font-size:24px;cursor:pointer">×</button>
            <iframe style="width:100%;height:70vh;border:none" loading="lazy"></iframe>
          </div>
        `;
        document.body.appendChild(modal);
      }
      
      // تحديث المحتوى وعرض النافذة
      const iframe = modal.querySelector('iframe');
      if (iframe) iframe.src = link;
      modal.style.display = 'flex';
    };

    // معاينة الصورة في نافذة منبثقة
    window.openImagePreview = function(imageUrl) {
      // إنشاء نافذة المعاينة إذا لم تكن موجودة
      let preview = document.getElementById('image-preview-overlay');
      if (!preview) {
        preview = document.createElement('div');
        preview.id = 'image-preview-overlay';
        preview.style.cssText = `
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.9);
          display: none;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        `;
        preview.innerHTML = `
          <button onclick="this.closest('#image-preview-overlay').style.display='none'"
                  style="position:absolute;top:20px;right:20px;background:#fff;border:none;border-radius:50%;width:40px;height:40px;cursor:pointer;font-size:24px">×</button>
          <img style="max-width:90vw;max-height:90vh;border-radius:8px;object-fit:contain" />
        `;
        document.body.appendChild(preview);
      }
      
      // تحديث الصورة وعرض النافذة
      const img = preview.querySelector('img');
      if (img) {
        img.src = imageUrl;
        img.alt = 'Product preview';
        // إظهار الصورة الافتراضية في حالة الفشل
        img.onerror = () => img.src = 'https://via.placeholder.com/400?text=NO+IMAGE';
      }
      preview.style.display = 'flex';
    };

    // حفظ كل المنتجات الحالية في الجدول في localStorage بعد كل إضافة
    const products = [];
    tbody.querySelectorAll('tr').forEach(row => {
      const name = row.querySelector('.product-name')?.textContent || '';
      const pn = row.querySelector('.meta-tag')?.textContent.replace('P/N:', '').trim() || '';
      const price = row.querySelector('.numeric')?.textContent || '';
      const qty = row.querySelector('.qiq-qty')?.value || '1';
      const manufacturer = row.querySelector('.meta-tag:last-child')?.textContent || '';
      products.push({ name, pn, price, qty, manufacturer });
    });
    localStorage.setItem('qiq_staged_items', JSON.stringify(products));

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
        manufacturer: payload.manufacturer || '',
        source: payload.source || 'Chat',
        qty: 1,
        timestamp: new Date().toISOString()
      };
      
      existingProducts.push(productToSave);
      
      // حفظ القائمة المحدثة
  localStorage.setItem('qiq_staged_items', JSON.stringify(existingProducts));
      
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

      // تحقق من القيم الأساسية
      if (!payload.name) {
        showNotification("يجب أن يحتوي المنتج على اسم", "error");
        return;
      }

      // معالجة خاصة لمنتجات Palo Alto
      if (!payload.pn && payload.objectID) {
        payload.pn = payload.objectID;
      }

      // تأكد من وجود رقم تعريفي (PN أو SKU)
      if (!payload.pn && !payload.sku) {
        showNotification("يجب أن يحتوي المنتج على رقم تعريفي (PN أو SKU)", "error");
        return;
      }

      if (!payload.image) {
        payload.image = "https://via.placeholder.com/68?text=IMG";
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

  addAllBtn?.addEventListener('click', function() {
    const products = [];
    tbody.querySelectorAll('tr').forEach(tr => {
      const name = tr.querySelector('.in-desc')?.value || '';
      const pn = tr.querySelector('.in-pn')?.value || '';
      const price = tr.querySelector('.in-unit')?.value || '';
      const qty = tr.querySelector('.in-qty')?.value || '1';
      const manufacturer = tr.querySelector('.in-manufacturer')?.value || '';
      products.push({ name, pn, price, qty, manufacturer });
    });
    localStorage.setItem('qiq_staged_items', JSON.stringify(products));
    showNotification('تم حفظ كل المنتجات في قائمة عرض السعر. يمكنك الآن الانتقال لصفحة عرض السعر.', 'success');
  });

})();
