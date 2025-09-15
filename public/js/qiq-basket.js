/**
 * QIQ Basket - Unified localStorage management for staged items
 * Manages the qiq_staged_items key with SKU quantity merging
 */

// Constants
const STORAGE_KEY = 'qiq_staged_items';

// Toast notification utility
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `qiq-toast-item qiq-toast-${type}`;
  toast.textContent = message;
  
  // Create toast container if it doesn't exist
  let container = document.querySelector('.qiq-toast');
  if (!container) {
    container = document.createElement('div');
    container.className = 'qiq-toast';
    document.body.appendChild(container);
  }
  
  container.appendChild(toast);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 3000);
}

// Data Contract for basket items
class QiqBasketItem {
  constructor({
    sku = '',
    name = '',
    description = '',
    unitPrice = 0,
    qty = 1,
    image = '',
    link = '',
    source = 'Manual',
    pn = ''
  }) {
    this.sku = String(sku || pn || '').trim().toUpperCase();
    this.name = String(name || description || '').trim();
    this.description = String(description || name || '').trim();
    this.unitPrice = this.parsePrice(unitPrice);
    this.qty = Math.max(1, parseInt(qty) || 1);
    this.image = String(image || '').trim();
    this.link = String(link || '').trim();
    this.source = String(source || 'Manual').trim();
    this.pn = String(pn || sku || '').trim();
    this.lineTotal = this.unitPrice * this.qty;
  }

  parsePrice(price) {
    if (typeof price === 'number') return price;
    if (typeof price === 'string') {
      // Remove currency symbols and non-numeric characters except decimal point
      const cleaned = price.replace(/[^\d.-]/g, '');
      return parseFloat(cleaned) || 0;
    }
    return 0;
  }

  // Get unique key for deduplication
  getKey() {
    return this.sku || this.name.toUpperCase().slice(0, 50);
  }

  // Format price for display
  formatPrice(currency = 'USD') {
    if (this.unitPrice === 0) return 'Price on request';
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
      }).format(this.unitPrice);
    } catch {
      return `$${this.unitPrice.toFixed(2)}`;
    }
  }

  // Update line total when quantity changes
  updateQuantity(newQty) {
    this.qty = Math.max(1, parseInt(newQty) || 1);
    this.lineTotal = this.unitPrice * this.qty;
    return this;
  }
}

// Basket Manager
class QiqBasket {
  constructor() {
    this.items = this.loadItems();
  }

  // Load items from localStorage
  loadItems() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      
      const data = JSON.parse(stored);
      return Array.isArray(data) ? data.map(item => new QiqBasketItem(item)) : [];
    } catch (error) {
      console.warn('Failed to load basket items:', error);
      return [];
    }
  }

  // Save items to localStorage
  saveItems() {
    try {
      const data = this.items.map(item => ({
        sku: item.sku,
        name: item.name,
        description: item.description,
        unitPrice: item.unitPrice,
        qty: item.qty,
        image: item.image,
        link: item.link,
        source: item.source,
        pn: item.pn,
        lineTotal: item.lineTotal
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      console.log('Basket saved:', data.length, 'items');
      return true;
    } catch (error) {
      console.error('Failed to save basket:', error);
      return false;
    }
  }

  // Add item to basket with SKU merging
  addItem(itemData) {
    try {
      const newItem = new QiqBasketItem(itemData);
      const key = newItem.getKey();
      
      if (!key) {
        console.warn('Cannot add item without SKU or name');
        return false;
      }

      // Check for existing item with same SKU
      const existingIndex = this.items.findIndex(item => item.getKey() === key);
      
      if (existingIndex >= 0) {
        // Merge quantities
        const existing = this.items[existingIndex];
        existing.updateQuantity(existing.qty + newItem.qty);
        console.log(`Merged ${newItem.qty} more of ${key}, total: ${existing.qty}`);
        showToast(`تم دمج الكمية: ${existing.name} (${existing.qty})`, 'success');
      } else {
        // Add new item
        this.items.push(newItem);
        console.log(`Added new item: ${key}, qty: ${newItem.qty}`);
        showToast(`تم إضافة: ${newItem.name}`, 'success');
      }

      this.saveItems();
      this.updateUI();
      return true;
    } catch (error) {
      console.error('Failed to add item:', error);
      showToast('فشل في إضافة العنصر', 'error');
      return false;
    }
  }

  // Remove item by SKU/key
  removeItem(key) {
    try {
      const index = this.items.findIndex(item => item.getKey() === key);
      if (index >= 0) {
        const removed = this.items.splice(index, 1)[0];
        console.log(`Removed item: ${key}`);
        showToast(`تم حذف: ${removed.name}`, 'info');
        this.saveItems();
        this.updateUI();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to remove item:', error);
      return false;
    }
  }

  // Update item quantity
  updateItemQuantity(key, newQty) {
    try {
      const item = this.items.find(item => item.getKey() === key);
      if (item) {
        item.updateQuantity(newQty);
        console.log(`Updated ${key} quantity to ${newQty}`);
        this.saveItems();
        this.updateUI();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to update quantity:', error);
      return false;
    }
  }

  // Clear all items
  clearBasket() {
    try {
      this.items = [];
      localStorage.removeItem(STORAGE_KEY);
      console.log('Basket cleared');
      showToast('تم تفريغ السلة', 'info');
      this.updateUI();
      return true;
    } catch (error) {
      console.error('Failed to clear basket:', error);
      return false;
    }
  }

  // Get total count of items
  getItemCount() {
    return this.items.reduce((total, item) => total + item.qty, 0);
  }

  // Get grand total price
  getGrandTotal() {
    return this.items.reduce((total, item) => total + item.lineTotal, 0);
  }

  // Format grand total for display
  formatGrandTotal(currency = 'USD') {
    const total = this.getGrandTotal();
    if (total === 0) return '-';
    
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
      }).format(total);
    } catch {
      return `$${total.toFixed(2)}`;
    }
  }

  // Update UI elements if they exist
  updateUI() {
    // Update grand total display on index page
    const grandTotalEl = document.getElementById('qiq-grand-total');
    if (grandTotalEl) {
      grandTotalEl.textContent = this.formatGrandTotal();
    }

    // Update legacy grand total element
    const legacyGrandTotalEl = document.getElementById('qiq-grand');
    if (legacyGrandTotalEl) {
      legacyGrandTotalEl.innerHTML = `<strong>${this.formatGrandTotal()}</strong>`;
    }

    // Update "Add all" button state
    const addAllBtn = document.getElementById('qiq-add-all-results') || document.getElementById('qiq-add-all');
    if (addAllBtn) {
      addAllBtn.disabled = this.items.length === 0;
    }

    // Update item count in UI
    const statusEl = document.getElementById('qiq-status') || document.getElementById('qiq-results-status');
    if (statusEl) {
      const count = this.getItemCount();
      statusEl.textContent = count > 0 ? `${count} items in basket` : '';
    }
  }

  // Get items for export/display
  getItems() {
    return [...this.items];
  }

  // Import items from external source (e.g., search results)
  importItems(items) {
    try {
      let addedCount = 0;
      items.forEach(itemData => {
        if (this.addItem(itemData)) {
          addedCount++;
        }
      });
      
      if (addedCount > 0) {
        showToast(`تم إضافة ${addedCount} عنصر للسلة`, 'success');
      }
      
      return addedCount;
    } catch (error) {
      console.error('Failed to import items:', error);
      showToast('فشل في استيراد العناصر', 'error');
      return 0;
    }
  }
}

// Global basket instance
const qiqBasket = new QiqBasket();

// Export for use in other modules
window.qiqBasket = qiqBasket;
window.QiqBasketItem = QiqBasketItem;

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    qiqBasket.updateUI();
  });
} else {
  qiqBasket.updateUI();
}