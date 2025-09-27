/**
 * Interface Fixes & Enhancements
 * إصلاحات وتحسينات الواجهة
 */

class InterfaceFixes {
    constructor() {
        this.init();
    }

    init() {
        // انتظار تحميل DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.applyFixes());
        } else {
            this.applyFixes();
        }
    }

    applyFixes() {
        this.fixButtons();
        this.improveLayout();
        this.addProfessionalStyling();
        this.fixComparison();
        this.addProductCounters();
        this.enhanceVisualHierarchy();
        this.fixQuoteWizard();
        console.log('🔧 Interface fixes applied');
    }

    // إصلاح الأزرار
    fixButtons() {
        // تحسين جميع الأزرار
        document.querySelectorAll('button, .btn').forEach(button => {
            if (!button.classList.contains('fixed')) {
                button.classList.add('btn', 'fixed');
                
                // تحديد نوع الزر حسب النص أو الكلاس
                const text = button.textContent.toLowerCase();
                const classes = button.className.toLowerCase();
                
                if (text.includes('add') || text.includes('إضافة') || classes.includes('add')) {
                    button.classList.add('btn-primary');
                    this.enhanceAddButton(button);
                } else if (text.includes('compare') || text.includes('مقارنة')) {
                    button.classList.add('btn-secondary');
                    this.enhanceCompareButton(button);
                } else if (text.includes('search') || text.includes('بحث')) {
                    button.classList.add('btn-primary');
                } else if (text.includes('filter') || text.includes('فلتر')) {
                    button.classList.add('btn-secondary');
                } else {
                    button.classList.add('btn-secondary');
                }
                
                // إضافة تأثيرات التفاعل
                this.addButtonInteractions(button);
            }
        });

        // إصلاح أزرار التبديل
        document.querySelectorAll('.view-toggle button').forEach(button => {
            button.classList.add('btn-sm');
            if (button.classList.contains('active')) {
                button.classList.add('btn-primary');
            } else {
                button.classList.add('btn-secondary');
            }
        });
    }

    // تحسين زر Add
    enhanceAddButton(button) {
        // إضافة أيقونة
        if (!button.querySelector('svg, .icon')) {
            const icon = document.createElement('span');
            icon.innerHTML = '➕';
            icon.style.marginLeft = '4px';
            button.insertBefore(icon, button.firstChild);
        }
        
        // إضافة وظيفة متقدمة
        button.addEventListener('click', (e) => {
            e.preventDefault();
            
            // العثور على بيانات المنتج
            const productCard = button.closest('.card, .product-item, tr');
            if (productCard) {
                this.addToQuote(productCard, button);
            }
        });
    }

    // تحسين زر Compare
    enhanceCompareButton(button) {
        // إضافة أيقونة
        if (!button.querySelector('svg, .icon')) {
            const icon = document.createElement('span');
            icon.innerHTML = '⚖️';
            icon.style.marginLeft = '4px';
            button.insertBefore(icon, button.firstChild);
        }
        
        // إضافة وظيفة المقارنة
        button.addEventListener('click', (e) => {
            e.preventDefault();
            
            const productCard = button.closest('.card, .product-item, tr');
            if (productCard) {
                this.addToComparison(productCard, button);
            }
        });
    }

    // إضافة تفاعلات الأزرار
    addButtonInteractions(button) {
        // تأثير الضغط
        button.addEventListener('mousedown', () => {
            button.style.transform = 'scale(0.98)';
        });

        button.addEventListener('mouseup', () => {
            button.style.transform = 'scale(1)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
        });

        // تأثير التحميل
        const originalClickHandler = button.onclick;
        button.addEventListener('click', async (e) => {
            if (button.classList.contains('loading')) return;
            
            // إضافة حالة التحميل
            this.setButtonLoading(button, true);
            
            try {
                if (originalClickHandler) {
                    await originalClickHandler.call(button, e);
                }
            } finally {
                setTimeout(() => {
                    this.setButtonLoading(button, false);
                }, 500);
            }
        });
    }

    // تعيين حالة التحميل للزر
    setButtonLoading(button, loading) {
        if (loading) {
            button.classList.add('loading');
            button.disabled = true;
            
            const originalText = button.textContent;
            button.dataset.originalText = originalText;
            button.innerHTML = `
                <span style="display: inline-block; width: 16px; height: 16px; border: 2px solid currentColor; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite; margin-left: 8px;"></span>
                جاري التحميل...
            `;
        } else {
            button.classList.remove('loading');
            button.disabled = false;
            button.textContent = button.dataset.originalText || button.textContent;
        }
    }

    // إضافة للعرض
    addToQuote(productElement, button) {
        try {
            const productData = this.extractProductData(productElement);
            
            // استخدام النظام المحسن إذا كان متاحاً
            if (window.fixedChat) {
                window.fixedChat.addProductToQuote(productElement, button);
                return;
            }
            
            // كود احتياطي
            let quotes = JSON.parse(localStorage.getItem('quote_products') || '[]');
            quotes.push(productData);
            localStorage.setItem('quote_products', JSON.stringify(quotes));
            
            // تحديث الزر
            button.style.background = 'var(--success)';
            button.innerHTML = '✓ تم الإضافة';
            
            // إظهار العداد
            this.updateQuoteCounter(quotes.length);
            
            // رسالة تأكيد
            this.showToast('تم إضافة المنتج لعرض السعر', 'success');
            
        } catch (error) {
            console.error('Error adding to quote:', error);
            this.showToast('حدث خطأ في إضافة المنتج', 'error');
        }
    }

    // إضافة للمقارنة
    addToComparison(productElement, button) {
        try {
            const productData = this.extractProductData(productElement);
            
            // استخدام النظام المحسن إذا كان متاحاً
            if (window.fixedChat) {
                window.fixedChat.addProductToComparison(productElement);
                return;
            }
            
            // كود احتياطي
            let comparison = JSON.parse(localStorage.getItem('comparison_products') || '[]');
            
            // التحقق من عدم وجود المنتج مسبقاً
            if (comparison.find(p => p.id === productData.id)) {
                this.showToast('المنتج موجود بالفعل في المقارنة', 'warning');
                return;
            }
            
            comparison.push(productData);
            localStorage.setItem('comparison_products', JSON.stringify(comparison));
            
            // تحديث الزر
            button.style.background = 'var(--info)';
            button.innerHTML = '✓ في المقارنة';
            
            // تحديث عداد المقارنة
            this.updateComparisonCounter(comparison.length);
            
            this.showToast('تم إضافة المنتج للمقارنة', 'success');
            
            // فتح المقارنة إذا كان هناك منتجان أو أكثر
            if (comparison.length >= 2) {
                this.showComparisonModal(comparison);
            }
            
        } catch (error) {
            console.error('Error adding to comparison:', error);
            this.showToast('حدث خطأ في إضافة المنتج للمقارنة', 'error');
        }
    }

    // استخراج بيانات المنتج
    extractProductData(element) {
        return {
            id: Math.random().toString(36).substr(2, 9),
            name: this.getTextContent(element, '.product-name, .title, h3, h4, td:nth-child(2)') || 'منتج',
            price: this.getTextContent(element, '.price, .product-price, [class*="price"]') || 'غير محدد',
            pn: this.getTextContent(element, '.pn, [class*="pn"], td:nth-child(3)') || 'غير محدد',
            brand: this.getTextContent(element, '.brand, .manufacturer, td:nth-child(4)') || 'غير محدد',
            image: element.querySelector('img')?.src || '/placeholder.png',
            description: this.getTextContent(element, '.description, .desc') || ''
        };
    }

    // الحصول على النص من عنصر
    getTextContent(parent, selector) {
        const element = parent.querySelector(selector);
        return element ? element.textContent.trim() : '';
    }

    // تحسين التخطيط
    improveLayout() {
        // تحسين الحاوية الرئيسية
        const container = document.querySelector('.container');
        if (container && !container.classList.contains('improved')) {
            container.classList.add('improved', 'fade-in');
        }

        // تحسين التخطيط الشبكي
        const layout = document.querySelector('.layout');
        if (layout && !layout.classList.contains('improved')) {
            layout.style.cssText = `
                display: grid;
                grid-template-columns: 280px 1fr;
                gap: var(--space-6);
                align-items: start;
            `;
            layout.classList.add('improved');
        }

        // تحسين الشريط الجانبي
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && !sidebar.classList.contains('improved')) {
            sidebar.style.cssText += `
                position: sticky;
                top: 100px;
                max-height: calc(100vh - 120px);
                overflow-y: auto;
                background: white;
                box-shadow: var(--shadow-sm);
                border-radius: var(--radius-xl);
                padding: var(--space-6);
            `;
            sidebar.classList.add('improved');
        }
    }

    // إضافة التصميم الاحترافي
    addProfessionalStyling() {
        // إضافة الرسوم المتحركة للبطاقات
        document.querySelectorAll('.card, .product-item').forEach((card, index) => {
            if (!card.classList.contains('styled')) {
                card.classList.add('card', 'styled');
                card.style.animationDelay = `${index * 100}ms`;
                
                // إضافة تأثير الظل عند التمرير
                card.addEventListener('mouseenter', () => {
                    card.style.transform = 'translateY(-4px)';
                    card.style.boxShadow = 'var(--shadow-lg)';
                });
                
                card.addEventListener('mouseleave', () => {
                    card.style.transform = 'translateY(0)';
                    card.style.boxShadow = 'var(--shadow-sm)';
                });
            }
        });

        // تحسين النماذج
        document.querySelectorAll('input, select, textarea').forEach(input => {
            if (!input.classList.contains('styled')) {
                input.classList.add('styled');
                
                // إضافة تأثير التركيز
                input.addEventListener('focus', () => {
                    input.style.borderColor = 'var(--primary-500)';
                    input.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                });
                
                input.addEventListener('blur', () => {
                    input.style.borderColor = 'var(--gray-300)';
                    input.style.boxShadow = 'none';
                });
            }
        });
    }

    // إصلاح المقارنة
    fixComparison() {
        // إصلاح زر فتح المقارنة
        const compareButton = document.querySelector('#compare-button, .compare-button');
        if (compareButton) {
            compareButton.addEventListener('click', (e) => {
                e.preventDefault();
                const comparison = JSON.parse(localStorage.getItem('comparison_products') || '[]');
                if (comparison.length >= 2) {
                    this.showComparisonModal(comparison);
                } else {
                    this.showToast('يجب إضافة منتجين على الأقل للمقارنة', 'warning');
                }
            });
        }
    }

    // عرض نافذة المقارنة
    showComparisonModal(products) {
        if (window.enhancedUI && window.enhancedUI.showComparisonModal) {
            window.enhancedUI.showComparisonModal(products);
        } else {
            this.createBasicComparisonModal(products);
        }
    }

    // إنشاء نافذة مقارنة أساسية
    createBasicComparisonModal(products) {
        // إزالة أي مودال موجود
        document.getElementById('comparison-modal')?.remove();

        const modal = document.createElement('div');
        modal.id = 'comparison-modal';
        modal.className = 'modal show';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 90vw;">
                <div class="modal-header">
                    <h2 class="modal-title">مقارنة المنتجات (${products.length})</h2>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: var(--gray-50);">
                                    <th style="padding: var(--space-3); text-align: right; min-width: 100px;">الخاصية</th>
                                    ${products.map(p => `
                                        <th style="padding: var(--space-3); text-align: center; min-width: 200px; border-left: 1px solid var(--gray-200);">
                                            <img src="${p.image}" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: var(--space-2);" onerror="this.src='/placeholder.png'">
                                            <div style="font-weight: 600; font-size: var(--text-sm);">${p.name}</div>
                                        </th>
                                    `).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style="padding: var(--space-3); font-weight: 600; background: var(--gray-50);">رقم القطعة</td>
                                    ${products.map(p => `<td style="padding: var(--space-3); text-align: center; border-left: 1px solid var(--gray-200);">${p.pn || '-'}</td>`).join('')}
                                </tr>
                                <tr>
                                    <td style="padding: var(--space-3); font-weight: 600; background: var(--gray-50);">الشركة المصنعة</td>
                                    ${products.map(p => `<td style="padding: var(--space-3); text-align: center; border-left: 1px solid var(--gray-200);">${p.brand || '-'}</td>`).join('')}
                                </tr>
                                <tr>
                                    <td style="padding: var(--space-3); font-weight: 600; background: var(--gray-50);">السعر</td>
                                    ${products.map(p => `<td style="padding: var(--space-3); text-align: center; border-left: 1px solid var(--gray-200); color: var(--primary-600); font-weight: 600;">${p.price || '-'}</td>`).join('')}
                                </tr>
                                <tr>
                                    <td style="padding: var(--space-3); font-weight: 600; background: var(--gray-50);">الإجراءات</td>
                                    ${products.map((p, index) => `
                                        <td style="padding: var(--space-3); text-align: center; border-left: 1px solid var(--gray-200);">
                                            <button class="btn btn-primary btn-sm" onclick="this.closest('.modal').remove(); window.interfaceFixes.addToQuoteById('${p.id}')" style="margin-bottom: var(--space-2);">إضافة للعرض</button>
                                            <br>
                                            <button class="btn btn-secondary btn-sm" onclick="window.interfaceFixes.removeFromComparison(${index}); this.closest('.modal').remove(); window.interfaceFixes.showComparisonModal(JSON.parse(localStorage.getItem('comparison_products') || '[]'));">إزالة</button>
                                        </td>
                                    `).join('')}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div style="margin-top: var(--space-4); text-align: center; padding-top: var(--space-4); border-top: 1px solid var(--gray-200);">
                        <button class="btn btn-secondary" onclick="localStorage.removeItem('comparison_products'); this.closest('.modal').remove(); window.interfaceFixes.updateComparisonCounter(0);">مسح جميع المقارنات</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // إغلاق عند النقر خارج المودال
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    // إزالة من المقارنة
    removeFromComparison(index) {
        let comparison = JSON.parse(localStorage.getItem('comparison_products') || '[]');
        comparison.splice(index, 1);
        localStorage.setItem('comparison_products', JSON.stringify(comparison));
        this.updateComparisonCounter(comparison.length);
        this.showToast('تم إزالة المنتج من المقارنة', 'success');
    }

    // إضافة عدادات المنتجات
    addProductCounters() {
        // عداد عرض السعر
        const quoteCount = JSON.parse(localStorage.getItem('quote_products') || '[]').length;
        if (quoteCount > 0) {
            this.updateQuoteCounter(quoteCount);
        }
        
        // عداد المقارنة
        const comparisonCount = JSON.parse(localStorage.getItem('comparison_products') || '[]').length;
        if (comparisonCount > 0) {
            this.updateComparisonCounter(comparisonCount);
        }
    }

    // تحديث عداد عرض السعر
    updateQuoteCounter(count) {
        let counter = document.getElementById('quote-counter');
        
        if (count > 0) {
            if (!counter) {
                counter = document.createElement('div');
                counter.id = 'quote-counter';
                counter.style.cssText = `
                    position: fixed;
                    top: 100px;
                    right: var(--space-4);
                    background: var(--primary-600);
                    color: white;
                    padding: var(--space-3) var(--space-4);
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-lg);
                    z-index: var(--z-fixed);
                    cursor: pointer;
                    transition: var(--transition-base);
                    min-width: 80px;
                    text-align: center;
                `;
                
                counter.addEventListener('click', () => this.showQuoteModal());
                counter.addEventListener('mouseenter', () => {
                    counter.style.transform = 'scale(1.05)';
                });
                counter.addEventListener('mouseleave', () => {
                    counter.style.transform = 'scale(1)';
                });
                
                document.body.appendChild(counter);
            }
            
            counter.innerHTML = `
                <div style="font-size: var(--text-lg); font-weight: 600;">${count}</div>
                <div style="font-size: var(--text-xs); opacity: 0.9;">عرض السعر</div>
            `;
        } else if (counter) {
            counter.remove();
        }
    }

    // تحديث عداد المقارنة
    updateComparisonCounter(count) {
        let counter = document.getElementById('comparison-counter');
        
        if (count > 0) {
            if (!counter) {
                counter = document.createElement('div');
                counter.id = 'comparison-counter';
                counter.style.cssText = `
                    position: fixed;
                    top: 180px;
                    right: var(--space-4);
                    background: var(--info);
                    color: white;
                    padding: var(--space-3) var(--space-4);
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-lg);
                    z-index: var(--z-fixed);
                    cursor: pointer;
                    transition: var(--transition-base);
                    min-width: 80px;
                    text-align: center;
                `;
                
                counter.addEventListener('click', () => {
                    const comparison = JSON.parse(localStorage.getItem('comparison_products') || '[]');
                    if (comparison.length >= 2) {
                        this.showComparisonModal(comparison);
                    }
                });
                
                counter.addEventListener('mouseenter', () => {
                    counter.style.transform = 'scale(1.05)';
                });
                counter.addEventListener('mouseleave', () => {
                    counter.style.transform = 'scale(1)';
                });
                
                document.body.appendChild(counter);
            }
            
            counter.innerHTML = `
                <div style="font-size: var(--text-lg); font-weight: 600;">${count}</div>
                <div style="font-size: var(--text-xs); opacity: 0.9;">مقارنة</div>
            `;
        } else if (counter) {
            counter.remove();
        }
    }

    // عرض نافذة عرض السعر
    showQuoteModal() {
        const products = JSON.parse(localStorage.getItem('quote_products') || '[]');
        
        if (products.length === 0) {
            this.showToast('لا توجد منتجات في عرض السعر', 'warning');
            return;
        }
        
        // استخدام النظام المحسن إذا كان متاحاً
        if (window.fixedChat && window.fixedChat.showQuoteModal) {
            window.fixedChat.showQuoteModal();
        } else {
            // كود احتياطي لعرض قائمة المنتجات
            this.showToast(`لديك ${products.length} منتج في عرض السعر. سيتم فتح النافذة قريباً.`, 'info');
        }
    }

    // تحسين التسلسل الهرمي البصري
    enhanceVisualHierarchy() {
        // تحسين العناوين
        document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
            if (!heading.classList.contains('styled')) {
                heading.style.cssText += `
                    font-family: var(--font-display);
                    font-weight: 600;
                    color: var(--gray-900);
                    margin-bottom: var(--space-3);
                `;
                heading.classList.add('styled');
            }
        });
        
        // تحسين النصوص
        document.querySelectorAll('p, li').forEach(text => {
            if (!text.classList.contains('styled')) {
                text.style.cssText += `
                    line-height: 1.6;
                    color: var(--gray-700);
                `;
                text.classList.add('styled');
            }
        });
        
        // تحسين الروابط
        document.querySelectorAll('a').forEach(link => {
            if (!link.classList.contains('styled')) {
                link.style.cssText += `
                    color: var(--primary-600);
                    text-decoration: none;
                    transition: var(--transition-fast);
                `;
                link.addEventListener('mouseenter', () => {
                    link.style.color = 'var(--primary-700)';
                    link.style.textDecoration = 'underline';
                });
                link.addEventListener('mouseleave', () => {
                    link.style.color = 'var(--primary-600)';
                    link.style.textDecoration = 'none';
                });
                link.classList.add('styled');
            }
        });
    }

    // إصلاح معالج طلب عرض السعر
    fixQuoteWizard() {
        // البحث عن جميع الأزرار المرتبطة بطلب عرض السعر
        document.querySelectorAll('button, a').forEach(element => {
            const text = element.textContent.toLowerCase();
            const onclick = element.getAttribute('onclick');
            
            if (
                text.includes('طلب عرض سعر') || 
                text.includes('عرض سعر') ||
                text.includes('التالي') ||
                onclick?.includes('openQuoteModal')
            ) {
                element.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.openQuoteWizard();
                });
            }
        });
    }

    // فتح معالج طلب عرض السعر
    openQuoteWizard() {
        // محاولة استخدام النظام الموجود
        if (window.openQuoteModal && typeof window.openQuoteModal === 'function') {
            try {
                window.openQuoteModal();
                return;
            } catch (error) {
                console.warn('Quote modal function failed:', error);
            }
        }
        
        // إنشاء نافذة احتياطية
        this.createQuoteWizard();
    }

    // إنشاء معالج عرض السعر الاحتياطي
    createQuoteWizard() {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">طلب عرض سعر</h2>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="quote-form" onsubmit="window.interfaceFixes.submitQuoteForm(event)">
                        <div style="margin-bottom: var(--space-4);">
                            <label style="display: block; margin-bottom: var(--space-2); font-weight: 500;">الاسم *</label>
                            <input type="text" name="name" required style="width: 100%; padding: var(--space-3); border: 1px solid var(--gray-300); border-radius: var(--radius);">
                        </div>
                        
                        <div style="margin-bottom: var(--space-4);">
                            <label style="display: block; margin-bottom: var(--space-2); font-weight: 500;">البريد الإلكتروني *</label>
                            <input type="email" name="email" required style="width: 100%; padding: var(--space-3); border: 1px solid var(--gray-300); border-radius: var(--radius);">
                        </div>
                        
                        <div style="margin-bottom: var(--space-4);">
                            <label style="display: block; margin-bottom: var(--space-2); font-weight: 500;">رقم الهاتف</label>
                            <input type="tel" name="phone" style="width: 100%; padding: var(--space-3); border: 1px solid var(--gray-300); border-radius: var(--radius);">
                        </div>
                        
                        <div style="margin-bottom: var(--space-4);">
                            <label style="display: block; margin-bottom: var(--space-2); font-weight: 500;">اسم الشركة</label>
                            <input type="text" name="company" style="width: 100%; padding: var(--space-3); border: 1px solid var(--gray-300); border-radius: var(--radius);">
                        </div>
                        
                        <div style="margin-bottom: var(--space-4);">
                            <label style="display: block; margin-bottom: var(--space-2); font-weight: 500;">تفاصيل إضافية</label>
                            <textarea name="details" rows="4" style="width: 100%; padding: var(--space-3); border: 1px solid var(--gray-300); border-radius: var(--radius); resize: vertical;" placeholder="أدخل أي تفاصيل إضافية أو متطلبات خاصة..."></textarea>
                        </div>
                        
                        <div style="text-align: left;">
                            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()" style="margin-left: var(--space-2);">إلغاء</button>
                            <button type="submit" class="btn btn-primary">إرسال طلب العرض</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // التركيز على الحقل الأول
        setTimeout(() => {
            const firstInput = modal.querySelector('input');
            if (firstInput) firstInput.focus();
        }, 100);
    }

    // إرسال نموذج طلب عرض السعر
    submitQuoteForm(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData.entries());
        
        // إضافة المنتجات المطلوبة
        data.products = JSON.parse(localStorage.getItem('quote_products') || '[]');
        
        console.log('Quote request data:', data);
        
        // محاكاة الإرسال
        this.setButtonLoading(event.target.querySelector('button[type="submit"]'), true);
        
        setTimeout(() => {
            // إغلاق المودال
            event.target.closest('.modal').remove();
            
            // رسالة نجاح
            this.showToast('تم إرسال طلب عرض السعر بنجاح! سنتواصل معك قريباً.', 'success');
            
            // مسح المنتجات من عرض السعر
            localStorage.removeItem('quote_products');
            this.updateQuoteCounter(0);
            
        }, 2000);
    }

    // عرض Toast
    showToast(message, type = 'info') {
        // استخدام النظام الموجود إن أمكن
        if (window.QiqToast && window.QiqToast[type]) {
            window.QiqToast[type](message);
            return;
        }
        
        // إنشاء toast بسيط
        const toast = document.createElement('div');
        toast.className = `toast show toast-${type}`;
        toast.style.cssText += `
            position: fixed;
            top: var(--space-4);
            right: var(--space-4);
            background: white;
            border: 1px solid var(--gray-200);
            border-radius: var(--radius-lg);
            padding: var(--space-4);
            box-shadow: var(--shadow-lg);
            z-index: var(--z-tooltip);
            max-width: 400px;
            transform: translateX(0);
            animation: slideInRight 0.3s ease;
        `;
        
        const colors = {
            success: 'var(--success)',
            error: 'var(--error)',
            warning: 'var(--warning)',
            info: 'var(--info)'
        };
        
        toast.style.borderLeftColor = colors[type] || colors.info;
        toast.style.borderLeftWidth = '4px';
        
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: var(--space-2);">
                <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
                <span>${message}</span>
                <button onclick="this.closest('.toast').remove()" style="background: none; border: none; margin-left: auto; color: var(--gray-400); cursor: pointer;">&times;</button>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // إزالة تلقائية
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }
        }, 5000);
    }

    // إضافة الرسوم المتحركة المطلوبة
    addAnimations() {
        if (document.getElementById('interface-animations')) return;
        
        const style = document.createElement('style');
        style.id = 'interface-animations';
        style.innerHTML = `
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        
        document.head.appendChild(style);
    }
}

// تهيئة النظام
document.addEventListener('DOMContentLoaded', function() {
    window.interfaceFixes = new InterfaceFixes();
    window.interfaceFixes.addAnimations();
});