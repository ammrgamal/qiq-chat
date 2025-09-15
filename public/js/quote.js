(function () {
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

  // ===== Elements =====
  const logoEl = $("qo-logo");
  const quoteNoEl = $("qo-number");
  const quoteDateViewEl = $("qo-date");
  const currencyViewEl = $("qo-currency-view");

  // Basket table elements
  const basketBody = $("basket-body");
  const basketStatusEl = $("basket-status");
  
  // Manual items table elements
  const itemsBody = $("items-body");
  
  // Total cells
  const subtotalCell = $("subtotal-cell");
  const installCell = $("install-cell");
  const grandCell = $("grand-cell");

  // ===== Init header =====
  const STATE_KEY = "qiq_quote_state_v1";

  const state = loadState() || {};
  const number = state.number || `Q-${new Date().getFullYear()}-${uid()}`;
  const dateISO = state.date || todayISO();

  quoteNoEl.textContent = number;
  $("quote-date").value = dateISO;
  quoteDateViewEl.textContent = dateISO;

  const defaultLogo = (state.logo || "/public/logo.png");
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

  // ===== Basket Management =====
  function loadBasketItems() {
    if (!window.qiqBasket) {
      console.warn('Basket not available');
      return;
    }

    const items = window.qiqBasket.getItems();
    basketBody.innerHTML = '';

    if (items.length === 0) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = `
        <td colspan="6" style="text-align:center; color:var(--muted); padding:20px">
          لا توجد عناصر في السلة. <a href="../index.html" style="color:var(--accent)">العودة للصفحة الرئيسية</a> لإضافة منتجات.
        </td>
      `;
      basketBody.appendChild(emptyRow);
      updateBasketStatus(0);
      return;
    }

    items.forEach((item, index) => {
      const row = createBasketRow(item, index);
      basketBody.appendChild(row);
    });

    updateBasketStatus(items.length);
    recalcTotals();
  }

  function createBasketRow(item, index) {
    const tr = document.createElement('tr');
    tr.dataset.key = item.getKey();
    tr.dataset.index = index;

    tr.innerHTML = `
      <td>
        <img class="item-img" src="${item.image || 'https://via.placeholder.com/40x40?text=IMG'}" 
             alt="${item.name}" onerror="this.src='https://via.placeholder.com/40x40?text=IMG'" />
      </td>
      <td>
        <div class="product-info">${esc(item.name)}</div>
        ${item.pn ? `<div class="product-badge">SKU: ${esc(item.pn)}</div>` : ''}
        ${item.link ? `<div style="margin-top:4px"><a href="${esc(item.link)}" target="_blank" rel="noopener" style="color:var(--accent);font-size:12px">View details</a></div>` : ''}
        <div class="product-badge" style="background:#f5f5f5">Source: ${esc(item.source)}</div>
      </td>
      <td style="text-align:center">
        ${item.formatPrice(getCurrency())}
      </td>
      <td>
        <input type="number" class="qty-input basket-qty" min="1" max="9999" 
               value="${item.qty}" data-key="${item.getKey()}" />
      </td>
      <td class="line-total" style="text-align:center; font-weight:600">
        ${fmt(item.lineTotal, getCurrency())}
      </td>
      <td class="no-print">
        <div class="actions">
          <button class="btn btn-danger basket-remove" type="button" 
                  data-key="${item.getKey()}" title="حذف من السلة">
            Remove
          </button>
        </div>
      </td>
    `;

    return tr;
  }

  function updateBasketStatus(count) {
    if (basketStatusEl) {
      basketStatusEl.textContent = count > 0 ? `${count} items in basket` : 'Basket is empty';
    }
  }

  // ===== Manual Items Management =====
  function addManualRow({ desc = '', pn = '', unit = 0, qty = 1 } = {}) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <input class="in-desc" placeholder="الوصف" value="${esc(desc)}" style="width:100%; margin-bottom:4px" />
        <input class="in-pn" placeholder="PN/SKU (اختياري)" value="${esc(pn)}" style="width:100%; font-size:12px" />
      </td>
      <td><input class="in-unit" type="number" min="0" step="0.01" value="${Number(unit)||0}" style="width:100%"></td>
      <td><input class="in-qty" type="number" min="1" step="1" value="${Number(qty)||1}" style="width:100%"></td>
      <td class="line-total" style="text-align:center; font-weight:600">-</td>
      <td class="no-print">
        <div class="actions">
          <button class="btn btn-primary" type="button" onclick="duplicateRow(this)">تكرار</button>
          <button class="btn btn-danger" type="button" onclick="removeRow(this)">حذف</button>
        </div>
      </td>
    `;
    itemsBody.appendChild(tr);

    const inputs = tr.querySelectorAll("input");
    inputs.forEach(inp => inp.addEventListener("input", () => { 
      updateManualRowTotal(tr);
      recalcTotals(); 
      saveState(); 
    }));

    updateManualRowTotal(tr);
    return tr;
  }

  function updateManualRowTotal(row) {
    const unit = num(row.querySelector(".in-unit")?.value);
    const qty = Math.max(1, parseInt(row.querySelector(".in-qty")?.value || "1", 10));
    const line = unit * qty;
    row.querySelector(".line-total").textContent = line ? fmt(line, getCurrency()) : "-";
  }

  // Global functions for manual row management
  window.duplicateRow = function(btn) {
    const tr = btn.closest('tr');
    const desc = tr.querySelector(".in-desc").value || "";
    const pn = tr.querySelector(".in-pn").value || "";
    const unit = Number(tr.querySelector(".in-unit").value || 0);
    const qty = Number(tr.querySelector(".in-qty").value || 1);
    
    addManualRow({ desc, pn, unit, qty });
    recalcTotals();
    saveState();
  };

  window.removeRow = function(btn) {
    const tr = btn.closest('tr');
    tr.remove();
    recalcTotals();
    saveState();
  };

  // ===== Total Calculations =====
  function recalcTotals() {
    const cur = getCurrency();
    let basketSubtotal = 0;
    let manualSubtotal = 0;

    // Calculate basket items total
    if (window.qiqBasket) {
      basketSubtotal = window.qiqBasket.getGrandTotal();
    }

    // Calculate manual items total
    itemsBody.querySelectorAll("tr").forEach(tr => {
      const unit = num(tr.querySelector(".in-unit")?.value);
      const qty = Math.max(1, parseInt(tr.querySelector(".in-qty")?.value || "1", 10));
      manualSubtotal += unit * qty;
      updateManualRowTotal(tr);
    });

    const subtotal = basketSubtotal + manualSubtotal;
    subtotalCell.textContent = fmt(subtotal, cur);

    let install = 0;
    if ($("include-install").checked) {
      install = +(subtotal * 0.05).toFixed(2);
    }
    installCell.textContent = fmt(install, cur);

    const grand = subtotal + install;
    grandCell.textContent = fmt(grand, cur);
  }

  // ===== Event Handlers =====
  $("currency").addEventListener("change", () => {
    currencyViewEl.textContent = getCurrency();
    recalcTotals();
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
  $("include-install").addEventListener("change", () => { recalcTotals(); saveState(); });

  // Basket event delegation
  if (basketBody) {
    basketBody.addEventListener('input', (e) => {
      if (e.target.classList.contains('basket-qty')) {
        const key = e.target.dataset.key;
        const newQty = parseInt(e.target.value) || 1;
        
        if (window.qiqBasket) {
          window.qiqBasket.updateItemQuantity(key, newQty);
          recalcTotals();
        }
      }
    });

    basketBody.addEventListener('click', (e) => {
      if (e.target.classList.contains('basket-remove')) {
        const key = e.target.dataset.key;
        
        if (window.qiqBasket && confirm('هل تريد حذف هذا العنصر من السلة؟')) {
          window.qiqBasket.removeItem(key);
          loadBasketItems();
          recalcTotals();
        }
      }
    });
  }

  // Button handlers
  $("btn-back-home").addEventListener("click", () => {
    window.location.href = '../index.html';
  });

  $("btn-clear-basket").addEventListener("click", () => {
    if (confirm('هل تريد تفريغ السلة بالكامل؟ هذا الإجراء لا يمكن التراجع عنه.')) {
      if (window.qiqBasket) {
        window.qiqBasket.clearBasket();
        loadBasketItems();
        recalcTotals();
      }
    }
  });

  $("btn-reload-basket").addEventListener("click", () => {
    loadBasketItems();
  });

  $("btn-add-manual").addEventListener("click", () => {
    addManualRow();
    recalcTotals();
  });

  $("btn-add-row").addEventListener("click", () => {
    addManualRow();
    recalcTotals();
  });

  $("btn-generate").addEventListener("click", () => {
    recalcTotals();
  });

  $("btn-print").addEventListener("click", () => {
    recalcTotals();
    window.print();
  });

  $("btn-save").addEventListener("click", () => {
    saveState(true);
    if (window.qiqBasket) {
      window.qiqBasket.saveItems();
    }
    alert("تم حفظ المسودة محليًا.");
  });

  $("btn-request-special").addEventListener("click", async () => {
    const payload = buildPayload({ reason: "special-price" });
    showPayloadPreview(payload);
    try {
      const r = await fetch("/api/special-quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (r.ok) alert("تم إرسال طلب السعر المُخصّص. سنتواصل معك للتحقق.");
      else alert("تعذر الإرسال (API).");
    } catch (err) {
      alert("تعذر الاتصال بالخادم.");
    }
  });

  $("btn-submit").addEventListener("click", async () => {
    const payload = buildPayload({ reason: "standard-quote" });
    showPayloadPreview(payload);
    try {
      const r = await fetch("/api/special-quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (r.ok) alert("تم إرسال طلب عرض السعر.");
      else alert("تعذر الإرسال (API).");
    } catch (err) {
      alert("تعذر الاتصال بالخادم.");
    }
  });

  // ===== Functions =====
  function buildPayload(extra) {
    const basketItems = [];
    const manualItems = [];

    // Add basket items
    if (window.qiqBasket) {
      window.qiqBasket.getItems().forEach(item => {
        basketItems.push({
          description: item.name,
          pn: item.pn,
          unit_price: item.unitPrice,
          qty: item.qty,
          source: item.source
        });
      });
    }

    // Add manual items
    itemsBody.querySelectorAll("tr").forEach(tr => {
      manualItems.push({
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
      basket_items: basketItems,
      manual_items: manualItems
    };
    return payload;
  }

  function showPayloadPreview(payload) {
    try { $("payload-preview").textContent = JSON.stringify(payload, null, 2); } catch {}
  }

  function saveState(notify) {
    const manualItems = [];
    itemsBody.querySelectorAll("tr").forEach(tr => {
      manualItems.push({
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
      manual_items: manualItems
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(s));
    if (notify) console.log("Quote state saved.");
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function num(v) {
    return Number(String(v || "0").replace(/[^\d.]/g, "")) || 0;
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  // ===== Initialize =====
  // Load saved manual items
  const savedState = loadState();
  if (savedState && savedState.manual_items) {
    savedState.manual_items.forEach(item => addManualRow(item));
  }

  // Load basket items
  setTimeout(() => {
    loadBasketItems();
    recalcTotals();
  }, 100); // Small delay to ensure basket is loaded

})();