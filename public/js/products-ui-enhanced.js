// Enhanced Product Card Renderer with Fixed UI Issues
// إصدار محسن لحل مشاكل الأزرار المكررة وتحسين التباين

(function() {
    // تحسين عرض الكروت مع إزالة التكرار
    window.hitToCard = function(hit) {
        // تحسين البيانات باستخدام ProductDataEnhancer إذا كان متوفراً
        const enhancedHit = window.productEnhancer ? window.productEnhancer.enhanceProduct(hit) : hit;
        
        const name = enhancedHit?.name || enhancedHit?.title || hit?.name || hit?.title || 'اسم غير معروف';
        const price = enhancedHit?.price || enhancedHit?.list_price || hit?.price || hit?.list_price || hit?.Price || '';
        const pn = enhancedHit?.sku || enhancedHit?.pn || enhancedHit?.mpn || hit?.pn || hit?.mpn || hit?.sku || hit?.SKU || hit?.part_number || hit?.objectID || '';
        const brand = enhancedHit?.brand || enhancedHit?.manufacturer || hit?.brand || hit?.manufacturer || hit?.vendor || hit?.company || 'غير محدد';
        const description = enhancedHit?.description || hit?.description || hit?.spec || hit?.details || '';
        
        // معالجة الصورة مع التحسينات - استخدام SVG احتياطي محلي بدل نطاقات خارجية
        const FALLBACK60 = 'data:image/svg+xml;utf8,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><rect width='100%' height='100%' fill='#f3f4f6'/><text x='50%' y='55%' dominant-baseline='middle' text-anchor='middle' fill='#9ca3af' font-size='14'>IMG</text></svg>");
        // إن وُجدت صورة أصلية استخدمها؛ وإلا اعرض SVG لحين التحميل عبر المعالج
        let image = enhancedHit?.image || hit?.image || hit?.image_url || hit?.thumbnail || '';
        if (!image) {
            image = FALLBACK60;
        }
        
        const link = pn ? `/products-list.html?q=${encodeURIComponent(pn)}` : '#';
        
        // تنظيف البيانات
        const safeName = escapeHtml(String(name));
        const safePrice = escapeHtml(String(price));
        const safePn = escapeHtml(String(pn));
        const safeBrand = escapeHtml(String(brand));
        const safeDesc = escapeHtml(String(description)).slice(0, 150) + (description.length > 150 ? '...' : '');
        const safeImage = escapeHtml(image);
        const safeLink = escapeHtml(link);
        const cardId = `card_${hit?.objectID || pn || Math.random().toString(36).substr(2, 9)}`;

        // تحديد لون الأزرار بناءً على الحالة
        const favoriteClass = window.QiqFavorites?.isInFavorites?.(hit?.objectID || pn) ? 'btn success active' : 'btn ghost';
        const compareClass = window.QiqComparison?.isInComparison?.(hit?.objectID || pn) ? 'btn success active' : 'btn ghost';

        const cardHTML = `
        <div class="card" data-id="${safePn}" id="${cardId}">
          <img src="${safeImage}" 
              alt="${safeName}" 
              class="product-image"
              data-product='${escapeHtml(JSON.stringify(enhancedHit || hit))}'
                 data-size="small"
                 onerror="this.src='${FALLBACK60}'; this.onerror=null;" 
                 loading="lazy" />
            
            <div class="card-content">
                <div class="name">${safeName}</div>
                ${safeDesc ? `<div class="description">${safeDesc}</div>` : ''}
                
                <div class="chips">
                    ${safePn ? `<span class="chip">PN: ${safePn}</span>` : ''}
                    ${safeBrand !== 'غير محدد' ? `<span class="chip">${safeBrand}</span>` : ''}
                    ${safePrice ? `<span class="chip price">${safePrice} ${window.QiqSession?.currency || 'EGP'}</span>` : ''}
                </div>
            </div>
            
            <div class="card-actions">
                <button class="btn" 
                        onclick="handleAddToQuote(this)"
                        data-name="${safeName}"
                        data-price="${safePrice}"
                        data-pn="${safePn}"
                        data-image="${safeImage}"
                        data-link="${safeLink}"
                        data-manufacturer="${safeBrand}"
                        data-source="Catalog"
                        title="إضافة للعرض">
                    ➕ إضافة
                </button>
                
                <button class="${compareClass} cmp-btn" 
                        onclick="handleComparisonToggle(this)"
                        data-id="${hit?.objectID || pn}"
                        data-name="${safeName}"
                        data-price="${safePrice}"
                        data-image="${safeImage}"
                        data-pn="${safePn}"
                        data-brand="${safeBrand}"
                        title="إضافة للمقارنة">
                    ⚖️
                </button>
                
                <button class="${favoriteClass} fav-btn" 
                        onclick="handleFavoriteToggle(this)"
                        data-id="${hit?.objectID || pn}"
                        data-name="${safeName}"
                        data-price="${safePrice}"
                        data-image="${safeImage}"
                        data-pn="${safePn}"
                        data-brand="${safeBrand}"
                        title="إضافة للمفضلة">
                    ❤️
                </button>`;
        
        // تحسين الصورة بعد إنشاء البطاقة
        setTimeout(() => {
            const cardElement = document.getElementById(cardId);
            if (cardElement && window.productImageHandler) {
                const imgElement = cardElement.querySelector('.product-image');
                if (imgElement) {
                    window.productImageHandler.observeImage(imgElement);
                }
            }
        }, 100);
        
        return cardHTML +
                `${safeLink !== '#' ? `
                <a href="${safeLink}" class="btn ghost" target="_blank" title="عرض التفاصيل">
                    🔍
                </a>` : ''}
            </div>
        </div>`;
    };

    // معالجات الأحداث المحسنة
    window.handleAddToQuote = function(button) {
        try {
            // منع التكرار
            if (button.disabled) return;
            button.disabled = true;
            
            // تأثير بصري
            button.style.transform = 'scale(0.95)';
            setTimeout(() => {
                button.style.transform = '';
                button.disabled = false;
            }, 200);
            
            // إضافة للعرض
            if (window.AddToQuote) {
                window.AddToQuote(button);
                if (window.QiqToast?.success) {
                    window.QiqToast.success('تمت الإضافة للعرض ✅');
                }
            } else {
                console.warn('AddToQuote function not available');
            }
        } catch (error) {
            console.error('خطأ في إضافة المنتج:', error);
            button.disabled = false;
        }
    };

    window.handleComparisonToggle = function(button) {
        try {
            const productId = button.dataset.id;
            const product = {
                id: productId,
                name: button.dataset.name,
                price: button.dataset.price,
                image: button.dataset.image,
                sku: button.dataset.pn,
                manufacturer: button.dataset.brand
            };

            if (!window.QiqComparison) {
                if (window.QiqToast?.error) {
                    window.QiqToast.error('نظام المقارنة غير متاح');
                }
                return;
            }

            if (window.QiqComparison.isInComparison(productId)) {
                window.QiqComparison.remove(productId);
                button.classList.remove('active', 'success');
                button.classList.add('ghost');
                if (window.QiqToast?.info) {
                    window.QiqToast.info('تمت الإزالة من المقارنة');
                }
            } else {
                try {
                    window.QiqComparison.add(product);
                    button.classList.remove('ghost');
                    button.classList.add('active', 'success');
                    if (window.QiqToast?.success) {
                        window.QiqToast.success('تمت الإضافة للمقارنة ✅');
                    }
                } catch (err) {
                    if (window.QiqToast?.warning) {
                        window.QiqToast.warning(err?.message || 'تعذر الإضافة للمقارنة');
                    }
                }
            }
        } catch (error) {
            console.error('خطأ في المقارنة:', error);
        }
    };

    window.handleFavoriteToggle = function(button) {
        try {
            const productId = button.dataset.id;
            const product = {
                id: productId,
                name: button.dataset.name,
                price: button.dataset.price,
                image: button.dataset.image,
                sku: button.dataset.pn,
                manufacturer: button.dataset.brand
            };

            if (!window.QiqFavorites) {
                if (window.QiqToast?.error) {
                    window.QiqToast.error('نظام المفضلة غير متاح');
                }
                return;
            }

            if (window.QiqFavorites.isInFavorites(productId)) {
                window.QiqFavorites.remove(productId);
                button.classList.remove('active', 'success');
                button.classList.add('ghost');
                if (window.QiqToast?.info) {
                    window.QiqToast.info('تمت الإزالة من المفضلة');
                }
            } else {
                window.QiqFavorites.add(product);
                button.classList.remove('ghost');
                button.classList.add('active', 'success');
                if (window.QiqToast?.success) {
                    window.QiqToast.success('تمت الإضافة للمفضلة ✅');
                }
            }
        } catch (error) {
            console.error('خطأ في المفضلة:', error);
        }
    };

    // تحسين نافذة المقارنة
    window.enhanceComparisonModal = function() {
        const originalOpen = window.QiqComparison?.openModal;
        if (!originalOpen) return;

        window.QiqComparison.openModal = function() {
            try {
                // إظهار مؤشر التحميل
                if (window.QiqModal && window.QiqToast) {
                    window.QiqToast.info('جاري تحميل المقارنة...');
                    
                    // تحسين محتوى المقارنة
                    const products = this.getProducts();
                    const enhancedHTML = generateEnhancedComparison(products);
                    
                    window.QiqModal.open('', { 
                        html: enhancedHTML, 
                        title: 'مقارنة المنتجات',
                        size: 'lg'
                    });
                }
            } catch (error) {
                console.error('خطأ في فتح نافذة المقارنة:', error);
                // تراجع للطريقة الأصلية
                originalOpen.call(this);
            }
        };
    };

    // توليد محتوى المقارنة المحسن
    function generateEnhancedComparison(products) {
        if (!products || products.length === 0) {
            return `
                <div style="text-align: center; padding: 40px;">
                    <h3>لا توجد منتجات للمقارنة</h3>
                    <p>أضف منتجين أو أكثر للمقارنة بينهم</p>
                </div>`;
        }

        const features = [
            { key: 'name', label: 'اسم المنتج', type: 'text' },
            { key: 'manufacturer', label: 'الشركة المصنعة', type: 'text' },
            { key: 'sku', label: 'رقم المنتج', type: 'text' },
            { key: 'price', label: 'السعر', type: 'price' },
            { key: 'cpu', label: 'المعالج', type: 'text' },
            { key: 'ram', label: 'الذاكرة', type: 'text' },
            { key: 'ports', label: 'المنافذ', type: 'text' },
            { key: 'speed', label: 'السرعة', type: 'text' },
            { key: 'formFactor', label: 'الشكل', type: 'text' },
            { key: 'warranty', label: 'الضمان', type: 'text' }
        ];

        let html = `
        <div style="max-width: 100%; overflow-x: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3>مقارنة المنتجات (${products.length})</h3>
                <div>
                    <button onclick="exportComparisonToPDF()" class="btn success" style="margin-left: 8px;">
                        📄 تصدير PDF
                    </button>
                    <button onclick="clearAllComparison()" class="btn danger">
                        🗑️ مسح الكل
                    </button>
                </div>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                    <tr style="background: #f8fafc;">
                        <th style="text-align: right; padding: 12px; border: 1px solid #e5e7eb; width: 120px;">الخاصية</th>`;
        
        products.forEach((product, index) => {
            html += `
                <th style="text-align: center; padding: 12px; border: 1px solid #e5e7eb;">
                    <div style="display: flex; flex-direction: column; align-items: center;">
                    <img src="${product.image || FALLBACK60}" 
                        style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;"
                        onerror="this.src='${FALLBACK60}'" />
                        <button onclick="window.QiqComparison?.remove('${product.id}'); window.location.reload();" 
                                class="btn danger" style="padding: 4px 8px; font-size: 12px;">
                            ✕ إزالة
                        </button>
                    </div>
                </th>`;
        });

        html += `</tr></thead><tbody>`;

        features.forEach(feature => {
            html += `<tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600;">${feature.label}</td>`;
            
            products.forEach(product => {
                let value = getProductFeature(product, feature.key);
                
                if (value === null || value === undefined || value === '' || value === 'Unknown') {
                    value = '-';
                }
                
                if (feature.type === 'price' && value !== '-') {
                    value = `${value} ${window.QiqSession?.currency || 'EGP'}`;
                }
                
                html += `<td style="padding: 8px 12px; border: 1px solid #e5e7eb; text-align: center;">${escapeHtml(String(value))}</td>`;
            });
            
            html += `</tr>`;
        });

        html += `
            </tbody>
            </table>
            
            <div style="margin-top: 20px; text-align: center;">
                <button onclick="addAllToQuote()" class="btn success" style="padding: 12px 24px;">
                    ➕ إضافة الكل للعرض
                </button>
            </div>
        </div>

        <script>
            function getProductFeature(product, key) {
                // محاولة الحصول على البيانات من مصادر متعددة
                const mappings = {
                    'cpu': ['cpu', 'processor', 'CPU', 'Processor'],
                    'ram': ['ram', 'memory', 'RAM', 'Memory', 'الذاكرة'],
                    'ports': ['ports', 'port_count', 'Ports', 'منافذ'],
                    'speed': ['speed', 'bandwidth', 'throughput', 'السرعة'],
                    'formFactor': ['form_factor', 'formFactor', 'form', 'الشكل'],
                    'warranty': ['warranty', 'الضمان']
                };
                
                if (mappings[key]) {
                    for (let field of mappings[key]) {
                        if (product[field] !== undefined && product[field] !== null && product[field] !== '') {
                            return product[field];
                        }
                    }
                }
                
                return product[key] || '-';
            }
            
            function clearAllComparison() {
                if (window.QiqComparison) {
                    window.QiqComparison.clear();
                    window.QiqModal?.close();
                    if (window.QiqToast?.success) {
                        window.QiqToast.success('تم مسح جميع المنتجات من المقارنة');
                    }
                }
            }
            
            function addAllToQuote() {
                if (window.QiqComparison && window.AddToQuote) {
                    const products = window.QiqComparison.getProducts();
                    products.forEach(product => {
                        const fakeButton = {
                            dataset: {
                                name: product.name,
                                price: product.price,
                                pn: product.sku,
                                image: product.image,
                                manufacturer: product.manufacturer,
                                source: 'Comparison'
                            }
                        };
                        window.AddToQuote(fakeButton);
                    });
                    
                    if (window.QiqToast?.success) {
                        window.QiqToast.success(\`تم إضافة \${products.length} منتجات للعرض\`);
                    }
                }
            }
            
            function exportComparisonToPDF() {
                // سيتم التنفيذ لاحقاً - ربط مع نظام PDF الموجود
                if (window.QiqToast?.info) {
                    window.QiqToast.info('ميزة تصدير PDF قيد التطوير');
                }
            }
        </script>`;

        return html;
    }

    // دالة مساعدة للحصول على خاصية المنتج
    function getProductFeature(product, key) {
        const mappings = {
            'cpu': ['cpu', 'processor', 'CPU', 'Processor'],
            'ram': ['ram', 'memory', 'RAM', 'Memory', 'الذاكرة'],
            'ports': ['ports', 'port_count', 'Ports', 'منافذ'],
            'speed': ['speed', 'bandwidth', 'throughput', 'السرعة'],
            'formFactor': ['form_factor', 'formFactor', 'form', 'الشكل'],
            'warranty': ['warranty', 'الضمان']
        };
        
        if (mappings[key]) {
            for (let field of mappings[key]) {
                if (product[field] !== undefined && product[field] !== null && product[field] !== '') {
                    return product[field];
                }
            }
        }
        
        return product[key] || null;
    }

    // دالة مساعدة لتنظيف HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // تهيئة التحسينات عند تحميل الصفحة
    document.addEventListener('DOMContentLoaded', function() {
        // تحسين نافذة المقارنة
        setTimeout(() => {
            enhanceComparisonModal();
        }, 1000);
        
        // إضافة أنماط CSS إضافية
        const style = document.createElement('style');
        style.textContent = `
            .card-actions .btn {
                min-width: 40px;
                font-size: 12px;
                padding: 6px 8px;
            }
            
            .card-actions .btn:not(.ghost) {
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            .card-actions .btn.active {
                animation: pulse 0.3s ease;
            }
            
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
            
            .comparison-table {
                font-size: 13px;
                line-height: 1.4;
            }
            
            .comparison-table th,
            .comparison-table td {
                border: 1px solid #e5e7eb;
                padding: 8px 12px;
                text-align: center;
            }
            
            .comparison-table th {
                background: #f8fafc;
                font-weight: 600;
            }
            
            .loading-spinner {
                display: inline-block;
                width: 20px;
                height: 20px;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #3498db;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    });
})();