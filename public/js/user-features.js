// Advanced user features: favorites, comparison, history, recommendations
class FavoritesManager {
  constructor() {
    this.storageKey = 'qiq_favorites';
    this.favorites = this.loadFavorites();
  }

  loadFavorites() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  saveFavorites() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.favorites));
  }

  add(product) {
    const productId = product.id || product.sku || product.name;
    if (!this.isFavorite(productId)) {
      this.favorites.push({
        id: productId,
        name: product.name,
        price: product.price,
        image: product.image,
        sku: product.sku,
        manufacturer: product.manufacturer,
        addedAt: new Date().toISOString()
      });
      this.saveFavorites();
      this.notifyChange('added', product);
      return true;
    }
    return false;
  }

  remove(productId) {
    const index = this.favorites.findIndex(fav => fav.id === productId);
    if (index !== -1) {
      const removed = this.favorites.splice(index, 1)[0];
      this.saveFavorites();
      this.notifyChange('removed', removed);
      return true;
    }
    return false;
  }

  toggle(product) {
    const productId = product.id || product.sku || product.name;
    return this.isFavorite(productId) ? this.remove(productId) : this.add(product);
  }

  isFavorite(productId) {
    return this.favorites.some(fav => fav.id === productId);
  }

  getAll() {
    return [...this.favorites];
  }

  clear() {
    this.favorites = [];
    this.saveFavorites();
    this.notifyChange('cleared');
  }

  notifyChange(action, product = null) {
    const event = new CustomEvent('favoritesChanged', {
      detail: { action, product, count: this.favorites.length }
    });
    document.dispatchEvent(event);
  }
}

class ProductComparison {
  constructor() {
    this.storageKey = 'qiq_comparison';
    this.compareList = this.loadComparison();
    this.maxItems = 4;
  }

  loadComparison() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  saveComparison() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.compareList));
  }

  add(product) {
    const productId = product.id || product.sku || product.name;
    
    if (this.compareList.length >= this.maxItems) {
      throw new Error(`يمكن مقارنة ${this.maxItems} منتجات كحد أقصى`);
    }

    if (!this.isInComparison(productId)) {
      this.compareList.push({
        id: productId,
        name: product.name,
        price: product.price,
        image: product.image,
        sku: product.sku,
        manufacturer: product.manufacturer,
        specifications: product.specifications || {},
        addedAt: new Date().toISOString()
      });
      this.saveComparison();
      this.notifyChange('added', product);
      return true;
    }
    return false;
  }

  remove(productId) {
    const index = this.compareList.findIndex(item => item.id === productId);
    if (index !== -1) {
      const removed = this.compareList.splice(index, 1)[0];
      this.saveComparison();
      this.notifyChange('removed', removed);
      return true;
    }
    return false;
  }

  isInComparison(productId) {
    return this.compareList.some(item => item.id === productId);
  }

  getAll() {
    return [...this.compareList];
  }

  clear() {
    this.compareList = [];
    this.saveComparison();
    this.notifyChange('cleared');
  }

  generateComparisonTable() {
    if (this.compareList.length < 2) {
      return '<p>يرجى إضافة منتجين على الأقل للمقارنة</p>';
    }

    const FALLBACK60 = 'data:image/svg+xml;utf8,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><rect width='100%' height='100%' fill='#f3f4f6'/><text x='50%' y='55%' dominant-baseline='middle' text-anchor='middle' fill='#9ca3af' font-size='14'>IMG</text></svg>");

    const allSpecs = new Set();
    this.compareList.forEach(product => {
      Object.keys(product.specifications || {}).forEach(spec => allSpecs.add(spec));
    });

    let html = `
      <table class="comparison-table" style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">المنتج</th>
            ${this.compareList.map(product => 
              `<th style="padding: 12px; text-align: center; border: 1px solid #e5e7eb;">
                <img src="${product.image || FALLBACK60}" 
                     style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;" />
                <div style="margin-top: 8px; font-weight: 600;">${product.name}</div>
                <div style="font-size: 12px; color: #6b7280;">${product.sku || ''}</div>
              </th>`
            ).join('')}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">السعر</td>
            ${this.compareList.map(product => 
              `<td style="padding: 12px; text-align: center; border: 1px solid #e5e7eb; font-weight: 600; color: #059669;">
                ${product.price ? '$' + product.price : '-'}
              </td>`
            ).join('')}
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">الشركة المصنعة</td>
            ${this.compareList.map(product => 
              `<td style="padding: 12px; text-align: center; border: 1px solid #e5e7eb;">
                ${product.manufacturer || '-'}
              </td>`
            ).join('')}
          </tr>
          ${Array.from(allSpecs).map(spec => `
            <tr>
              <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">${spec}</td>
              ${this.compareList.map(product => 
                `<td style="padding: 12px; text-align: center; border: 1px solid #e5e7eb;">
                  ${product.specifications?.[spec] || '-'}
                </td>`
              ).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    return html;
  }

  notifyChange(action, product = null) {
    const event = new CustomEvent('comparisonChanged', {
      detail: { action, product, count: this.compareList.length }
    });
    document.dispatchEvent(event);
  }
}

class SearchHistory {
  constructor() {
    this.storageKey = 'qiq_search_history';
    this.maxItems = 50;
    this.history = this.loadHistory();
  }

  loadHistory() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  saveHistory() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.history));
  }

  addSearch(query, results = 0) {
    if (!query || query.trim().length === 0) return;

    const searchItem = {
      query: query.trim(),
      timestamp: new Date().toISOString(),
      results
    };

    // Remove existing entry for the same query
    this.history = this.history.filter(item => item.query !== searchItem.query);
    
    // Add to beginning
    this.history.unshift(searchItem);
    
    // Limit size
    if (this.history.length > this.maxItems) {
      this.history = this.history.slice(0, this.maxItems);
    }

    this.saveHistory();
  }

  getHistory(limit = 10) {
    return this.history.slice(0, limit);
  }

  getPopularSearches(limit = 5) {
    const searches = {};
    this.history.forEach(item => {
      searches[item.query] = (searches[item.query] || 0) + 1;
    });

    return Object.entries(searches)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([query, count]) => ({ query, count }));
  }

  clear() {
    this.history = [];
    this.saveHistory();
  }
}

class SmartRecommendations {
  constructor() {
    this.storageKey = 'qiq_user_preferences';
    this.preferences = this.loadPreferences();
  }

  loadPreferences() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      return saved ? JSON.parse(saved) : {
        categories: {},
        brands: {},
        priceRanges: {},
        searchTerms: {}
      };
    } catch {
      return {
        categories: {},
        brands: {},
        priceRanges: {},
        searchTerms: {}
      };
    }
  }

  savePreferences() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.preferences));
  }

  trackInteraction(product, action = 'view') {
    const weight = { view: 1, favorite: 3, compare: 2, quote: 5 }[action] || 1;

    // Track categories
    if (product.category) {
      this.preferences.categories[product.category] = 
        (this.preferences.categories[product.category] || 0) + weight;
    }

    // Track brands
    if (product.manufacturer) {
      this.preferences.brands[product.manufacturer] = 
        (this.preferences.brands[product.manufacturer] || 0) + weight;
    }

    // Track price ranges
    if (product.price) {
      const priceRange = this.getPriceRange(product.price);
      this.preferences.priceRanges[priceRange] = 
        (this.preferences.priceRanges[priceRange] || 0) + weight;
    }

    this.savePreferences();
  }

  getPriceRange(price) {
    const p = parseFloat(price);
    if (p < 100) return '$0-$100';
    if (p < 500) return '$100-$500';
    if (p < 1000) return '$500-$1000';
    if (p < 5000) return '$1000-$5000';
    return '$5000+';
  }

  getRecommendations(products, limit = 6) {
    if (!products || products.length === 0) return [];

    const scored = products.map(product => ({
      ...product,
      score: this.calculateScore(product)
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  calculateScore(product) {
    let score = 0;

    // Category preference
    if (product.category && this.preferences.categories[product.category]) {
      score += this.preferences.categories[product.category] * 2;
    }

    // Brand preference
    if (product.manufacturer && this.preferences.brands[product.manufacturer]) {
      score += this.preferences.brands[product.manufacturer] * 1.5;
    }

    // Price range preference
    if (product.price) {
      const priceRange = this.getPriceRange(product.price);
      if (this.preferences.priceRanges[priceRange]) {
        score += this.preferences.priceRanges[priceRange];
      }
    }

    return score;
  }

  getPreferredCategories(limit = 5) {
    return Object.entries(this.preferences.categories)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([category, score]) => ({ category, score }));
  }

  getPreferredBrands(limit = 5) {
    return Object.entries(this.preferences.brands)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([brand, score]) => ({ brand, score }));
  }
}

// Initialize global instances
window.QiqFavorites = new FavoritesManager();
window.QiqComparison = new ProductComparison();
window.QiqSearchHistory = new SearchHistory();
window.QiqRecommendations = new SmartRecommendations();

// Event listeners for UI updates
document.addEventListener('favoritesChanged', (e) => {
  updateFavoritesButton(e.detail);
});

document.addEventListener('comparisonChanged', (e) => {
  updateComparisonButton(e.detail);
});

function updateFavoritesButton({ count }) {
  const badge = document.querySelector('.favorites-badge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline' : 'none';
  }
}

function updateComparisonButton({ count }) {
  const badge = document.querySelector('.comparison-badge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline' : 'none';
  }
}