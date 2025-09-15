/* =========================
   QIQ Quote Storage Helpers
   Local Storage Key: QIQ_QUOTE_ITEMS
   Item shape: { sku, name, price (number), link, image, qty }
   ========================= */

(() => {
  const STORAGE_KEY = 'QIQ_QUOTE_ITEMS';

  // Helper function to safely parse numbers
  function parsePrice(price) {
    if (typeof price === 'number') return price;
    const cleaned = String(price || '').replace(/[^\d.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  // Load items from localStorage
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const items = raw ? JSON.parse(raw) : [];
      return Array.isArray(items) ? items : [];
    } catch (e) {
      console.warn('Failed to load quote items from storage:', e);
      return [];
    }
  }

  // Save items to localStorage
  function save(items) {
    try {
      const validItems = Array.isArray(items) ? items : [];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validItems));
      return true;
    } catch (e) {
      console.warn('Failed to save quote items to storage:', e);
      return false;
    }
  }

  // Add a single item to storage
  function addItem(item) {
    const items = load();
    const sku = (item.sku || '').toString().trim();
    
    if (!sku) {
      console.warn('Cannot add item without SKU');
      return false;
    }

    // Check if item already exists
    const existingIndex = items.findIndex(existing => 
      (existing.sku || '').toString().trim() === sku
    );

    const newItem = {
      sku: sku,
      name: item.name || '',
      price: parsePrice(item.price),
      link: item.link || '',
      image: item.image || '',
      qty: Math.max(1, parseInt(item.qty) || 1)
    };

    if (existingIndex >= 0) {
      // Update existing item quantity
      items[existingIndex].qty += newItem.qty;
    } else {
      // Add new item
      items.push(newItem);
    }

    return save(items);
  }

  // Add multiple items to storage
  function addMany(itemList) {
    if (!Array.isArray(itemList)) return false;
    
    let success = true;
    itemList.forEach(item => {
      if (!addItem(item)) {
        success = false;
      }
    });
    
    return success;
  }

  // Remove item by SKU
  function remove(sku) {
    const items = load();
    const targetSku = (sku || '').toString().trim();
    
    if (!targetSku) return false;

    const filteredItems = items.filter(item => 
      (item.sku || '').toString().trim() !== targetSku
    );

    return save(filteredItems);
  }

  // Clear all items
  function clear() {
    return save([]);
  }

  // Calculate total price
  function total() {
    const items = load();
    return items.reduce((sum, item) => {
      const price = parsePrice(item.price);
      const qty = Math.max(1, parseInt(item.qty) || 1);
      return sum + (price * qty);
    }, 0);
  }

  // Update item quantity
  function updateQuantity(sku, newQty) {
    const items = load();
    const targetSku = (sku || '').toString().trim();
    const qty = Math.max(1, parseInt(newQty) || 1);
    
    const itemIndex = items.findIndex(item => 
      (item.sku || '').toString().trim() === targetSku
    );

    if (itemIndex >= 0) {
      items[itemIndex].qty = qty;
      return save(items);
    }
    
    return false;
  }

  // Format price with currency
  function formatPrice(price, showCurrency = true) {
    const num = parsePrice(price);
    
    if (num === 0) {
      return showCurrency ? 'Price on request' : '0';
    }
    
    if (showCurrency) {
      try {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(num);
      } catch {
        return `$${num.toFixed(2)}`;
      }
    }
    
    return num.toFixed(2);
  }

  // Export to global scope
  window.QuoteStorage = {
    load,
    save,
    addItem,
    addMany,
    remove,
    clear,
    total,
    updateQuantity,
    formatPrice
  };

  // For debugging
  window.QuoteStorage._STORAGE_KEY = STORAGE_KEY;
})();