/* ========================================
   QIQ Basket - Unified LocalStorage Management
   Key: qiq_staged_items
   Structure: [{sku, name, price, image, link, qty, source}]
   ======================================== */

const QIQBasket = (() => {
  const STORAGE_KEY = 'qiq_staged_items';
  
  // Helper functions
  const log = (action, data) => {
    console.log(`[QIQ Basket] ${action}:`, data);
  };

  const parsePrice = (price) => {
    if (!price) return 0;
    const num = Number(String(price).replace(/[^\d.]/g, ''));
    return isFinite(num) ? num : 0;
  };

  const formatPrice = (price) => {
    const num = parsePrice(price);
    if (!num) return 'Price on request';
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(num);
    } catch {
      return `$${num.toFixed(2)}`;
    }
  };

  // Storage operations
  const getItems = () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('Failed to read basket from localStorage:', e);
      return [];
    }
  };

  const saveItems = (items) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      return true;
    } catch (e) {
      console.warn('Failed to save basket to localStorage:', e);
      return false;
    }
  };

  // Smart quantity extraction from user message
  const extractQuantity = (message) => {
    if (!message) return 1;
    
    // Arabic number patterns
    const arabicNums = { '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9 };
    const convertArabicNums = (str) => str.replace(/[٠-٩]/g, d => arabicNums[d]);
    
    // Convert Arabic numerals
    const normalizedMsg = convertArabicNums(message);
    
    // Look for quantity patterns (both English and Arabic)
    const patterns = [
      /(?:for|لـ|عدد)\s*(\d+)/i,
      /(\d+)\s*(?:users?|مستخدم|مستخدمين|أجهزة|devices?)/i,
      /(?:quantity|كمية|العدد)\s*[:=]?\s*(\d+)/i,
      /(\d+)\s*(?:pieces?|قطع|وحدة|وحدات)/i,
      /(\d+)/  // Fallback: any number
    ];
    
    for (const pattern of patterns) {
      const match = normalizedMsg.match(pattern);
      if (match) {
        const qty = parseInt(match[1], 10);
        if (qty > 0 && qty <= 10000) { // Reasonable range
          return qty;
        }
      }
    }
    
    return 1; // Default quantity
  };

  // Public API
  return {
    // Add item with quantity merging
    addItem: (item, userMessage = '') => {
      const items = getItems();
      const sku = item.sku || item.pn || '';
      const key = sku ? sku.toUpperCase() : (item.name || '').toUpperCase();
      
      if (!key) {
        log('ADD_FAILED', 'No valid SKU or name');
        return false;
      }

      // Extract smart quantity from user message
      const suggestedQty = extractQuantity(userMessage);
      
      // Check for existing item
      const existingIndex = items.findIndex(existing => {
        const existingKey = existing.sku ? existing.sku.toUpperCase() : (existing.name || '').toUpperCase();
        return existingKey === key;
      });

      if (existingIndex >= 0) {
        // Merge quantities
        items[existingIndex].qty = (items[existingIndex].qty || 1) + suggestedQty;
        log('ADD_MERGED', {
          sku: key,
          newQty: items[existingIndex].qty,
          added: suggestedQty
        });
      } else {
        // Add new item
        const newItem = {
          sku: sku,
          name: item.name || '',
          price: item.price || '',
          image: item.image || '',
          link: item.link || '',
          qty: suggestedQty,
          source: item.source || 'Add',
          addedAt: new Date().toISOString()
        };
        items.push(newItem);
        log('ADD_NEW', newItem);
      }

      return saveItems(items);
    },

    // Remove item by SKU
    removeItem: (sku) => {
      const items = getItems();
      const key = sku ? sku.toUpperCase() : '';
      
      const filteredItems = items.filter(item => {
        const itemKey = item.sku ? item.sku.toUpperCase() : (item.name || '').toUpperCase();
        return itemKey !== key;
      });

      if (filteredItems.length < items.length) {
        log('REMOVE', { sku: key, removed: items.length - filteredItems.length });
        return saveItems(filteredItems);
      }
      return false;
    },

    // Update item quantity
    updateQuantity: (sku, qty) => {
      const items = getItems();
      const key = sku ? sku.toUpperCase() : '';
      const newQty = Math.max(1, parseInt(qty, 10) || 1);

      const item = items.find(item => {
        const itemKey = item.sku ? item.sku.toUpperCase() : (item.name || '').toUpperCase();
        return itemKey === key;
      });

      if (item) {
        item.qty = newQty;
        log('UPDATE_QTY', { sku: key, qty: newQty });
        return saveItems(items);
      }
      return false;
    },

    // Get all items
    getItems,

    // Clear all items
    clear: () => {
      log('CLEAR', 'All items removed');
      return saveItems([]);
    },

    // Get item count
    getCount: () => {
      return getItems().reduce((sum, item) => sum + (item.qty || 1), 0);
    },

    // Get total value
    getTotal: () => {
      return getItems().reduce((total, item) => {
        const price = parsePrice(item.price);
        const qty = item.qty || 1;
        return total + (price * qty);
      }, 0);
    },

    // Format price utility
    formatPrice,

    // Extract quantity utility
    extractQuantity,

    // Check if results are too many (for clarification dialog)
    shouldShowClarification: (results, threshold = 10) => {
      return results && results.length > threshold;
    },

    // Generate clarification message
    getClarificationMessage: (query, resultCount) => {
      return {
        en: `Found ${resultCount} results for "${query}". Would you like to refine your search?`,
        ar: `تم العثور على ${resultCount} نتيجة لـ "${query}". هل تريد تحسين البحث؟`
      };
    }
  };
})();

// Expose globally for compatibility
if (typeof window !== 'undefined') {
  window.QIQBasket = QIQBasket;
}