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
    // حاول تحميل من localStorage (مُدخلة من صفحة الشات)
    try {
      const stagedRaw = localStorage.getItem(STAGED_KEY);
      if (stagedRaw) {
        const staged = JSON.parse(stagedRaw);
        // توقع شكل: [{name, pn, unitPrice, qty}, ...]
        (staged || []).forEach((it) => {
          addRowFromData({
            desc: it.Name || it.name || "—",
            pn: it.PN_SKU || it.pn || it.sku || "",
            unit: num(it.UnitPrice || it.unitPrice || it.price || 0),
            qty: Number(it.Qty || it.qty || 1)
          });
        });
      } else {
        // صف فارغ كبداية
        addRowFromData({ desc: "", pn: "", unit: 0, qty: 1 });
      }
    } catch {
      addRowFromData({ desc: "", pn: "", unit: 0, qty: 1 });
    }
  }

  recalcTotals();

  // ===== Events =====
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

  $("btn-add-row").addEventListener("click", (e) => {
    e.preventDefault();
    addRowFromData({ desc: "", pn: "", unit: 0, qty: 1 });
    recalcTotals();
  });

  $("btn-load-staged").addEventListener("click", (e) => {
    e.preventDefault();
    // دمج بدون مسح القديم
    try {
      const stagedRaw = localStorage.getItem(STAGED_KEY);
      if (!stagedRaw) return alert("لا يوجد عناصر Staged مخزنة.");
      const staged = JSON.parse(stagedRaw) || [];
      staged.forEach((it) => {
        addRowFromData({
          desc: it.Name || it.name || "—",
          pn: it.PN_SKU || it.pn || it.sku || "",
          unit: num(it.UnitPrice || it.unitPrice || it.price || 0),
          qty: Number(it.Qty || it.qty || 1)
        });
      });
      recalcTotals();
    } catch (err) {
      console.warn(err);
      alert("تعذر تحميل البنود من التخزين المحلي.");
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
    alert("تم حفظ المسودة محليًا.");
  });

  $("btn-request-special").addEventListener("click", async (e) => {
    e.preventDefault();
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

  $("btn-submit").addEventListener("click", async (e) => {
    e.preventDefault();
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
  function addRowFromData({ desc, pn, unit, qty }) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <input class="in-desc" placeholder="الوصف" value="${esc(desc)}" />
        <div class="muted"><input class="in-pn" placeholder="PN/SKU (اختياري)" value="${esc(pn)}" /></div>
      </td>
      <td><input class="in-unit" type="number" min="0" step="0.01" value="${Number(unit)||0}"></td>
      <td><input class="in-qty" type="number" min="1" step="1" value="${Number(qty)||1}"></td>
      <td class="line-total">-</td>
      <td class="no-print">
        <button class="btn btn-primary btn-dup">تكرار</button>
        <button class="btn btn-danger btn-del" style="background:#b91c1c">حذف</button>
      </td>
    `;
    itemsBody.appendChild(tr);

    const inUnit = tr.querySelector(".in-unit");
    const inQty = tr.querySelector(".in-qty");
    const inputs = tr.querySelectorAll("input");
    inputs.forEach(inp => inp.addEventListener("input", () => { recalcTotals(); saveState(); }));

    tr.querySelector(".btn-del").addEventListener("click", (e) => {
      e.preventDefault();
      tr.remove();
      recalcTotals();
      saveState();
    });
    tr.querySelector(".btn-dup").addEventListener("click", (e) => {
      e.preventDefault();
      addRowFromData({
        desc: tr.querySelector(".in-desc").value || "",
        pn: tr.querySelector(".in-pn").value || "",
        unit: Number(inUnit.value || 0),
        qty: Number(inQty.value || 1)
      });
      recalcTotals();
      saveState();
    });
  }

  function recalcTotals() {
    const cur = getCurrency();
    let subtotal = 0;
    itemsBody.querySelectorAll("tr").forEach(tr => {
      const unit = num(tr.querySelector(".in-unit")?.value);
      const qty  = Math.max(1, parseInt(tr.querySelector(".in-qty")?.value || "1", 10));
      const line = unit * qty;
      tr.querySelector(".line-total").textContent = line ? fmt(line, cur) : "-";
      subtotal += line;
    });
    subtotalCell.textContent = fmt(subtotal, cur);

    let install = 0;
    if ($("include-install").checked) {
      install = +(subtotal * 0.05).toFixed(2);
    }
    installCell.textContent = fmt(install, cur);

    const grand = subtotal + install;
    grandCell.textContent = fmt(grand, cur);
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
      items
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(s));
    if (notify) console.log("Saved.");
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function num(v) {
    return Number(String(v || "0").replace(/[^\d.]/g, "")) || 0;
    // (ملاحظة) لو محتاج تدعم فواصل عربية، أضف استبدالات إضافية.
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }
})();
