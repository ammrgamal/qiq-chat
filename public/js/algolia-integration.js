// Enhanced Algolia Integration with V0 API
class AlgoliaIntegration {
    constructor() {
        this.client = null;
        this.index = null;
        this.searchInput = document.getElementById('product-search');
        this.productsGrid = document.getElementById('products-grid');
        this.filterButtons = document.querySelectorAll('.filter-btn');
        
        this.currentFilter = 'all';
        this.searchResults = [];
        this.isLoading = false;
        
        this.init();
    }
    
    async init() {
        try {
            // Check if Algolia is configured
            const health = await fetch('/health').then(r => r.json());
            
            if (health.env?.hasAlgolia) {
                await this.initAlgolia();
                // After initializing, fetch algolia health for diagnostics
                this.injectBannerContainer();
                this.checkAlgoliaHealth();
            } else {
                this.showAlgoliaNotConfigured();
                // Load sample products for demo
                await this.loadSampleProducts();
            }
            
            this.setupEventListeners();
            this.performInitialSearch();
            
            console.log('🔍 Algolia integration initialized');
        } catch (error) {
            console.error('Algolia initialization error:', error);
            await this.loadSampleProducts();
        }
    }

    injectBannerContainer(){
        if (!document.getElementById('algolia-banner')){
            const div = document.createElement('div');
            div.id = 'algolia-banner';
            div.className = 'mb-4';
            document.querySelector('#catalog-root')?.prepend(div);
        }
    }

    async checkAlgoliaHealth(){
        try {
            const res = await fetch('/api/algolia-health');
            const json = await res.json();
            if (!json.ok){
                this.showBanner(`⚠️ فحص الفهرس: ${json.reason || json.error || 'تعذر الاتصال بـ Algolia'}`, 'warn');
                return;
            }
            if (json.mismatch){
                this.showBanner(`⚠️ اختلاف في إعدادات الفهرس: (ALGOLIA_INDEX='${json.envIndex}' / ALGOLIA_INDEX_NAME='${json.envIndexName}') — يتم استخدام '${json.index}' فعلياً.`, 'warn');
            } else if (json.nbHits === 0){
                this.showBanner('ℹ️ الفهرس الحالي لا يحتوي سجلات. قم بتشغيل مزامنة Algolia أو تحقق من شروط AIProcessed.', 'info');
            } else {
                // Optional success banner (commented to avoid noise)
                // this.showBanner(`✅ فهرس Algolia جاهز (${json.nbHits} منتج)`, 'ok');
            }
        } catch(e){
            this.showBanner('⚠️ تعذر فحص صحة Algolia حالياً', 'warn');
        }
    }

    showBanner(message, level){
        const el = document.getElementById('algolia-banner');
        if (!el) return;
        const base = 'text-sm px-3 py-2 rounded border';
        let cls = 'bg-qiq-dark border-qiq-gold/40 text-qiq-gold';
        if (level === 'warn') cls = 'bg-yellow-900/40 border-yellow-500/50 text-yellow-300';
        if (level === 'info') cls = 'bg-blue-900/30 border-blue-400/40 text-blue-200';
        if (level === 'ok') cls = 'bg-emerald-900/30 border-emerald-500/40 text-emerald-200';
        el.innerHTML = `<div class="${base} ${cls}">${message}</div>`;
    }
    
    async initAlgolia() {
        // Dynamically import Algolia if available
        const { algoliasearch } = await import('https://cdn.jsdelivr.net/npm/algoliasearch@4/dist/algoliasearch.umd.js');
        
        // Get config from server
        const config = await fetch('/api/algolia-config').then(r => r.json());
        
        this.client = algoliasearch(config.appId, config.apiKey);
        this.index = this.client.initIndex(config.indexName || 'woocommerce_products');
        
        console.log('✅ Algolia client initialized');
    }
    
    setupEventListeners() {
        // Search input
        this.searchInput.addEventListener('input', this.debounce(() => {
            this.performSearch();
        }, 300));
        
        // Filter buttons
        this.filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.setActiveFilter(btn.dataset.filter);
                this.performSearch();
            });
        });
    }
    
    setActiveFilter(filter) {
        this.currentFilter = filter;
        
        this.filterButtons.forEach(btn => {
            if (btn.dataset.filter === filter) {
                btn.className = 'filter-btn active px-3 py-1 rounded-full text-sm bg-qiq-gold text-qiq-dark';
            } else {
                btn.className = 'filter-btn px-3 py-1 rounded-full text-sm bg-qiq-dark border border-qiq-gold/30 text-white hover:bg-qiq-gold hover:text-qiq-dark transition-colors';
            }
        });
    }
    
    async performInitialSearch() {
        await this.performSearch();
    }
    
    async performSearch() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading();
        
        try {
            const query = this.searchInput.value.trim();
            let results;
            
            if (this.index) {
                results = await this.searchAlgolia(query);
            } else {
                results = await this.searchSampleProducts(query);
            }
            
            this.searchResults = results;
            this.renderProducts(results);
            
        } catch (error) {
            console.error('Search error:', error);
            this.showError('حدث خطأ في البحث. يرجى المحاولة مرة أخرى.');
        } finally {
            this.isLoading = false;
        }
    }
    
    async searchAlgolia(query) {
        let searchParams = {
            hitsPerPage: 20,
            attributesToRetrieve: ['name', 'description', 'price', 'image', 'spec_sheet', 'category', 'objectID']
        };
        
        // Apply filters
        if (this.currentFilter !== 'all') {
            searchParams.filters = `category:${this.currentFilter}`;
        }
        
        const response = await this.index.search(query, searchParams);
        return response.hits;
    }
    
    async searchSampleProducts(query) {
        // Filter sample products based on query and filter
        let results = [...this.getSampleProducts()];
        
        if (query) {
            results = results.filter(product =>
                product.name.toLowerCase().includes(query.toLowerCase()) ||
                product.description.toLowerCase().includes(query.toLowerCase())
            );
        }
        
        if (this.currentFilter !== 'all') {
            results = results.filter(product => 
                product.category === this.currentFilter
            );
        }
        
        return results;
    }
    
    getSampleProducts() {
        return [
            {
                objectID: '1',
                name: 'سويتش 24 منفذ جيجابايت',
                description: 'سويتش مُدار 24 منفذ جيجابايت مع دعم VLAN وQoS',
                price: '2,850.00',
                image: '/images/switch-24port.jpg',
                category: 'switches',
                spec_sheet: '/datasheets/switch-24port.pdf'
            },
            {
                objectID: '2',
                name: 'راوتر إنتربرايز دوال باند',
                description: 'راوتر عالي الأداء للشركات مع دعم VPN وFirewall',
                price: '4,200.00',
                image: '/images/enterprise-router.jpg',
                category: 'routers',
                spec_sheet: '/datasheets/enterprise-router.pdf'
            },
            {
                objectID: '3',
                name: 'كابل شبكة Cat6 - 305 متر',
                description: 'كابل Cat6 UTP عالي الجودة للشبكات الداخلية',
                price: '890.00',
                image: '/images/cat6-cable.jpg',
                category: 'cables',
                spec_sheet: '/datasheets/cat6-cable.pdf'
            },
            {
                objectID: '4',
                name: 'سويتش 48 منفذ PoE+',
                description: 'سويتش مُدار 48 منفذ مع دعم Power over Ethernet',
                price: '6,750.00',
                image: '/images/switch-48poe.jpg',
                category: 'switches',
                spec_sheet: '/datasheets/switch-48poe.pdf'
            },
            {
                objectID: '5',
                name: 'راوتر واي فاي 6 للمكاتب',
                description: 'راوتر لاسلكي بتقنية Wi-Fi 6 للمكاتب الصغيرة والمتوسطة',
                price: '1,950.00',
                image: '/images/wifi6-router.jpg',
                category: 'routers',
                spec_sheet: '/datasheets/wifi6-router.pdf'
            },
            {
                objectID: '6',
                name: 'كابل فايبر أوبتك - 100 متر',
                description: 'كابل فايبر أوبتك أحادي الوضع لنقل البيانات عالي السرعة',
                price: '1,450.00',
                image: '/images/fiber-cable.jpg',
                category: 'cables',
                spec_sheet: '/datasheets/fiber-cable.pdf'
            }
        ];
    }
    
    renderProducts(products) {
        if (products.length === 0) {
            this.productsGrid.innerHTML = `
                <div class="text-center py-8 text-gray-400">
                    <i class="fas fa-search text-4xl mb-4 opacity-50"></i>
                    <p>لم يتم العثور على منتجات</p>
                    <p class="text-sm">جرب البحث بكلمات مختلفة أو تغيير الفلتر</p>
                </div>
            `;
            return;
        }
        
        this.productsGrid.innerHTML = products.map(product => `
            <div class="product-card bg-qiq-gray rounded-lg border border-qiq-gold/20 p-4 hover:border-qiq-gold/50 transition-all">
                <div class="flex items-center space-x-4 space-x-reverse">
                    <img src="${product.image || '/images/product-placeholder.jpg'}" 
                         alt="${product.name}" 
                         class="w-16 h-16 object-cover rounded-lg"
                         onerror="this.src='/images/product-placeholder.jpg'">
                    <div class="flex-1">
                        <h3 class="font-semibold text-white mb-1">${product.name}</h3>
                        <p class="text-sm text-gray-400 mb-2 line-clamp-2">${product.description}</p>
                        <div class="flex items-center justify-between">
                            <span class="text-qiq-gold font-bold">${product.price} ر.س</span>
                            <div class="flex space-x-2 space-x-reverse">
                                <button onclick="window.productViewer.viewProduct('${product.objectID}')" 
                                        class="text-qiq-gold hover:text-yellow-600 transition-colors">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button onclick="window.quoteManager.addToQuote('${product.objectID}')" 
                                        class="bg-qiq-gold text-qiq-dark px-3 py-1 rounded text-sm hover:bg-yellow-600 transition-colors">
                                    <i class="fas fa-plus mr-1"></i>
                                    إضافة
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    showLoading() {
        this.productsGrid.innerHTML = `
            <div class="text-center py-8">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-qiq-gold"></div>
                <p class="mt-2 text-gray-400">جارٍ البحث...</p>
            </div>
        `;
    }
    
    showError(message) {
        this.productsGrid.innerHTML = `
            <div class="text-center py-8 text-red-400">
                <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                <p>${message}</p>
            </div>
        `;
    }
    
    showAlgoliaNotConfigured() {
        console.warn('⚠️ Algolia not configured - using sample products');
    }
    
    debounce(func, wait) {
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
    
    getProductById(id) {
        return this.searchResults.find(p => p.objectID === id) || 
               this.getSampleProducts().find(p => p.objectID === id);
    }
}

// Product Viewer for Modal
class ProductViewer {
    constructor() {
        this.modal = document.getElementById('product-modal');
        this.modalTitle = document.getElementById('modal-title');
        this.modalContent = document.getElementById('modal-content');
        this.closeButton = document.getElementById('close-modal');
        
        this.init();
    }
    
    init() {
        this.closeButton.addEventListener('click', () => this.closeModal());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });
        
        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) {
                this.closeModal();
            }
        });
    }
    
    viewProduct(productId) {
        const product = window.algoliaIntegration.getProductById(productId);
        if (!product) return;
        
        this.modalTitle.textContent = product.name;
        this.modalContent.innerHTML = `
            <div class="space-y-4">
                <img src="${product.image || '/images/product-placeholder.jpg'}" 
                     alt="${product.name}" 
                     class="w-full h-64 object-cover rounded-lg"
                     onerror="this.src='/images/product-placeholder.jpg'">
            </div>
            <div class="space-y-4">
                <div>
                    <h4 class="text-lg font-semibold text-qiq-gold mb-2">الوصف</h4>
                    <p class="text-gray-300">${product.description}</p>
                </div>
                <div>
                    <h4 class="text-lg font-semibold text-qiq-gold mb-2">السعر</h4>
                    <p class="text-2xl font-bold text-qiq-gold">${product.price} ر.س</p>
                </div>
                ${product.spec_sheet ? `
                    <div>
                        <h4 class="text-lg font-semibold text-qiq-gold mb-2">المواصفات التقنية</h4>
                        <a href="${product.spec_sheet}" target="_blank" 
                           class="inline-flex items-center text-qiq-gold hover:text-yellow-600 transition-colors">
                            <i class="fas fa-file-pdf mr-2"></i>
                            عرض ورقة المواصفات
                        </a>
                    </div>
                ` : ''}
                <div class="flex space-x-4 space-x-reverse pt-4">
                    <button onclick="window.quoteManager.addToQuote('${product.objectID}')" 
                            class="bg-qiq-gold text-qiq-dark px-6 py-2 rounded-lg hover:bg-yellow-600 transition-colors">
                        <i class="fas fa-plus mr-2"></i>
                        إضافة إلى الاقتباس
                    </button>
                    <button onclick="window.productViewer.closeModal()" 
                            class="border border-qiq-gold/30 text-qiq-gold px-6 py-2 rounded-lg hover:border-qiq-gold hover:bg-qiq-gold hover:text-qiq-dark transition-colors">
                        إغلاق
                    </button>
                </div>
            </div>
        `;
        
        this.openModal();
    }
    
    openModal() {
        this.modal.classList.remove('hidden');
        this.modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
    }
    
    closeModal() {
        this.modal.classList.add('hidden');
        this.modal.classList.remove('flex');
        document.body.style.overflow = 'auto';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.algoliaIntegration = new AlgoliaIntegration();
    window.productViewer = new ProductViewer();
    
    console.log('🔍 Algolia integration initialized');
    console.log('👁️ Product viewer initialized');
});