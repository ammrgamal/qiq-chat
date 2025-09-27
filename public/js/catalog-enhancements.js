/**
 * Product Catalog Enhancements
 * تحسينات شاملة لصفحة كتالوج المنتجات
 */

class ProductCatalogEnhancer {
    constructor() {
        this.currentFilters = new Map();
        this.searchHistory = [];
        this.viewPreferences = this.loadViewPreferences();
        this.performanceMonitor = new PerformanceMonitor();
        this.init();
    }

    // تهيئة التحسينات
    init() {
        this.enhanceSearchInterface();
        this.optimizeFilterSystem();
        this.improveLoadingExperience();
        this.setupKeyboardShortcuts();
        this.enhanceAccessibility();
        this.monitorPerformance();
    }

    // تحسين واجهة البحث
    enhanceSearchInterface() {
        const searchInput = document.querySelector('#search-input, .search-input, [data-search]');
        if (!searchInput) return;

        // إضافة البحث التلقائي المحسن
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            
            // إظهار مؤشر البحث
            this.showSearchIndicator(true);
            
            searchTimeout = setTimeout(() => {
                if (query.length >= 2) {
                    this.performEnhancedSearch(query);
                    this.addToSearchHistory(query);
                } else if (query.length === 0) {
                    this.clearResults();
                }
                this.showSearchIndicator(false);
            }, 300);
        });

        // إضافة اقتراحات البحث
        this.addSearchSuggestions(searchInput);
        
        // تحسين تجربة البحث بالصوت إن أمكن
        this.addVoiceSearch(searchInput);
    }

    // تحسين نظام المرشحات
    optimizeFilterSystem() {
        const sidebar = document.querySelector('.sidebar, .filters-sidebar');
        if (!sidebar) return;

        // جعل الشريط الجانبي لاصقاً
        sidebar.style.position = 'sticky';
        sidebar.style.top = '20px';
        sidebar.style.maxHeight = 'calc(100vh - 40px)';
        sidebar.style.overflowY = 'auto';

        // تحسين مرشحات السعر
        this.enhancePriceFilter();
        
        // إضافة مرشحات ذكية
        this.addSmartFilters();
        
        // حفظ حالة المرشحات
        this.loadSavedFilters();
    }

    // تحسين تجربة التحميل
    improveLoadingExperience() {
        // إضافة skeleton loading للكروت
        this.addSkeletonLoading();
        
        // تحسين التحميل التدريجي
        this.setupInfiniteScroll();
        
        // إضافة preloader ذكي
        this.addIntelligentPreloader();
    }

    // إضافة اختصارات لوحة المفاتيح
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + K للبحث
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const searchInput = document.querySelector('#search-input, .search-input, [data-search]');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
            }
            
            // Escape لمسح البحث
            if (e.key === 'Escape') {
                this.clearSearch();
            }
            
            // Enter للبحث السريع
            if (e.key === 'Enter' && e.target.matches('.search-input, #search-input')) {
                this.performQuickSearch();
            }
        });
    }

    // تحسين إمكانية الوصول
    enhanceAccessibility() {
        // إضافة aria labels للأزرار
        document.querySelectorAll('.btn:not([aria-label])').forEach(btn => {
            const text = btn.textContent.trim() || btn.title || btn.getAttribute('title');
            if (text) {
                btn.setAttribute('aria-label', text);
            }
        });

        // تحسين التنقل بالتاب
        this.improveTabNavigation();
        
        // إضافة تدرج لون للتباين
        this.enhanceColorContrast();
    }

    // مراقبة الأداء
    monitorPerformance() {
        // مراقبة زمن البحث
        this.performanceMonitor.track('search_time', () => {
            // يتم استدعاؤها عند كل بحث
        });

        // مراقبة زمن تحميل الصور
        this.performanceMonitor.track('image_load_time', () => {
            // يتم استدعاؤها عند تحميل الصور
        });

        // تقرير الأداء كل دقيقة
        setInterval(() => {
            this.performanceMonitor.generateReport();
        }, 60000);
    }

    // البحث المحسن
    async performEnhancedSearch(query) {
        const startTime = performance.now();
        
        try {
            // البحث في التاريخ أولاً للنتائج السريعة
            const cachedResults = this.searchInHistory(query);
            if (cachedResults.length > 0) {
                this.displaySearchSuggestions(cachedResults);
            }

            // البحث الفعلي
            if (window.performSearch) {
                await window.performSearch(query);
            }
            
            // تسجيل الوقت
            const searchTime = performance.now() - startTime;
            this.performanceMonitor.record('search_time', searchTime);
            
            // إضافة لتحليلات البحث
            this.recordSearchAnalytics(query, searchTime);
            
        } catch (error) {
            console.error('خطأ في البحث المحسن:', error);
            this.showSearchError('حدث خطأ في البحث. يرجى المحاولة مرة أخرى.');
        }
    }

    // إضافة skeleton loading
    addSkeletonLoading() {
        const resultsContainer = document.querySelector('#results, .results, .products-grid');
        if (!resultsContainer) return;

        const skeletonHTML = `
            <div class="skeleton-container" id="skeleton-loader">
                ${Array.from({length: 8}, (_, i) => `
                    <div class="skeleton-card">
                        <div class="skeleton-image"></div>
                        <div class="skeleton-content">
                            <div class="skeleton-line skeleton-title"></div>
                            <div class="skeleton-line skeleton-desc"></div>
                            <div class="skeleton-chips">
                                <div class="skeleton-chip"></div>
                                <div class="skeleton-chip"></div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <style>
                .skeleton-container {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 20px;
                    padding: 20px;
                }
                
                .skeleton-card {
                    background: white;
                    border-radius: 12px;
                    padding: 16px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    animation: pulse 1.5s ease-in-out infinite;
                }
                
                .skeleton-image {
                    width: 60px;
                    height: 60px;
                    background: #e5e7eb;
                    border-radius: 8px;
                    margin-bottom: 12px;
                }
                
                .skeleton-line {
                    height: 16px;
                    background: #e5e7eb;
                    border-radius: 4px;
                    margin-bottom: 8px;
                }
                
                .skeleton-title { width: 80%; height: 20px; }
                .skeleton-desc { width: 60%; }
                
                .skeleton-chips {
                    display: flex;
                    gap: 8px;
                    margin-top: 12px;
                }
                
                .skeleton-chip {
                    width: 60px;
                    height: 24px;
                    background: #e5e7eb;
                    border-radius: 12px;
                }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
            </style>
        `;

        // إظهار skeleton عند البداية
        this.showSkeleton = () => {
            resultsContainer.innerHTML = skeletonHTML;
        };

        // إخفاء skeleton عند انتهاء التحميل
        this.hideSkeleton = () => {
            const skeleton = document.getElementById('skeleton-loader');
            if (skeleton) {
                skeleton.remove();
            }
        };
    }

    // إضافة مؤشر البحث
    showSearchIndicator(show) {
        let indicator = document.getElementById('search-indicator');
        
        if (show && !indicator) {
            indicator = document.createElement('div');
            indicator.id = 'search-indicator';
            indicator.innerHTML = `
                <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                           background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                           display: flex; align-items: center; gap: 12px; z-index: 9999;">
                    <div class="spinner" style="width: 20px; height: 20px; border: 2px solid #e5e7eb; 
                                              border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <span style="color: #374151; font-weight: 500;">جاري البحث...</span>
                </div>
                <style>
                    @keyframes spin { to { transform: rotate(360deg); } }
                </style>`;
            document.body.appendChild(indicator);
        } else if (!show && indicator) {
            indicator.remove();
        }
    }

    // حفظ تفضيلات العرض
    saveViewPreferences() {
        const prefs = {
            gridSize: this.viewPreferences.gridSize,
            sortBy: this.viewPreferences.sortBy,
            filtersExpanded: this.viewPreferences.filtersExpanded,
            theme: this.viewPreferences.theme
        };
        localStorage.setItem('qiq_catalog_prefs', JSON.stringify(prefs));
    }

    // تحميل تفضيلات العرض
    loadViewPreferences() {
        const saved = localStorage.getItem('qiq_catalog_prefs');
        if (saved) {
            return JSON.parse(saved);
        }
        
        return {
            gridSize: 'medium',
            sortBy: 'relevance',
            filtersExpanded: true,
            theme: 'light'
        };
    }

    // تحسين مرشح السعر
    enhancePriceFilter() {
        const priceFilter = document.querySelector('.price-filter, [data-filter="price"]');
        if (!priceFilter) return;

        // إضافة slider للسعر
        const priceSlider = document.createElement('div');
        priceSlider.innerHTML = `
            <div class="price-range-container">
                <label style="display: block; font-weight: 600; margin-bottom: 8px;">نطاق السعر</label>
                <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
                    <input type="number" id="price-min" placeholder="من" 
                           style="width: 80px; padding: 6px; border: 1px solid #d1d5db; border-radius: 6px;" />
                    <span style="color: #6b7280;">إلى</span>
                    <input type="number" id="price-max" placeholder="إلى" 
                           style="width: 80px; padding: 6px; border: 1px solid #d1d5db; border-radius: 6px;" />
                </div>
                <div class="price-shortcuts" style="display: flex; flex-wrap: wrap; gap: 6px;">
                    <button class="price-shortcut" data-range="0,1000">أقل من 1000</button>
                    <button class="price-shortcut" data-range="1000,5000">1000 - 5000</button>
                    <button class="price-shortcut" data-range="5000,10000">5000 - 10000</button>
                    <button class="price-shortcut" data-range="10000,50000">10000+</button>
                </div>
            </div>
            <style>
                .price-shortcut {
                    padding: 4px 8px;
                    font-size: 12px;
                    background: #f3f4f6;
                    border: 1px solid #d1d5db;
                    border-radius: 16px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .price-shortcut:hover {
                    background: #e5e7eb;
                }
                .price-shortcut.active {
                    background: #3b82f6;
                    color: white;
                    border-color: #3b82f6;
                }
            </style>
        `;

        priceFilter.appendChild(priceSlider);

        // معالجة أحداث مرشح السعر
        priceSlider.addEventListener('click', (e) => {
            if (e.target.matches('.price-shortcut')) {
                const range = e.target.dataset.range.split(',');
                document.getElementById('price-min').value = range[0];
                document.getElementById('price-max').value = range[1];
                
                // تحديث الأزرار النشطة
                priceSlider.querySelectorAll('.price-shortcut').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                
                this.applyPriceFilter(range[0], range[1]);
            }
        });
    }

    // تطبيق مرشح السعر
    applyPriceFilter(min, max) {
        this.currentFilters.set('price', { min: parseFloat(min), max: parseFloat(max) });
        this.refreshResults();
    }

    // تحديث النتائج مع المرشحات
    refreshResults() {
        const query = document.querySelector('#search-input, .search-input').value || '';
        this.performEnhancedSearch(query);
    }

    // إضافة تحليلات البحث
    recordSearchAnalytics(query, responseTime) {
        const analytics = {
            query: query,
            timestamp: new Date().toISOString(),
            responseTime: responseTime,
            filters: Object.fromEntries(this.currentFilters),
            userAgent: navigator.userAgent
        };

        // إرسال للخادم أو حفظ محلياً
        this.saveSearchAnalytics(analytics);
    }

    // حفظ تحليلات البحث
    saveSearchAnalytics(analytics) {
        const searches = JSON.parse(localStorage.getItem('qiq_search_analytics') || '[]');
        searches.push(analytics);
        
        // الاحتفاظ بآخر 100 بحث فقط
        if (searches.length > 100) {
            searches.splice(0, searches.length - 100);
        }
        
        localStorage.setItem('qiq_search_analytics', JSON.stringify(searches));
    }
}

// مراقب الأداء
class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
    }

    track(name, fn) {
        this.metrics.set(name, { function: fn, times: [] });
    }

    record(name, time) {
        if (this.metrics.has(name)) {
            this.metrics.get(name).times.push(time);
        }
    }

    generateReport() {
        const report = {};
        this.metrics.forEach((data, name) => {
            const times = data.times;
            if (times.length > 0) {
                report[name] = {
                    count: times.length,
                    average: times.reduce((a, b) => a + b) / times.length,
                    min: Math.min(...times),
                    max: Math.max(...times)
                };
            }
        });
        
        console.log('تقرير أداء الكتالوج:', report);
        return report;
    }
}

// تشغيل التحسينات عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    window.catalogEnhancer = new ProductCatalogEnhancer();
    
    // ربط التحسينات مع النظم الموجودة
    if (window.performSearch) {
        const originalSearch = window.performSearch;
        window.performSearch = async function(query) {
            window.catalogEnhancer.showSkeleton();
            try {
                const result = await originalSearch.call(this, query);
                window.catalogEnhancer.hideSkeleton();
                return result;
            } catch (error) {
                window.catalogEnhancer.hideSkeleton();
                throw error;
            }
        };
    }
});