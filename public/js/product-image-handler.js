/**
 * Product Image Handler
 * معالج صور المنتجات مع صور احتياطية ذكية
 */

class ProductImageHandler {
    constructor() {
        this.imageCache = new Map();
        this.fallbackStrategies = this.getFallbackStrategies();
        this.brandLogos = this.getBrandLogos();
        this.categoryIcons = this.getCategoryIcons();
        this.initImageOptimization();
    }

    // استراتيجيات الصور الاحتياطية
    getFallbackStrategies() {
        return [
            'brand-logo',      // شعار الشركة
            'category-icon',   // أيقونة الفئة
            'placeholder',     // صورة احتياطية
            'generated'        // صورة مولدة
        ];
    }

    // شعارات الشركات
    getBrandLogos() {
        return {
            'cisco': 'https://cdn.worldvectorlogo.com/logos/cisco-2.svg',
            'hp': 'https://cdn.worldvectorlogo.com/logos/hp-3.svg',
            'hewlett packard': 'https://cdn.worldvectorlogo.com/logos/hp-3.svg',
            'dell': 'https://cdn.worldvectorlogo.com/logos/dell-2.svg',
            'aruba': 'https://cdn.worldvectorlogo.com/logos/aruba-3.svg',
            'fortinet': 'https://cdn.worldvectorlogo.com/logos/fortinet.svg',
            'sonicwall': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyH8mKLY5o4vLXGTCBN0wE8Q8nK4H0_4Yhjg&s',
            'ubiquiti': 'https://cdn.worldvectorlogo.com/logos/ubiquiti.svg',
            'tp-link': 'https://cdn.worldvectorlogo.com/logos/tp-link.svg',
            'd-link': 'https://cdn.worldvectorlogo.com/logos/d-link.svg',
            'netgear': 'https://cdn.worldvectorlogo.com/logos/netgear.svg',
            'linksys': 'https://cdn.worldvectorlogo.com/logos/linksys.svg',
            'mikrotik': 'https://cdn.worldvectorlogo.com/logos/mikrotik.svg',
            'juniper': 'https://cdn.worldvectorlogo.com/logos/juniper-networks.svg'
        };
    }

    // أيقونات الفئات
    getCategoryIcons() {
        return {
            'switch': '🔄',
            'router': '🌐',
            'access point': '📡',
            'firewall': '🔒',
            'cable': '🔌',
            'camera': '📹',
            'ups': '🔋',
            'server': '🖥️',
            'storage': '💽',
            'laptop': '💻',
            'desktop': '🖥️',
            'monitor': '🖱️',
            'printer': '🖨️',
            'scanner': '📄'
        };
    }

    // تهيئة تحسين الصور
    initImageOptimization() {
        // Intersection Observer لتحميل الصور عند الحاجة
        this.imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.loadImage(entry.target);
                    this.imageObserver.unobserve(entry.target);
                }
            });
        }, { rootMargin: '50px' });
    }

    // معالجة صورة المنتج
    async processProductImage(product, options = {}) {
        const { 
            size = 'medium',
            quality = 'auto',
            fallback = true,
            cache = true 
        } = options;

        const cacheKey = `${product.id}_${size}_${quality}`;
        
        if (cache && this.imageCache.has(cacheKey)) {
            return this.imageCache.get(cacheKey);
        }

        let imageUrl = await this.findBestImage(product, size);
        
        if (!imageUrl && fallback) {
            imageUrl = await this.generateFallbackImage(product, size);
        }

        const processedImage = {
            url: imageUrl,
            alt: this.generateAltText(product),
            loading: 'lazy',
            onerror: `this.src='${this.getUltimateFallback(size)}'; this.onerror=null;`
        };

        if (cache) {
            this.imageCache.set(cacheKey, processedImage);
        }

        return processedImage;
    }

    // البحث عن أفضل صورة
    async findBestImage(product, size) {
        const imageSources = [
            product.image,
            product.imageUrl,
            product.image_url,
            product.thumbnail,
            product.photo,
            product.picture
        ].filter(Boolean);

        for (const imageUrl of imageSources) {
            if (await this.isImageValid(imageUrl)) {
                return this.optimizeImageUrl(imageUrl, size);
            }
        }

        return null;
    }

    // التحقق من صحة الصورة
    async isImageValid(imageUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            const timeout = setTimeout(() => {
                resolve(false);
            }, 3000);

            img.onload = () => {
                clearTimeout(timeout);
                resolve(true);
            };
            
            img.onerror = () => {
                clearTimeout(timeout);
                resolve(false);
            };

            img.src = imageUrl;
        });
    }

    // تحسين رابط الصورة
    optimizeImageUrl(imageUrl, size) {
        // إضافة معاملات التحسين حسب الحاجة
        const sizeMap = {
            small: 100,
            medium: 200,
            large: 400
        };

        const targetSize = sizeMap[size] || 200;
        
        // للصور من خدمات التحسين المختلفة
        if (imageUrl.includes('cloudinary.com')) {
            return imageUrl.replace('/upload/', `/upload/w_${targetSize},q_auto,f_auto/`);
        }
        
        if (imageUrl.includes('amazonaws.com')) {
            return `${imageUrl}?w=${targetSize}&q=80&f=webp`;
        }

        return imageUrl;
    }

    // إنتاج صورة احتياطية
    async generateFallbackImage(product, size) {
        for (const strategy of this.fallbackStrategies) {
            const fallbackUrl = await this.applyFallbackStrategy(product, strategy, size);
            if (fallbackUrl) {
                return fallbackUrl;
            }
        }
        
        return this.getUltimateFallback(size);
    }

    // تطبيق استراتيجية الاحتياطي
    async applyFallbackStrategy(product, strategy, size) {
        switch (strategy) {
            case 'brand-logo':
                return this.getBrandLogo(product);
                
            case 'category-icon':
                return this.getCategoryIcon(product);
                
            case 'placeholder':
                return this.getPlaceholderImage(product, size);
                
            case 'generated':
                return this.generateProductImage(product, size);
                
            default:
                return null;
        }
    }

    // الحصول على شعار الشركة
    getBrandLogo(product) {
        const brand = (product.brand || product.manufacturer || '').toLowerCase();
        return this.brandLogos[brand] || null;
    }

    // الحصول على أيقونة الفئة
    getCategoryIcon(product) {
        const category = this.extractCategory(product);
        const icon = this.categoryIcons[category];
        
        if (icon) {
            return `data:image/svg+xml,${encodeURIComponent(`
                <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
                    <rect width="200" height="200" fill="#f8fafc" rx="12"/>
                    <text x="100" y="120" text-anchor="middle" font-size="60" font-family="Arial">
                        ${icon}
                    </text>
                </svg>
            `)}`;
        }
        
        return null;
    }

    // استخراج الفئة
    extractCategory(product) {
        const text = ((product.name || '') + ' ' + (product.description || '') + ' ' + (product.category || '')).toLowerCase();
        
        const categories = Object.keys(this.categoryIcons);
        for (const category of categories) {
            if (text.includes(category)) {
                return category;
            }
        }
        
        return 'default';
    }

    // الحصول على صورة placeholder
    getPlaceholderImage(product, size) {
        // استخدم SVG محلي بسيط بدل نطاقات خارجية
        const sizeValue = size === 'small' ? 100 : size === 'large' ? 400 : 200;
        const productName = (product.name || 'منتج').substring(0, 12);
        return `data:image/svg+xml,${encodeURIComponent(`
            <svg width="${sizeValue}" height="${sizeValue}" xmlns="http://www.w3.org/2000/svg">
                <rect width="${sizeValue}" height="${sizeValue}" fill="#e5e7eb" rx="10"/>
                <text x="50%" y="54%" text-anchor="middle" font-size="${Math.max(10, Math.floor(sizeValue/10))}" font-family="Arial" fill="#6b7280">${productName}</text>
            </svg>
        `)}`;
    }

    // إنتاج صورة المنتج
    generateProductImage(product, size) {
        const sizeValue = size === 'small' ? 100 : size === 'large' ? 400 : 200;
        const productName = (product.name || 'منتج').substring(0, 30);
        const brand = product.brand || product.manufacturer || '';
        const category = this.extractCategory(product);
        const icon = this.categoryIcons[category] || '📦';
        
        return `data:image/svg+xml,${encodeURIComponent(`
            <svg width="${sizeValue}" height="${sizeValue}" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#f8fafc;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#e5e7eb;stop-opacity:1" />
                    </linearGradient>
                </defs>
                <rect width="${sizeValue}" height="${sizeValue}" fill="url(#bg)" rx="12"/>
                <rect x="20" y="20" width="${sizeValue-40}" height="${sizeValue-40}" fill="white" rx="8" opacity="0.8"/>
                
                <text x="${sizeValue/2}" y="${sizeValue/2 - 20}" text-anchor="middle" font-size="${sizeValue/8}" font-family="Arial" fill="#374151">
                    ${icon}
                </text>
                
                <text x="${sizeValue/2}" y="${sizeValue/2 + 10}" text-anchor="middle" font-size="${sizeValue/20}" font-family="Arial" fill="#6b7280" font-weight="600">
                    ${productName}
                </text>
                
                ${brand ? `<text x="${sizeValue/2}" y="${sizeValue/2 + 30}" text-anchor="middle" font-size="${sizeValue/25}" font-family="Arial" fill="#9ca3af">
                    ${brand}
                </text>` : ''}
            </svg>
        `)}`;
    }

    // الاحتياطي الأخير
    getUltimateFallback(size) {
        const sizeValue = size === 'small' ? 100 : size === 'large' ? 400 : 200;
        
        return `data:image/svg+xml,${encodeURIComponent(`
            <svg width="${sizeValue}" height="${sizeValue}" xmlns="http://www.w3.org/2000/svg">
                <rect width="${sizeValue}" height="${sizeValue}" fill="#f3f4f6" rx="8"/>
                <text x="${sizeValue/2}" y="${sizeValue/2 - 10}" text-anchor="middle" font-size="${sizeValue/6}" fill="#9ca3af">
                    📦
                </text>
                <text x="${sizeValue/2}" y="${sizeValue/2 + 15}" text-anchor="middle" font-size="${sizeValue/15}" font-family="Arial" fill="#6b7280">
                    منتج
                </text>
            </svg>
        `)}`;
    }

    // إنتاج النص البديل
    generateAltText(product) {
        const name = product.name || 'منتج غير معروف';
        const brand = product.brand || product.manufacturer;
        const category = this.extractCategory(product);
        
        let altText = name;
        if (brand) altText += ` من ${brand}`;
        if (category && category !== 'default') altText += ` - ${category}`;
        
        return altText;
    }

    // تحميل صورة مع مراقبة التقاطع
    observeImage(imgElement) {
        if (this.imageObserver) {
            this.imageObserver.observe(imgElement);
        }
    }

    // تحميل الصورة
    async loadImage(imgElement) {
        const productData = JSON.parse(imgElement.dataset.product || '{}');
        const size = imgElement.dataset.size || 'medium';
        
        let imageData = await this.processProductImage(productData, { size });
        // إن لم تتوفر صورة مناسبة جرّب نقطة إثراء الصور/المواصفات في الخلفية
        if (!imageData?.url || imageData.url.startsWith('data:image') ) {
            try {
                const resp = await fetch('/api/media-enrich', {
                    method: 'POST', headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ product: productData })
                });
                if (resp.ok) {
                    const j = await resp.json();
                    const img = j?.data?.image;
                    const specs = j?.data?.specs;
                    if (img && typeof img === 'string') {
                        imageData.url = img;
                        try {
                            // حدّث البيانات المضمّنة داخل العنصر ليستفيد باقي النظام
                            const merged = { ...(productData||{}), image: img };
                            if (specs && typeof specs === 'object') merged.specifications = Object.assign({}, merged.specifications||{}, specs);
                            imgElement.dataset.product = JSON.stringify(merged);
                            // أبلغ النظام بقدوم مواصفات/صورة جديدة
                            const ev = new CustomEvent('productEnriched', { detail: { product: merged, image: img, specs: specs||{} } });
                            document.dispatchEvent(ev);
                        } catch {}
                    }
                }
            } catch {}
        }
        
        // تطبيق البيانات المحسنة
        imgElement.src = imageData.url;
        imgElement.alt = imageData.alt;
        imgElement.onerror = new Function(imageData.onerror);
        
        // إضافة animation للتحميل
        imgElement.style.opacity = '0';
        imgElement.style.transition = 'opacity 0.3s ease';
        
        imgElement.onload = () => {
            imgElement.style.opacity = '1';
            imgElement.classList.add('loaded');
        };
    }

    // مسح ذاكرة التخزين المؤقت
    clearCache() {
        this.imageCache.clear();
    }

    // الحصول على إحصائيات ذاكرة التخزين المؤقت
    getCacheStats() {
        return {
            size: this.imageCache.size,
            keys: Array.from(this.imageCache.keys())
        };
    }
}

// تصدير للاستخدام العام
window.ProductImageHandler = ProductImageHandler;

// تهيئة معالج الصور
document.addEventListener('DOMContentLoaded', function() {
    window.productImageHandler = new ProductImageHandler();
    
    // تحسين تحميل الصور في البطاقات
    const originalHitToCard = window.hitToCard;
    if (originalHitToCard) {
        window.hitToCard = async function(hit) {
            const cardHTML = originalHitToCard(hit);
            
            // تحسين صور البطاقات
            setTimeout(async () => {
                const cardImages = document.querySelectorAll('.product-card img[data-product]');
                cardImages.forEach(img => {
                    window.productImageHandler.observeImage(img);
                });
            }, 100);
            
            return cardHTML;
        };
    }
});

// دالة مساعدة لإنشاء عنصر صورة محسن
function createEnhancedProductImage(product, options = {}) {
    const {
        size = 'medium',
        className = '',
        style = '',
        lazy = true
    } = options;
    
    const img = document.createElement('img');
    img.dataset.product = JSON.stringify(product);
    img.dataset.size = size;
    img.className = `product-image ${className}`.trim();
    img.style.cssText = style;
    
    if (lazy) {
        img.loading = 'lazy';
        window.productImageHandler?.observeImage(img);
    } else {
        window.productImageHandler?.loadImage(img);
    }
    
    return img;
}

// تصدير للاستخدام العام
window.createEnhancedProductImage = createEnhancedProductImage;