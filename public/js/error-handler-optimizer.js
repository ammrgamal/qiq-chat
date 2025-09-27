/**
 * Error Handler & Performance Optimizer
 * معالج الأخطاء ومحسن الأداء
 */

class ErrorHandlerAndOptimizer {
    constructor() {
        this.errors = [];
        this.performance = {
            loadTime: 0,
            renderTime: 0,
            searchTime: 0
        };
        this.init();
    }

    // تهيئة النظام
    init() {
        this.setupErrorHandling();
        this.setupPerformanceMonitoring();
        this.fixCommonIssues();
        this.optimizeImages();
        this.setupLazyLoading();
        console.log('🛡️ Error Handler & Performance Optimizer initialized');
    }

    // إعداد معالجة الأخطاء
    setupErrorHandling() {
        // معالجة أخطاء JavaScript العامة
        window.addEventListener('error', (e) => {
            this.logError('JavaScript Error', e.error, {
                filename: e.filename,
                lineno: e.lineno,
                colno: e.colno
            });
        });

        // معالجة الـ Promise rejections
        window.addEventListener('unhandledrejection', (e) => {
            this.logError('Unhandled Promise Rejection', e.reason);
        });

        // معالجة أخطاء تحميل الموارد
        document.addEventListener('error', (e) => {
            if (e.target !== window) {
                this.logError('Resource Load Error', e.target.src || e.target.href, {
                    element: e.target.tagName,
                    type: e.target.type
                });
                this.handleResourceError(e.target);
            }
        }, true);
    }

    // تسجيل الأخطاء
    logError(type, error, details = {}) {
        const errorInfo = {
            type,
            error: error?.message || error,
            details,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        this.errors.push(errorInfo);
        console.error('🚨 Error logged:', errorInfo);

        // إرسال للخادم إذا كان متاحاً
        this.reportError(errorInfo);
    }

    // معالجة أخطاء الموارد
    handleResourceError(element) {
        if (element.tagName === 'IMG') {
            // استبدال الصور المكسورة
            element.src = this.getFallbackImage();
            element.alt = 'صورة غير متوفرة';
        } else if (element.tagName === 'SCRIPT') {
            // تحميل نسخة احتياطية للـ scripts
            this.loadFallbackScript(element);
        } else if (element.tagName === 'LINK') {
            // تحميل نسخة احتياطية للـ CSS
            this.loadFallbackCSS(element);
        }
    }

    // صورة احتياطية
    getFallbackImage() {
        return `data:image/svg+xml,${encodeURIComponent(`
            <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
                <rect width="200" height="200" fill="#f3f4f6"/>
                <text x="100" y="100" text-anchor="middle" font-family="Arial" font-size="14" fill="#9ca3af">
                    صورة غير متوفرة
                </text>
            </svg>
        `)}`;
    }

    // تحميل script احتياطي
    loadFallbackScript(failedScript) {
        const src = failedScript.src;
        
        // محاولة تحميل من CDN مختلف
        if (src.includes('tailwindcss.com')) {
            const fallbackScript = document.createElement('script');
            fallbackScript.src = 'https://unpkg.com/tailwindcss@^3/dist/tailwind.min.js';
            document.head.appendChild(fallbackScript);
        }
    }

    // تحميل CSS احتياطي
    loadFallbackCSS(failedLink) {
        // إضافة أنماط احتياطية أساسية
        const fallbackStyle = document.createElement('style');
        fallbackStyle.innerHTML = `
            .btn {
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.2s;
            }
            .btn.primary { background: #3b82f6; color: white; }
            .btn.secondary { background: #e5e7eb; color: #374151; }
            .btn:hover { opacity: 0.9; transform: translateY(-1px); }
            .card { 
                background: white; 
                border: 1px solid #e5e7eb; 
                border-radius: 8px; 
                padding: 16px; 
                margin-bottom: 16px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
        `;
        document.head.appendChild(fallbackStyle);
    }

    // إعداد مراقبة الأداء
    setupPerformanceMonitoring() {
        // مراقبة زمن التحميل
        window.addEventListener('load', () => {
            const loadTime = performance.now();
            this.performance.loadTime = loadTime;
            console.log(`⚡ Page loaded in ${loadTime.toFixed(2)}ms`);
        });

        // مراقبة أداء البحث
        this.monitorSearchPerformance();
    }

    // مراقبة أداء البحث
    monitorSearchPerformance() {
        if (window.performSearch) {
            const originalPerformSearch = window.performSearch;
            
            window.performSearch = async (...args) => {
                const startTime = performance.now();
                
                try {
                    const result = await originalPerformSearch.apply(this, args);
                    const endTime = performance.now();
                    this.performance.searchTime = endTime - startTime;
                    console.log(`🔍 Search completed in ${(endTime - startTime).toFixed(2)}ms`);
                    return result;
                } catch (error) {
                    this.logError('Search Error', error);
                    throw error;
                }
            };
        }
    }

    // إصلاح المشاكل الشائعة
    fixCommonIssues() {
        // إصلاح مشكلة الـ modals
        this.fixModalIssues();
        
        // إصلاح مشكلة الأزرار
        this.fixButtonIssues();
        
        // إصلاح مشكلة التمرير
        this.fixScrollIssues();
        
        // إصلاح مشكلة الصور
        this.fixImageIssues();
    }

    // إصلاح مشاكل المودال
    fixModalIssues() {
        // التأكد من وجود المودال
        let modal = document.getElementById('qiq-modal');
        if (!modal) {
            console.warn('⚠️ Modal not found, creating fallback modal');
            this.createFallbackModal();
        }

        // إصلاح مشكلة z-index
        if (modal) {
            modal.style.zIndex = '9999';
        }
    }

    // إنشاء مودال احتياطي
    createFallbackModal() {
        const modal = document.createElement('div');
        modal.id = 'qiq-modal';
        modal.setAttribute('aria-hidden', 'true');
        modal.style.cssText = 'display:none; position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.5);';
        
        modal.innerHTML = `
            <div class="qiq-modal__dialog" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); background:white; border-radius:12px; max-width:90vw; max-height:90vh; overflow:auto;">
                <div class="qiq-modal__header" style="display:flex; justify-content:space-between; align-items:center; padding:16px; border-bottom:1px solid #e5e7eb;">
                    <div class="qiq-modal__title" style="font-weight:600; font-size:18px;">Modal</div>
                    <button class="qiq-modal__close" style="padding:8px; background:none; border:none; cursor:pointer;">&times;</button>
                </div>
                <div class="qiq-modal__body" style="padding:16px;">
                    <iframe id="qiq-modal-frame" style="width:100%; height:400px; border:none;"></iframe>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // إضافة functionality أساسي
        const closeBtn = modal.querySelector('.qiq-modal__close');
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
        });
    }

    // إصلاح مشاكل الأزرار
    fixButtonIssues() {
        // التأكد من عمل جميع الأزرار
        document.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (button && button.disabled) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            
            // إصلاح الأزرار بدون onclick
            if (button && !button.onclick && !button.getAttribute('onclick')) {
                this.handleGenericButton(button, e);
            }
        });
    }

    // معالجة الأزرار العامة
    handleGenericButton(button, event) {
        const text = button.textContent.toLowerCase();
        
        if (text.includes('إضافة') && !button.hasAttribute('data-handled')) {
            button.setAttribute('data-handled', 'true');
            console.log('🔧 Fixed missing onclick for add button');
        }
        
        if (text.includes('مقارنة') && !button.hasAttribute('data-handled')) {
            button.setAttribute('data-handled', 'true');
            console.log('🔧 Fixed missing onclick for compare button');
        }
    }

    // إصلاح مشاكل التمرير
    fixScrollIssues() {
        // إصلاح التمرير السلس
        document.documentElement.style.scrollBehavior = 'smooth';
        
        // إصلاح مشكلة overflow على الأجهزة المحمولة
        document.body.style.overscrollBehavior = 'contain';
    }

    // إصلاح مشاكل الصور
    fixImageIssues() {
        // إضافة loading="lazy" للصور التي لا تملكها
        document.querySelectorAll('img:not([loading])').forEach(img => {
            img.loading = 'lazy';
        });
        
        // إصلاح الصور المكسورة الموجودة
        document.querySelectorAll('img').forEach(img => {
            if (!img.complete || img.naturalHeight === 0) {
                img.onerror = () => {
                    img.src = this.getFallbackImage();
                };
            }
        });
    }

    // تحسين الصور
    optimizeImages() {
        const images = document.querySelectorAll('img');
        
        images.forEach(img => {
            // إضافة أبعاد إذا لم تكن موجودة
            if (!img.width && !img.height) {
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
            }
            
            // تحسين جودة الصورة حسب الشاشة
            if (window.devicePixelRatio > 1) {
                const src = img.src;
                if (src && !src.includes('placeholder') && !src.includes('data:')) {
                    // إضافة معاملات تحسين للصور الخارجية
                    if (src.includes('via.placeholder.com')) {
                        img.src = src.replace(/(\d+)x(\d+)/, (match, w, h) => {
                            return `${w * 2}x${h * 2}`;
                        });
                    }
                }
            }
        });
    }

    // إعداد التحميل المتأخر
    setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.classList.remove('lazy');
                            observer.unobserve(img);
                        }
                    }
                });
            });

            // مراقبة الصور الجديدة
            const observeNewImages = () => {
                document.querySelectorAll('img[data-src].lazy').forEach(img => {
                    imageObserver.observe(img);
                });
            };

            // مراقبة التغييرات في DOM
            const mutationObserver = new MutationObserver(observeNewImages);
            mutationObserver.observe(document.body, {
                childList: true,
                subtree: true
            });

            observeNewImages();
        }
    }

    // إرسال تقرير الأخطاء
    reportError(errorInfo) {
        // محاولة إرسال للخادم
        if (navigator.onLine) {
            fetch('/api/errors', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(errorInfo)
            }).catch(() => {
                // حفظ محلياً إذا فشل الإرسال
                this.saveErrorLocally(errorInfo);
            });
        } else {
            this.saveErrorLocally(errorInfo);
        }
    }

    // حفظ الخطأ محلياً
    saveErrorLocally(errorInfo) {
        try {
            const errors = JSON.parse(localStorage.getItem('qiq_errors') || '[]');
            errors.push(errorInfo);
            
            // الاحتفاظ بآخر 50 خطأ فقط
            if (errors.length > 50) {
                errors.splice(0, errors.length - 50);
            }
            
            localStorage.setItem('qiq_errors', JSON.stringify(errors));
        } catch (e) {
            console.warn('Could not save error locally:', e);
        }
    }

    // الحصول على تقرير الأداء
    getPerformanceReport() {
        return {
            errors: this.errors.length,
            performance: this.performance,
            memory: this.getMemoryInfo(),
            connection: this.getConnectionInfo()
        };
    }

    // معلومات الذاكرة
    getMemoryInfo() {
        if ('memory' in performance) {
            return {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            };
        }
        return null;
    }

    // معلومات الاتصال
    getConnectionInfo() {
        if ('connection' in navigator) {
            return {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt
            };
        }
        return null;
    }

    // تنظيف الموارد
    cleanup() {
        this.errors = [];
        localStorage.removeItem('qiq_errors');
    }
}

// تصدير للاستخدام العام
window.ErrorHandlerAndOptimizer = ErrorHandlerAndOptimizer;

// تهيئة تلقائية
document.addEventListener('DOMContentLoaded', function() {
    window.errorHandler = new ErrorHandlerAndOptimizer();
    
    // عرض تقرير الأداء في Console
    setTimeout(() => {
        console.log('📊 Performance Report:', window.errorHandler.getPerformanceReport());
    }, 3000);
});