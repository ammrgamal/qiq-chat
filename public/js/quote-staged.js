/* ========================================
   Quote Staged Items Management
   Displays and manages items from qiq_staged_items localStorage
   ======================================== */

(() => {
  /* ---- DOM Elements ---- */
  const stagedBody = document.getElementById("qiq-staged-body");
  const stagedGrand = document.getElementById("qiq-staged-grand");
  const itemsCount = document.getElementById("qiq-items-count");
  const clearAllBtn = document.getElementById("qiq-clear-all");

  /* ---- Helpers ---- */
  const PLACEHOLDER_IMG = "https://via.placeholder.com/40x40?text=IMG";

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#059669' : type === 'error' ? '#dc2626' : '#374151'};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 9999;
      max-width: 300px;
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  function updateTotals() {
    const items = QIQBasket.getItems();
    const count = QIQBasket.getCount();
    const total = QIQBasket.getTotal();

    // Update count display
    if (itemsCount) {
      itemsCount.textContent = `${count} عنصر`;
    }

    // Update grand total
    if (stagedGrand) {
      stagedGrand.textContent = total > 0 ? QIQBasket.formatPrice(total) : '-';
    }

    // Update clear button state
    if (clearAllBtn) {
      clearAllBtn.disabled = items.length === 0;
    }
  }

  function updateLineTotal(tr) {
    const qtyInput = tr.querySelector('.qiq-qty');
    const lineTotalEl = tr.querySelector('.qiq-line-total');
    const priceText = tr.dataset.price || '';
    
    if (!qtyInput || !lineTotalEl) return;
    
    const qty = Math.max(1, parseInt(qtyInput.value || '1', 10));
    const price = parseFloat(String(priceText).replace(/[^\d.]/g, '')) || 0;
    const lineTotal = price * qty;
    
    lineTotalEl.textContent = lineTotal > 0 ? QIQBasket.formatPrice(lineTotal) : '-';
    updateTotals();
  }

  function buildStagedRow(item) {
    const tr = document.createElement("tr");
    tr.dataset.sku = item.sku || '';
    tr.dataset.price = item.price || '';

    const name = item.name || 'Unknown Product';
    const sku = item.sku || '';
    const price = item.price || '';
    const img = item.image || PLACEHOLDER_IMG;
    const link = item.link || '';
    const qty = item.qty || 1;
    const source = item.source || 'Add';

    tr.innerHTML = `
      <td>
        <img src="${img}" alt="${name}" 
             onerror="this.src='${PLACEHOLDER_IMG}'" 
             style="width:40px;height:40px;object-fit:contain;border-radius:4px;border:1px solid #e5e7eb;" />
      </td>
      <td>
        <div style="font-weight:600">${name}</div>
        ${sku ? `<div class="qiq-chip">PN/SKU: ${sku}</div>` : ""}
        <div class="qiq-chip" style="background:#f3f4f6;border-color:#d1d5db;font-size:11px">Source: ${source}</div>
        ${link ? `<div style="margin-top:4px"><a href="${link}" target="_blank" rel="noopener" style="color:#2563eb;font-size:12px;">View Details</a></div>` : ''}
      </td>
      <td>
        <input type="number" min="1" step="1" value="${qty}" class="qiq-qty" 
               style="width:60px;padding:4px;border:1px solid #d1d5db;border-radius:4px;" />
      </td>
      <td>
        <span class="qiq-unit-price">${price ? QIQBasket.formatPrice(price) : "Price on request"}</span>
      </td>
      <td>
        <span class="qiq-line-total">-</span>
      </td>
      <td>
        <button class="qiq-btn qiq-mini qiq-danger" type="button" data-action="remove"
                title="Remove from quotation" aria-label="Remove from quotation">Remove</button>
      </td>
    `;

    // Event listeners
    const qtyInput = tr.querySelector('.qiq-qty');
    qtyInput?.addEventListener('input', () => {
      const newQty = Math.max(1, parseInt(qtyInput.value || '1', 10));
      if (QIQBasket.updateQuantity(item.sku || item.name, newQty)) {
        updateLineTotal(tr);
      }
    });

    // Remove button
    const removeBtn = tr.querySelector('[data-action="remove"]');
    removeBtn?.addEventListener('click', () => {
      if (confirm(`هل تريد إزالة "${name}" من العرض؟`)) {
        if (QIQBasket.removeItem(item.sku || item.name)) {
          tr.remove();
          updateTotals();
          showToast(`تم حذف ${name} من العرض`, 'success');
          
          // Check if table is empty
          const remainingRows = stagedBody.querySelectorAll('tr').length;
          if (remainingRows === 0) {
            renderEmptyState();
          }
        }
      }
    });

    // Update line total initially
    updateLineTotal(tr);
    
    return tr;
  }

  function renderEmptyState() {
    if (!stagedBody) return;
    
    stagedBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;padding:40px;color:#6b7280;">
          لا توجد عناصر محفوظة. ارجع إلى <a href="index.html" style="color:#2563eb;">الصفحة الرئيسية</a> لإضافة منتجات.
        </td>
      </tr>
    `;
  }

  function renderStagedItems() {
    if (!stagedBody) return;

    const items = QIQBasket.getItems();
    
    // Clear existing content
    stagedBody.innerHTML = '';
    
    if (items.length === 0) {
      renderEmptyState();
      updateTotals();
      return;
    }

    // Build rows for each item
    items.forEach(item => {
      const row = buildStagedRow(item);
      stagedBody.appendChild(row);
    });

    updateTotals();
  }

  /* ---- Event Handlers ---- */
  
  // Clear all items
  clearAllBtn?.addEventListener('click', () => {
    const itemCount = QIQBasket.getItems().length;
    if (itemCount === 0) return;
    
    if (confirm(`هل تريد إزالة جميع العناصر (${itemCount} عنصر) من العرض؟`)) {
      if (QIQBasket.clear()) {
        renderStagedItems();
        showToast('تم مسح جميع العناصر من العرض', 'success');
      }
    }
  });

  /* ---- Auto-refresh when localStorage changes ---- */
  
  // Listen for storage changes (in case items are added from another tab)
  window.addEventListener('storage', (e) => {
    if (e.key === 'qiq_staged_items') {
      renderStagedItems();
    }
  });

  // Check for updates periodically (for same-tab updates)
  let lastItemCount = 0;
  setInterval(() => {
    const currentCount = QIQBasket.getCount();
    if (currentCount !== lastItemCount) {
      renderStagedItems();
      lastItemCount = currentCount;
    }
  }, 2000);

  /* ---- Initialize ---- */
  
  // Initial render
  if (typeof QIQBasket !== 'undefined') {
    renderStagedItems();
  } else {
    // Wait for QIQBasket to load
    setTimeout(() => {
      if (typeof QIQBasket !== 'undefined') {
        renderStagedItems();
      }
    }, 100);
  }

})();