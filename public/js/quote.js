(function () {
  // ===== Global variables =====
  let isLoading = false;
  let filteredRows = [];

  // ===== Helpers =====
  const $ = (id) => document.getElementById(id);
  const fmt = (v, cur) => {
    const n = Number(v || 0);
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: cur || getCurrency(),
        maximumFractionDigits: 2
      }).format(n);
    } catch {
      return `${n.toFixed(2)} ${cur || ""}`.trim();
    }
  };
  const getCurrency = () => $("currency").value || "USD";
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const uid = () => Math.random().toString(36).slice(2, 8).toUpperCase();

  // ===== Enhanced UI Helpers =====
  const showNotification = (message, type = 'info') => {
    // Use the global toast system if available
    if (window.QiqToast && window.QiqToast.show) {
      window.QiqToast.show(message, type);
    } else {
      // Fallback notification system
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

  const updateEmptyState = () => {
    const emptyState = $("empty-state");
    const proceedCta = $("proceed-cta");
    const tableWrap = document.querySelector(".table-wrap");
    const rowCount = itemsBody.querySelectorAll("tr").length;
    
    if (rowCount === 0 || (rowCount === 1 && !hasValidData())) {
      if (emptyState) {
        emptyState.style.display = "block";
        tableWrap.style.display = "none";
      }
      if (proceedCta) proceedCta.style.display = "none";
    } else {
      if (emptyState) {
        emptyState.style.display = "none";
        tableWrap.style.display = "block";
      }
      if (proceedCta) proceedCta.style.display = "block";
    }
  };

  const hasValidData = () => {
    const rows = itemsBody.querySelectorAll("tr");
    for (let row of rows) {
      const desc = row.querySelector(".in-desc")?.value?.trim();
      const unit = row.querySelector(".in-unit")?.value?.trim();
      if (desc && desc !== "" && unit && parseFloat(unit) > 0) {
        return true;
      }
    }
    return false;
  };

  const setLoadingState = (button, loading = true) => {
    if (loading) {
      button.disabled = true;
      button.innerHTML = '<span class="loading-spinner"></span>' + button.textContent;
    } else {
      button.disabled = false;
      button.innerHTML = button.textContent.replace(/^.*?>/, '');
    }
  };

  const confirmAction = (message) => {
    return window.confirm(message);
  };

  // ===== Elements =====
  const logoEl = $("qo-logo");
  const quoteNoEl = $("qo-number");
  const quoteDateViewEl = $("qo-date");
  const currencyViewEl = $("qo-currency-view");

  const itemsBody = $("items-body");
  const subtotalCell = $("subtotal-cell");
  const installCell = $("install-cell");
  const grandCell = $("grand-cell");

  // ===== Init header =====
  const STATE_KEY = "qiq_quote_state_v1";
  const STAGED_KEY = "qiq_staged_items"; // توقعنا من صفحة الشات لو بتخزن العناصر

  const state = loadState() || {};
  const number = state.number || `Q-${new Date().getFullYear()}-${uid()}`;
  const dateISO = state.date || todayISO();

  quoteNoEl.textContent = number;
  $("quote-date").value = dateISO;
  quoteDateViewEl.textContent = dateISO;

  const defaultLogo = (state.logo || "/logo.png"); // غيّر المسار حسب مشروعك
  logoEl.src = defaultLogo;
  logoEl.onerror = () => (logoEl.src = "https://via.placeholder.com/200x80?text=LOGO");

  // Prefill currency
  $("currency").value = state.currency || "USD";
  currencyViewEl.textContent = $("currency").value;

  // Prefill client/project if saved
  $("client-name").value = state.client_name || "";
  $("client-contact").value = state.client_contact || "";
  $("client-email").value = state.client_email || "";
  $("client-phone").value = state.client_phone || "";
  $("project-name").value = state.project_name || "";
  $("project-owner").value = state.project_owner || "";
  $("main-contractor").value = state.main_contractor || "";
  $("site-location").value = state.site_location || "";
  $("need-assist").checked = !!state.need_assist;

  $("payment-terms").value = state.payment_terms || $("payment-terms").value;
  $("terms").value = state.terms || $("terms").value;

  $("include-install").checked = !!state.include_install;

  // ===== Items table =====
  const savedItems = state.items || [];
  if (savedItems.length) {
    savedItems.forEach(addRowFromData);
  } else {
    // لو مفيش state محفوظ، جرّب تحميل العناصر اللى اتخزنت مؤقتًا من الشات
    try {
      const stagedRaw = localStorage.getItem(STAGED_KEY);
      const staged = stagedRaw ? JSON.parse(stagedRaw) : [];
      if (Array.isArray(staged) && staged.length) {
        let imported = 0;
        staged.forEach((it) => {
          addRowFromData({
            desc: it.Name || it.name || "—",
            pn: it.PN_SKU || it.pn || it.sku || "",
            unit: num(it.UnitPrice || it.unitPrice || it.price || 0),
            qty: Number(it.Qty || it.qty || 1),
            manufacturer: it.manufacturer || it.brand || it.vendor || ""
          });
          imported++;
        });
        if (imported > 0) {
          recalcTotals();
          updateEmptyState();
          showNotification(`تم استيراد ${imported} عنصر من صفحة الشات`, "success");
          // خزّن كمسوّدة فورًا حتى لا يحصل تكرار عند إعادة التحميل
          saveState();
        }
      } else {
        // لا يوجد staged → أضف صف فارغ للمستخدم
        addRowFromData({ desc: "", pn: "", unit: 0, qty: 1 });
      }
    } catch (err) {
      console.warn("Failed to auto-import staged items:", err);
      addRowFromData({ desc: "", pn: "", unit: 0, qty: 1 });
    }
  }

  recalcTotals();
  updateEmptyState();

  // ===== Events =====
  $("currency").addEventListener("change", async () => {
    currencyViewEl.textContent = getCurrency();
    await recalcTotals(); // Make it async
    saveState();
  });
  $("quote-date").addEventListener("change", () => {
    quoteDateViewEl.textContent = $("quote-date").value || todayISO();
    saveState();
  });
  ["client-name","client-contact","client-email","client-phone","project-name","project-owner","main-contractor","site-location"]
    .forEach(id => $(id).addEventListener("input", saveState));
  $("need-assist").addEventListener("change", saveState);

  $("payment-terms").addEventListener("input", saveState);
  $("terms").addEventListener("input", saveState);
  $("include-install").addEventListener("change", async () => { 
    await recalcTotals(); // Make it async
    saveState(); 
  });

  $("btn-add-row").addEventListener("click", (e) => {
    e.preventDefault();
    addRowFromData({ desc: "", pn: "", unit: 0, qty: 1 });
    recalcTotals();
    showNotification("Product added! You can add more or proceed.", "success");
  });

  $("btn-load-staged").addEventListener("click", (e) => {
    e.preventDefault();
    // دمج بدون مسح القديم
    try {
      const stagedRaw = localStorage.getItem(STAGED_KEY);
      if (!stagedRaw) return showNotification("لا يوجد عناصر Staged مخزنة", "error");
      const staged = JSON.parse(stagedRaw) || [];
      let loadedCount = 0;
      const existingKeys = new Set(
        Array.from(itemsBody.querySelectorAll('tr')).map(tr => tr.querySelector('.in-pn')?.value?.toUpperCase() || '')
      );
      staged.forEach((it) => {
        const pn = (it.PN_SKU || it.pn || it.sku || '').toString().toUpperCase();
        if (pn && existingKeys.has(pn)) return; // تجنب التكرار
        addRowFromData({
          desc: it.Name || it.name || "—",
          pn: it.PN_SKU || it.pn || it.sku || "",
          unit: num(it.UnitPrice || it.unitPrice || it.price || 0),
          qty: Number(it.Qty || it.qty || 1),
          manufacturer: it.manufacturer || it.brand || it.vendor || ""
        });
        if (pn) existingKeys.add(pn);
        loadedCount++;
      });
      recalcTotals();
      updateEmptyState();
      showNotification(`تم تحميل ${loadedCount} عنصر من الشات`, "success");
    } catch (err) {
      console.warn(err);
      showNotification("تعذر تحميل البنود من التخزين المحلي", "error");
    }
  });

  $("btn-generate").addEventListener("click", (e) => {
    e.preventDefault();
    recalcTotals();
  });

  $("btn-print").addEventListener("click", (e) => {
    e.preventDefault();
    recalcTotals();
    window.print();
  });

  $("btn-save").addEventListener("click", (e) => {
    e.preventDefault();
    saveState(true);
    showNotification("تم حفظ المسودة محليًا", "success");
  });

  $("btn-request-special").addEventListener("click", async (e) => {
    e.preventDefault();
    const payload = buildPayload({ reason: "special-price" });
    showPayloadPreview(payload);
    setLoadingState(e.target, true);
    try {
      const r = await fetch("/api/special-quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (r.ok) {
        showNotification("تم إرسال طلب السعر المُخصّص. سنتواصل معك للتحقق", "success");
      } else {
        showNotification("تعذر الإرسال (API)", "error");
      }
    } catch (err) {
      showNotification("تعذر الاتصال بالخادم", "error");
    } finally {
      setLoadingState(e.target, false);
    }
  });

  $("btn-submit").addEventListener("click", async (e) => {
    e.preventDefault();
    const payload = buildPayload({ reason: "standard-quote" });
    showPayloadPreview(payload);
    setLoadingState(e.target, true);
    try {
      const r = await fetch("/api/special-quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (r.ok) {
        showNotification("تم إرسال طلب عرض السعر بنجاح", "success");
      } else {
        showNotification("تعذر الإرسال (API)", "error");
      }
    } catch (err) {
      showNotification("تعذر الاتصال بالخادم", "error");
    } finally {
      setLoadingState(e.target, false);
    }
  });

  // ===== New Event Handlers =====
  
  // Proceed to Request Quote CTA
  const proceedBtn = $("btn-proceed-quote");
  if (proceedBtn) {
    proceedBtn.addEventListener("click", (e) => {
      e.preventDefault();
      // Scroll to the actions section
      const actionsSection = document.querySelector(".card.no-print");
      if (actionsSection) {
        actionsSection.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      showNotification("Complete the client details above, then submit your quote request.", "info");
    });
  }
  
  // Clear All Button
  $("btn-clear-all").addEventListener("click", (e) => {
    e.preventDefault();
    if (confirmAction("هل أنت متأكد من حذف جميع البنود؟ هذا الإجراء لا يمكن التراجع عنه.")) {
      const tbody = $("items-body");
      tbody.innerHTML = '';
      addRowFromData({ desc: "", pn: "", unit: 0, qty: 1 }); // Add one empty row
      recalcTotals();
      saveState();
      updateEmptyState();
      showNotification("Add products to start your quote.", "info");
    }
  });

  // Export Excel Button
  $("btn-export-excel").addEventListener("click", (e) => {
    e.preventDefault();
    setLoadingState(e.target, true);
    try {
      exportToExcel();
      showNotification("تم تصدير الملف بنجاح", "success");
    } catch (error) {
      showNotification("حدث خطأ أثناء التصدير", "error");
    } finally {
      setLoadingState(e.target, false);
    }
  });

  // Export CSV Button
  $("btn-export-csv").addEventListener("click", (e) => {
    e.preventDefault();
    setLoadingState(e.target, true);
    try {
      exportToCSV();
      showNotification("تم تصدير الملف بنجاح", "success");
    } catch (error) {
      showNotification("حدث خطأ أثناء التصدير", "error");
    } finally {
      setLoadingState(e.target, false);
    }
  });

  // Import Excel Button
  $("btn-import-excel").addEventListener("click", (e) => {
    e.preventDefault();
    $("excel-file-input").click();
  });

  $("excel-file-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      setLoadingState($("btn-import-excel"), true);
      importFromExcel(file);
    }
  });

  // Search functionality
  $("search-input").addEventListener("input", (e) => {
    filterTable(e.target.value);
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey) {
      switch(e.key.toLowerCase()) {
        case 'e':
          e.preventDefault();
          $("btn-export-excel").click();
          break;
        case 's':
          e.preventDefault();
          $("btn-save").click();
          break;
        case 'p':
          e.preventDefault();
          $("btn-print").click();
          break;
      }
    }
  });

  // ===== Enhanced Functions =====
  function addRowFromData({ desc, pn, unit, qty, manufacturer, brand }) {
    const tr = document.createElement("tr");
    const id = `row-${uid()}`;
    tr.id = id;
    tr.dataset.basePrice = unit || 0; // Store base price in USD

    // Create the enhanced product description combining name, brand, and PN
    const productName = desc || "";
    const productBrand = manufacturer || brand || "";
    const productPN = pn || "";
    
    let descriptionHTML = `<div class="product-desc">`;
    descriptionHTML += `<span class="product-name">${esc(productName)}</span>`;
    
    if (productBrand || productPN) {
      descriptionHTML += `<div class="product-details">`;
      if (productBrand && productPN) {
        descriptionHTML += `<span class="product-pn">(PN: ${esc(productPN)})</span> - <span class="product-brand">${esc(productBrand)}</span>`;
      } else if (productBrand) {
        descriptionHTML += `<span class="product-brand">${esc(productBrand)}</span>`;
      } else if (productPN) {
        descriptionHTML += `<span class="product-pn">PN: ${esc(productPN)}</span>`;
      }
      descriptionHTML += `</div>`;
    }
    descriptionHTML += `</div>`;
    
    tr.innerHTML = `
      <td class="desc-col">
        ${descriptionHTML}
        <input class="in-desc" type="hidden" value="${esc(desc)}" />
        <input class="in-pn" type="hidden" value="${esc(pn)}" />
        <input class="in-brand" type="hidden" value="${esc(productBrand)}" />
      </td>
      <td class="qty-col">
        <input class="in-qty qty-input" type="number" min="1" step="1" value="${Number(qty)||1}">
      </td>
      <td class="price-col numeric">
        <input class="in-unit" type="number" min="0" step="0.01" value="${Number(unit)||0}" style="width:100%;text-align:right;border:1px solid #d1d5db;border-radius:4px;padding:4px 6px;">
      </td>
      <td class="total-col numeric line-total">-</td>
      <td class="actions-col no-print">
        <div class="action-icons">
          <button class="action-btn edit btn-edit" title="Edit product details" type="button">✏️</button>
          <button class="action-btn duplicate btn-dup" title="Duplicate this item" type="button">📋</button>
          <button class="action-btn delete btn-del" title="Remove this item" type="button">🗑️</button>
        </div>
      </td>
    `;
    
    itemsBody.appendChild(tr);

    const inUnit = tr.querySelector(".in-unit");
    const inQty = tr.querySelector(".in-qty");
    const inputs = tr.querySelectorAll("input");
    inputs.forEach(inp => inp.addEventListener("input", () => { 
      recalcTotals(); 
      saveState();
      updateEmptyState();
    }));

    tr.querySelector(".btn-del").addEventListener("click", (e) => {
      e.preventDefault();
      const productName = tr.querySelector(".product-name")?.textContent || "Product";
      if (confirmAction(`هل أنت متأكد من حذف "${productName}"؟`)) {
        tr.remove();
        recalcTotals();
        saveState();
        updateEmptyState();
        showNotification("Product removed.", "success");
      }
    });
    
    tr.querySelector(".btn-dup").addEventListener("click", (e) => {
      e.preventDefault();
      addRowFromData({
        desc: tr.querySelector(".in-desc").value || "",
        pn: tr.querySelector(".in-pn").value || "",
        manufacturer: tr.querySelector(".in-brand").value || "",
        unit: Number(inUnit.value || 0),
        qty: Number(inQty.value || 1)
      });
      recalcTotals();
      saveState();
      updateEmptyState();
      showNotification("Product added! You can add more or proceed.", "success");
    });
    
    tr.querySelector(".btn-edit").addEventListener("click", (e) => {
      e.preventDefault();
      editProductInline(tr);
    });

    updateEmptyState();
  }

  function editProductInline(tr) {
    const descCell = tr.querySelector(".desc-col");
    const currentDesc = tr.querySelector(".in-desc").value;
    const currentPN = tr.querySelector(".in-pn").value;
    const currentBrand = tr.querySelector(".in-brand").value;
    
    // Create inline editing form
    descCell.innerHTML = `
      <div class="inline-edit">
        <input class="edit-desc" placeholder="Product description" value="${esc(currentDesc)}" style="width:100%;margin-bottom:4px;padding:4px;border:1px solid #d1d5db;border-radius:4px;">
        <input class="edit-brand" placeholder="Brand/Manufacturer" value="${esc(currentBrand)}" style="width:100%;margin-bottom:4px;padding:4px;border:1px solid #d1d5db;border-radius:4px;font-size:12px;">
        <input class="edit-pn" placeholder="Part Number (PN)" value="${esc(currentPN)}" style="width:100%;margin-bottom:8px;padding:4px;border:1px solid #d1d5db;border-radius:4px;font-size:12px;">
        <div style="display:flex;gap:4px;">
          <button class="btn-save" style="background:#059669;color:white;border:none;padding:4px 8px;border-radius:4px;font-size:11px;cursor:pointer;">💾 Save</button>
          <button class="btn-cancel" style="background:#6b7280;color:white;border:none;padding:4px 8px;border-radius:4px;font-size:11px;cursor:pointer;">❌ Cancel</button>
        </div>
      </div>
    `;
    
    const saveBtn = descCell.querySelector(".btn-save");
    const cancelBtn = descCell.querySelector(".btn-cancel");
    
    const saveEdit = () => {
      const newDesc = descCell.querySelector(".edit-desc").value;
      const newBrand = descCell.querySelector(".edit-brand").value;
      const newPN = descCell.querySelector(".edit-pn").value;
      
      // Update hidden inputs
      tr.querySelector(".in-desc").value = newDesc;
      tr.querySelector(".in-pn").value = newPN;
      tr.querySelector(".in-brand").value = newBrand;
      
      // Rebuild the description display
      rebuildDescriptionDisplay(tr);
      saveState();
      showNotification("Product updated successfully!", "success");
    };
    
    const cancelEdit = () => {
      rebuildDescriptionDisplay(tr);
    };
    
    saveBtn.addEventListener("click", saveEdit);
    cancelBtn.addEventListener("click", cancelEdit);
    
    // Focus on description input
    descCell.querySelector(".edit-desc").focus();
  }

  function rebuildDescriptionDisplay(tr) {
    const descCell = tr.querySelector(".desc-col");
    const desc = tr.querySelector(".in-desc").value;
    const pn = tr.querySelector(".in-pn").value;
    const brand = tr.querySelector(".in-brand").value;
    
    let descriptionHTML = `<div class="product-desc">`;
    descriptionHTML += `<span class="product-name">${esc(desc)}</span>`;
    
    if (brand || pn) {
      descriptionHTML += `<div class="product-details">`;
      if (brand && pn) {
        descriptionHTML += `<span class="product-pn">(PN: ${esc(pn)})</span> - <span class="product-brand">${esc(brand)}</span>`;
      } else if (brand) {
        descriptionHTML += `<span class="product-brand">${esc(brand)}</span>`;
      } else if (pn) {
        descriptionHTML += `<span class="product-pn">PN: ${esc(pn)}</span>`;
      }
      descriptionHTML += `</div>`;
    }
    descriptionHTML += `</div>`;
    
    // Keep the hidden inputs
    descriptionHTML += `
      <input class="in-desc" type="hidden" value="${esc(desc)}" />
      <input class="in-pn" type="hidden" value="${esc(pn)}" />
      <input class="in-brand" type="hidden" value="${esc(brand)}" />
    `;
    
    descCell.innerHTML = descriptionHTML;
  }

  // ===== Currency Conversion =====
  let ratesCache = {};
  const getExchangeRate = async (from, to) => {
    if (from === to) return 1;
    const rateKey = `${from}_${to}`;
    if (ratesCache[rateKey]) return ratesCache[rateKey];

    try {
      const response = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${from.toLowerCase()}.json`);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      const rate = data[from.toLowerCase()][to.toLowerCase()];
      if (!rate) throw new Error(`Rate for ${to} not found`);
      ratesCache[rateKey] = rate;
      return rate;
    } catch (error) {
      console.error("Could not fetch exchange rate:", error);
      showNotification(`Could not fetch exchange rate for ${to}. Using 1:1.`, 'error');
      return 1; // Fallback
    }
  };

  // ===== Recalculate Totals =====
  async function recalcTotals() {
    let sub = 0;
    const toCurrency = getCurrency();
    const rate = await getExchangeRate('USD', toCurrency); // Assuming base currency of items is USD

    itemsBody.querySelectorAll("tr").forEach((row) => {
      const unitEl = row.querySelector(".in-unit");
      const qtyEl = row.querySelector(".in-qty");
      const totalEl = row.querySelector(".line-total");

      if (!unitEl || !qtyEl || !totalEl) return; // guard against partial rows

      const unitPriceUSD = num(row.dataset.basePrice || unitEl.value);
      const qty = num(qtyEl.value);

      const convertedPrice = unitPriceUSD * rate;
      unitEl.value = convertedPrice.toFixed(2); // Update displayed unit price

      const total = convertedPrice * qty;
      totalEl.textContent = fmt(total, toCurrency);
      sub += total;
    });

    subtotalCell.textContent = fmt(sub, toCurrency);
    const installCost = $("include-install").checked ? sub * 0.1 : 0;
    installCell.textContent = fmt(installCost, toCurrency);
    grandCell.textContent = fmt(sub + installCost, toCurrency);
  }

  function buildPayload(extra) {
    const items = [];
    itemsBody.querySelectorAll("tr").forEach(tr => {
      items.push({
        description: tr.querySelector(".in-desc")?.value || "",
        pn: tr.querySelector(".in-pn")?.value || "",
        unit_price: num(tr.querySelector(".in-unit")?.value),
        qty: Math.max(1, parseInt(tr.querySelector(".in-qty")?.value || "1", 10))
      });
    });
    const payload = {
      kind: extra?.reason || "standard-quote",
      number: quoteNoEl.textContent,
      date: $("quote-date").value || todayISO(),
      currency: getCurrency(),
      client: {
        name: $("client-name").value || "",
        contact: $("client-contact").value || "",
        email: $("client-email").value || "",
        phone: $("client-phone").value || ""
      },
      project: {
        name: $("project-name").value || "",
        owner: $("project-owner").value || "",
        main_contractor: $("main-contractor").value || "",
        site: $("site-location").value || ""
      },
      need_assist: $("need-assist").checked,
      payment_terms: $("payment-terms").value || "",
      terms: $("terms").value || "",
      include_installation_5pct: $("include-install").checked,
      items
    };
    return payload;
  }

  function showPayloadPreview(payload) {
    try { $("payload-preview").textContent = JSON.stringify(payload, null, 2); } catch {}
  }

  function saveState(notify) {
    const items = [];
    itemsBody.querySelectorAll("tr").forEach(tr => {
      items.push({
        desc: tr.querySelector(".in-desc")?.value || "",
        pn: tr.querySelector(".in-pn")?.value || "",
        unit: num(tr.querySelector(".in-unit")?.value),
        qty: Math.max(1, parseInt(tr.querySelector(".in-qty")?.value || "1", 10))
      });
    });
    
    const s = {
      number: quoteNoEl.textContent,
      date: $("quote-date").value || todayISO(),
      currency: getCurrency(),
      logo: logoEl.src,
      client_name: $("client-name").value || "",
      client_contact: $("client-contact").value || "",
      client_email: $("client-email").value || "",
      client_phone: $("client-phone").value || "",
      project_name: $("project-name").value || "",
      project_owner: $("project-owner").value || "",
      main_contractor: $("main-contractor").value || "",
      site_location: $("site-location").value || "",
      need_assist: $("need-assist").checked,
      payment_terms: $("payment-terms").value || "",
      terms: $("terms").value || "",
      include_install: $("include-install").checked,
      items,
      // Enhanced draft metadata
      lastModified: new Date().toISOString(),
      userToken: localStorage.getItem("qiq_token") || null,
      isDraft: true,
      version: 1
    };
    
    // Save to localStorage (local draft)
    localStorage.setItem(STATE_KEY, JSON.stringify(s));
    
    // Also save to a separate drafts collection for the user
    saveDraftToCollection(s);
    
    if (notify) {
      console.log("Saved.");
      showNotification("تم حفظ المسودة بنجاح", "success");
    }
  }

  // Enhanced draft management
  function saveDraftToCollection(quoteData) {
    try {
      const userToken = localStorage.getItem("qiq_token");
      if (!userToken) return; // Only save drafts for logged-in users
      
      const draftsKey = `qiq_drafts_${userToken.slice(-10)}`; // Use last 10 chars of token as key
      let drafts = [];
      
      try {
        drafts = JSON.parse(localStorage.getItem(draftsKey) || "[]");
      } catch { drafts = []; }
      
      // Find existing draft by quote number or create new
      const existingIndex = drafts.findIndex(d => d.number === quoteData.number);
      const draftData = {
        ...quoteData,
        id: existingIndex >= 0 ? drafts[existingIndex].id : uid(),
        lastModified: new Date().toISOString()
      };
      
      if (existingIndex >= 0) {
        drafts[existingIndex] = draftData;
      } else {
        drafts.unshift(draftData); // Add to beginning
      }
      
      // Keep only last 10 drafts
      if (drafts.length > 10) {
        drafts = drafts.slice(0, 10);
      }
      
      localStorage.setItem(draftsKey, JSON.stringify(drafts));
    } catch (error) {
      console.warn("Failed to save draft to collection:", error);
    }
  }

  // Function to load user drafts
  function loadUserDrafts() {
    try {
      const userToken = localStorage.getItem("qiq_token");
      if (!userToken) return [];
      
      const draftsKey = `qiq_drafts_${userToken.slice(-10)}`;
      return JSON.parse(localStorage.getItem(draftsKey) || "[]");
    } catch {
      return [];
    }
  }

  // Function to load a specific draft
  function loadDraft(draftId) {
    const drafts = loadUserDrafts();
    const draft = drafts.find(d => d.id === draftId);
    if (draft) {
      // Load the draft data into the form
      restoreState(draft);
      showNotification("تم تحميل المسودة بنجاح", "success");
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function restoreState(state) {
    if (!state) return;
    
    try {
      // Restore form fields
      if (state.client_name) $("client-name").value = state.client_name;
      if (state.client_contact) $("client-contact").value = state.client_contact;
      if (state.client_email) $("client-email").value = state.client_email;
      if (state.client_phone) $("client-phone").value = state.client_phone;
      if (state.project_name) $("project-name").value = state.project_name;
      if (state.project_owner) $("project-owner").value = state.project_owner;
      if (state.main_contractor) $("main-contractor").value = state.main_contractor;
      if (state.site_location) $("site-location").value = state.site_location;
      if (state.quote_date) $("quote-date").value = state.date;
      if (state.currency) $("currency").value = state.currency;
      if (state.payment_terms) $("payment-terms").value = state.payment_terms;
      if (state.terms) $("terms").value = state.terms;
      
      $("need-assist").checked = !!state.need_assist;
      $("include-install").checked = !!state.include_install;
      
      // Restore quote number
      if (state.number) quoteNoEl.textContent = state.number;
      
      // Clear existing items and restore saved items
      itemsBody.innerHTML = '';
      if (state.items && Array.isArray(state.items)) {
        state.items.forEach(item => {
          if (item.desc || item.pn) {
            addRow(item.desc, item.pn, item.unit, item.qty);
          }
        });
      }
      
      recalcTotals();
      showNotification("تم استعادة البيانات المحفوظة", "info");
    } catch (error) {
      console.error("Error restoring state:", error);
      showNotification("خطأ في استعادة البيانات المحفوظة", "error");
    }
  }

  function num(v) {
    return Number(String(v || "0").replace(/[^\d.]/g, "")) || 0;
    // (ملاحظة) لو محتاج تدعم فواصل عربية، أضف استبدالات إضافية.
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  // ===== New Export/Import Functions =====
  
  function exportToExcel() {
    const data = getTableData();
    
    // Check if XLSX library is available
    if (typeof XLSX !== 'undefined') {
      // Use XLSX library
      const ws = XLSX.utils.aoa_to_sheet([
        ['الوصف', 'PN/SKU', 'سعر الوحدة', 'الكمية', 'الإجمالي'],
        ...data.map(row => [row.desc, row.pn, row.unit, row.qty, row.total])
      ]);
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Quote Items");
      
      const filename = `quote-${quoteNoEl.textContent}-${todayISO()}.xlsx`;
      XLSX.writeFile(wb, filename);
    } else {
      // Fallback: Export as Excel-compatible CSV with .xls extension
      const csvContent = [
        ['الوصف', 'PN/SKU', 'سعر الوحدة', 'الكمية', 'الإجمالي'].join('\t'),
        ...data.map(row => [
          row.desc,
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
      link.setAttribute('download', `quote-${quoteNoEl.textContent}-${todayISO()}.xls`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  function exportToCSV() {
    const data = getTableData();
    const csvContent = [
      ['الوصف', 'PN/SKU', 'سعر الوحدة', 'الكمية', 'الإجمالي'].join(','),
      ...data.map(row => [
        `"${row.desc.replace(/"/g, '""')}"`,
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
    link.setAttribute('download', `quote-${quoteNoEl.textContent}-${todayISO()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function importFromExcel(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        if (typeof XLSX !== 'undefined') {
          // Use XLSX library for proper Excel files
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          
          processImportedData(jsonData);
        } else {
          // Fallback: Try to parse as CSV for basic Excel files
          const text = e.target.result;
          const rows = text.split('\n').map(row => 
            row.split(/[,\t]/).map(cell => cell.trim().replace(/"/g, ''))
          );
          processImportedData(rows);
        }
      } catch (error) {
        showNotification("خطأ في قراءة الملف. تأكد من صحة التنسيق", "error");
        console.error('Import error:', error);
      } finally {
        setLoadingState($("btn-import-excel"), false);
        $("excel-file-input").value = ''; // Clear the input
      }
    };

    // Read as array buffer for XLSX, or as text for CSV fallback
    if (typeof XLSX !== 'undefined') {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file, 'UTF-8');
    }
  }

  function processImportedData(jsonData) {
    // Skip header row and process data
    let importedCount = 0;
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (row.length >= 4 && (row[0] || row[1])) { // At least description or PN
        addRowFromData({
          desc: String(row[0] || ''),
          pn: String(row[1] || ''),
          unit: Number(row[2] || 0),
          qty: Number(row[3] || 1)
        });
        importedCount++;
      }
    }
    
    recalcTotals();
    saveState();
    showNotification(`تم استيراد ${importedCount} عنصر بنجاح`, "success");
  }

  function getTableData() {
    const data = [];
    itemsBody.querySelectorAll("tr").forEach(tr => {
      const desc = tr.querySelector(".in-desc")?.value || "";
      const pn = tr.querySelector(".in-pn")?.value || "";
      const unit = num(tr.querySelector(".in-unit")?.value);
      const qty = Math.max(1, parseInt(tr.querySelector(".in-qty")?.value || "1", 10));
      const total = unit * qty;
      
      data.push({ desc, pn, unit, qty, total });
    });
    return data;
  }

  function filterTable(searchTerm) {
    const rows = itemsBody.querySelectorAll("tr");
    const term = searchTerm.toLowerCase();
    
    rows.forEach(row => {
      const desc = (row.querySelector(".in-desc")?.value || "").toLowerCase();
      const pn = (row.querySelector(".in-pn")?.value || "").toLowerCase();
      const shouldShow = !term || desc.includes(term) || pn.includes(term);
      row.style.display = shouldShow ? "" : "none";
    });
  }



  // ===== Image Preview Functions =====
  window.openImagePreview = function(imgSrc) {
    const overlay = $("image-preview-overlay");
    const previewImg = $("preview-image");
    previewImg.src = imgSrc;
    overlay.style.display = "flex";
  };

  window.closeImagePreview = function() {
    const overlay = $("image-preview-overlay");
    overlay.style.display = "none";
  };

  // Load saved state from localStorage on page load
  window.addEventListener('beforeunload', () => {
    saveState();
  });

  // تحميل البنود من الشات تلقائيًا عند فتح صفحة quote
  document.addEventListener('DOMContentLoaded', () => {
    // استخدام نفس المنطق المستخدم في زر "تحميل البنود من الشات"
    try {
      const stagedRaw = localStorage.getItem(STAGED_KEY);
      if (!stagedRaw) return; // لا يوجد عناصر محفوظة، لا نظهر إشعار خطأ
      
      const staged = JSON.parse(stagedRaw) || [];
      let loadedCount = 0;
      staged.forEach((it) => {
        addRowFromData({
          desc: it.Name || it.name || "—",
          pn: it.PN_SKU || it.pn || it.sku || "",
          unit: num(it.UnitPrice || it.unitPrice || it.price || 0),
          qty: Number(it.Qty || it.qty || 1)
        });
        loadedCount++;
      });
      
      if (loadedCount > 0) {
        recalcTotals();
        updateEmptyState();
        showNotification(`تم تحميل ${loadedCount} عنصر من الشات تلقائيًا!`, "success");
      }
    } catch (err) {
      console.warn(err);
      showNotification("خطأ في تحميل البنود من الشات", "error");
    }
  });

})();
