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

  // Clear quotation functionality
  function clearQuotation() {
    if (tbody && confirm('Are you sure you want to clear all items from the quotation?')) {
      tbody.innerHTML = '';
      recalcTotals();
      
      // Show success message
      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed; 
        top: 20px; 
        right: 20px; 
        background: #dc2626; 
        color: white; 
        padding: 12px 16px; 
        border-radius: 8px; 
        box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
        z-index: 10000;
        font-weight: 500;
      `;
      toast.textContent = 'Quotation cleared successfully';
      document.body.appendChild(toast);
      
      setTimeout(() => {
        toast.remove();
      }, 3000);
    }
  }

  // Add clear quotation button to the interface
  function addClearButton() {
    const boqTop = document.querySelector('.qiq-boq-top .qiq-right');
    if (boqTop && !document.getElementById('qiq-clear-btn')) {
      const clearBtn = document.createElement('button');
      clearBtn.id = 'qiq-clear-btn';
      clearBtn.className = 'qiq-btn';
      clearBtn.type = 'button';
      clearBtn.textContent = 'Clear quotation';
      clearBtn.title = 'Clear all items from quotation';
      clearBtn.style.background = '#dc2626';
      clearBtn.style.color = 'white';
      clearBtn.style.borderColor = '#dc2626';
      clearBtn.addEventListener('click', clearQuotation);
      boqTop.insertBefore(clearBtn, boqTop.firstChild);
    }
  }

  // Initialize clear button when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addClearButton);
  } else {
    addClearButton();
  }

  // يبني صف في جدول الكوت
  function buildRow(data){
    if(!tbody) return;

    const sku     = (data.sku || data.pn || "").toString().trim();
    const key     = sku ? sku.toUpperCase() : (data.name||"").toUpperCase();
    if(!key) return;

    // منع التكرار بنفس الـ SKU
    if(tbody.querySelector(`tr[data-key="${CSS.escape(key)}"]`)) {
      // Show message if item already exists
      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed; 
        top: 20px; 
        right: 20px; 
        background: #f59e0b; 
        color: white; 
        padding: 12px 16px; 
        border-radius: 8px; 
        box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
        z-index: 10000;
        font-weight: 500;
      `;
      toast.textContent = 'Item already exists in quotation';
      document.body.appendChild(toast);
      
      setTimeout(() => {
        toast.remove();
      }, 2000);
      return;
    }

    const name    = data.name  || "—";
    const price   = data.price || "";
    const unitNum = numFromPrice(price);
    const img     = data.image || "https://via.placeholder.com/68?text=IMG";
    const link    = data.link  || "";
    const source  = data.source|| "Add";
    const pn      = data.pn    || data.sku || "";
    
    // Format price with $ sign
    const formattedPrice = price ? fmtUSD(price) : "Price on request";

    const tr = document.createElement("tr");
    tr.dataset.unit = price || "";
    tr.dataset.key  = key;
    tr.setAttribute("data-key", key);

    tr.innerHTML = `
      <td><img class="qiq-img" src="${img}" alt="${name}" onerror="this.src='https://via.placeholder.com/68?text=IMG'" style="width: 64px; height: 64px; object-fit: contain;"></td>
      <td>
        ${link?`<a class="qiq-link" target="_blank" rel="noopener" href="${link}"><strong>${name}</strong></a>`:`<strong>${name}</strong>`}
        ${pn? `<div class="qiq-chip"><strong>PN/SKU: ${pn}</strong></div>` : ""}
        <div class="qiq-chip" style="background:#f5f5f5;border-color:#e5e7eb">Source: ${source}</div>
      </td>
      <td><strong>${formattedPrice}</strong></td>
      <td class="qiq-line"><strong>${unitNum? fmtUSD(unitNum*1) : "Price on request"}</strong></td>
      <td>
        <div class="qiq-actions-row">
          <input type="number" min="1" step="1" value="1" class="qiq-qty" title="Quantity">
          <button class="qiq-btn" type="button" data-detail-sku="${sku}" title="View product details">Product details</button>
          <button class="qiq-btn qiq-primary" type="button" data-sku="${sku}" data-slug="" title="Add to quotation form">Add to quotation</button>
          <button class="qiq-btn" type="button" onclick="removeFromQuotation(this)" title="Remove from quotation" style="background: #dc2626; color: white; border-color: #dc2626;">Remove</button>
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
        
        // Show success message
        const toast = document.createElement('div');
        toast.style.cssText = `
          position: fixed; 
          top: 20px; 
          right: 20px; 
          background: #059669; 
          color: white; 
          padding: 12px 16px; 
          border-radius: 8px; 
          box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
          z-index: 10000;
          font-weight: 500;
        `;
        toast.textContent = 'Added to quotation form successfully';
        document.body.appendChild(toast);
        
        setTimeout(() => {
          toast.remove();
        }, 3000);
      } catch {
        btn.textContent = "Error";
      } finally {
        setTimeout(()=>{ btn.textContent = old; btn.disabled = false; }, 900);
      }
    });

    tbody.appendChild(tr);
    recalcTotals();
  }

  // Remove item from quotation
  window.removeFromQuotation = function(btn) {
    const tr = btn.closest('tr');
    if (tr && confirm('Remove this item from quotation?')) {
      tr.remove();
      recalcTotals();
      
      // Show success message
      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed; 
        top: 20px; 
        right: 20px; 
        background: #dc2626; 
        color: white; 
        padding: 12px 16px; 
        border-radius: 8px; 
        box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
        z-index: 10000;
        font-weight: 500;
      `;
      toast.textContent = 'Item removed from quotation';
      document.body.appendChild(toast);
      
      setTimeout(() => {
        toast.remove();
      }, 2000);
    }
  };

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
      if(!tbody){ 
        const toast = document.createElement('div');
        toast.style.cssText = `
          position: fixed; 
          top: 20px; 
          right: 20px; 
          background: #dc2626; 
          color: white; 
          padding: 12px 16px; 
          border-radius: 8px; 
          box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
          z-index: 10000;
          font-weight: 500;
        `;
        toast.textContent = 'Quotation table not found';
        document.body.appendChild(toast);
        
        setTimeout(() => {
          toast.remove();
        }, 2000);
        return; 
      }
      let payload = null;

      if (arg && typeof arg === "object" && !(arg instanceof Element)) {
        payload = arg;
      } else if (arg instanceof Element) {
        payload = dataFromElement(arg);
      } else {
        const toast = document.createElement('div');
        toast.style.cssText = `
          position: fixed; 
          top: 20px; 
          right: 20px; 
          background: #dc2626; 
          color: white; 
          padding: 12px 16px; 
          border-radius: 8px; 
          box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
          z-index: 10000;
          font-weight: 500;
        `;
        toast.textContent = 'Invalid AddToQuote call';
        document.body.appendChild(toast);
        
        setTimeout(() => {
          toast.remove();
        }, 2000);
        return;
      }

      buildRow(payload);
      // تمرير تلقائي إلى جدول البنود بعد الإضافة
      if (tbody) {
        tbody.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      
      // Show success message
      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed; 
        top: 20px; 
        right: 20px; 
        background: #059669; 
        color: white; 
        padding: 12px 16px; 
        border-radius: 8px; 
        box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
        z-index: 10000;
        font-weight: 500;
      `;
      toast.textContent = 'Product added to quotation successfully';
      document.body.appendChild(toast);
      
      setTimeout(() => {
        toast.remove();
      }, 3000);
    }catch(e){
      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed; 
        top: 20px; 
        right: 20px; 
        background: #dc2626; 
        color: white; 
        padding: 12px 16px; 
        border-radius: 8px; 
        box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
        z-index: 10000;
        font-weight: 500;
      `;
      toast.textContent = 'Error adding product to quotation';
      document.body.appendChild(toast);
      
      setTimeout(() => {
        toast.remove();
      }, 3000);
      console.warn(e);
    }
  };
})();
