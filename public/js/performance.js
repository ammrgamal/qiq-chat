// Advanced caching and performance utilities
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.expiry = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes
  }

  set(key, value, ttl = this.defaultTTL) {
    this.cache.set(key, value);
    this.expiry.set(key, Date.now() + ttl);
    return value;
  }

  get(key) {
    if (!this.cache.has(key)) return null;
    
    const expiration = this.expiry.get(key);
    if (Date.now() > expiration) {
      this.cache.delete(key);
      this.expiry.delete(key);
      return null;
    }
    
    return this.cache.get(key);
  }

  clear() {
    this.cache.clear();
    this.expiry.clear();
  }

  size() {
    return this.cache.size;
  }
}

// Retry mechanism for API calls
class RetryManager {
  static async retry(fn, maxRetries = 3, delay = 1000) {
    let lastError;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (i === maxRetries) break;
        
        // Exponential backoff
        const waitTime = delay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    throw lastError;
  }
}

// Debounce utility for search input
class DebounceManager {
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
}

// Progressive loading manager
class ProgressiveLoader {
  constructor(containerSelector, loadingTemplate) {
    this.container = document.querySelector(containerSelector);
    this.loadingTemplate = loadingTemplate;
    this.isLoading = false;
    this.hasMore = true;
    this.currentPage = 0;
  }

  showLoading() {
    if (!this.isLoading && this.loadingTemplate) {
      const loader = document.createElement('div');
      loader.className = 'progressive-loader';
      loader.innerHTML = this.loadingTemplate;
      this.container.appendChild(loader);
      this.isLoading = true;
    }
  }

  hideLoading() {
    const loader = this.container.querySelector('.progressive-loader');
    if (loader) {
      loader.remove();
      this.isLoading = false;
    }
  }

  reset() {
    this.currentPage = 0;
    this.hasMore = true;
    this.hideLoading();
  }
}

// Performance monitor
class PerformanceMonitor {
  static startTimer(label) {
    if (window.performance && performance.mark) {
      performance.mark(`${label}-start`);
    }
    return Date.now();
  }

  static endTimer(label, startTime) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (window.performance && performance.mark && performance.measure) {
      performance.mark(`${label}-end`);
      try {
        performance.measure(label, `${label}-start`, `${label}-end`);
      } catch (e) {
        console.warn('Performance measurement failed:', e);
      }
    }
    
    console.log(`⏱️ ${label}: ${duration}ms`);
    return duration;
  }
}

// Enhanced fetch with caching and retry
class EnhancedFetch {
  constructor() {
    this.cache = new CacheManager();
    this.pendingRequests = new Map();
  }

  async fetch(url, options = {}, cacheKey = null, cacheTTL = null) {
    // Use URL as cache key if not provided
    const key = cacheKey || `${url}-${JSON.stringify(options)}`;
    
    // Check cache first
    if (options.method === 'GET' || !options.method) {
      const cached = this.cache.get(key);
      if (cached) {
        console.log('📦 Cache hit:', key);
        return cached;
      }
    }

    // Prevent duplicate requests
    if (this.pendingRequests.has(key)) {
      console.log('⏳ Waiting for pending request:', key);
      return await this.pendingRequests.get(key);
    }

    // Create new request with retry
    const requestPromise = RetryManager.retry(async () => {
      const startTime = PerformanceMonitor.startTimer(`fetch-${url}`);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      PerformanceMonitor.endTimer(`fetch-${url}`, startTime);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Cache successful GET requests
      if ((options.method === 'GET' || !options.method) && cacheTTL !== 0) {
        this.cache.set(key, data, cacheTTL);
      }
      
      return data;
    }, 3, 1000);

    // Store pending request
    this.pendingRequests.set(key, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Clean up pending request
      this.pendingRequests.delete(key);
    }
  }

  clearCache() {
    this.cache.clear();
  }

  getCacheStats() {
    return {
      size: this.cache.size(),
      pendingRequests: this.pendingRequests.size
    };
  }
}

// Global instances
window.QiqCache = new CacheManager();
window.QiqFetch = new EnhancedFetch();
window.QiqPerformance = PerformanceMonitor;
window.QiqDebounce = DebounceManager;

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CacheManager,
    RetryManager,
    DebounceManager,
    ProgressiveLoader,
    PerformanceMonitor,
    EnhancedFetch
  };
}