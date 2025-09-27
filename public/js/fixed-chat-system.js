/**
 * Fixed Chat System with Smart BOQ Integration
 * نظام الدردشة المحسن مع تكامل BOQ الذكي
 */

class FixedChatSystem {
    constructor() {
        // Respect global flag to disable this layer when primary chat exists
        if (typeof window !== 'undefined') {
            if (window.QIQ_DISABLE_FIXED_CHAT === true) {
                console.log('ℹ️ FixedChatSystem disabled by flag.');
                this.isActive = false;
                return;
            }
            // If the primary chat form exists on page, avoid auto init to prevent double-binding
            if (document.getElementById('qiq-form')) {
                console.log('ℹ️ Primary chat UI detected (#qiq-form). Skipping FixedChatSystem init.');
                this.isActive = false;
                return;
            }
            if (window.__FIXED_CHAT_INITIALIZED) {
                console.log('ℹ️ FixedChatSystem already initialized.');
                this.isActive = false;
                return;
            }
            window.__FIXED_CHAT_INITIALIZED = true;
        }
        this.isActive = false;
        this.messages = [];
        this.currentContext = null;
        this.suggestions = [];
        this.products = [];
        this.isTyping = false;
        this.init();
    }

    // تهيئة النظام
    init() {
        this.setupChatInterface();
        this.loadChatData();
        this.bindEvents();
        this.startSmartRecommendations();
        console.log('💬 Fixed Chat System initialized');
    }

    // إعداد واجهة الدردشة
    setupChatInterface() {
        // إنشاء واجهة الدردشة إذا لم تكن موجودة
        if (!document.getElementById('chat-container')) {
            this.createChatInterface();
        }
        
        // إصلاح الأزرار الموجودة
        this.fixExistingButtons();
    }

    // إنشاء واجهة دردشة جديدة
    createChatInterface() {
        const chatContainer = document.createElement('div');
        chatContainer.id = 'chat-container';
        chatContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            width: 350px;
            height: 500px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            z-index: 1000;
            display: none;
            flex-direction: column;
            overflow: hidden;
            border: 1px solid #e5e7eb;
        `;
        
        chatContainer.innerHTML = `
            <div class="chat-header" style="background: #1e3a8a; color: white; padding: 16px; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 16px;">🤖 مساعد QuickITQuote</h3>
                <button id="close-chat" style="background: none; border: none; color: white; font-size: 18px; cursor: pointer;">&times;</button>
            </div>
            
            <div class="chat-messages" id="chat-messages" style="flex: 1; overflow-y: auto; padding: 16px; background: #f8fafc;">
                <div class="welcome-message" style="background: white; border-radius: 8px; padding: 12px; margin-bottom: 12px; border-left: 4px solid #1e3a8a;">
                    مرحباً! أنا مساعدك الذكي. يمكنني مساعدتك في:
                    <ul style="margin: 8px 0 0 20px; padding: 0;">
                        <li>اقتراح المنتجات المناسبة</li>
                        <li>إنشاء عروض أسعار ذكية</li>
                        <li>المقارنة بين المنتجات</li>
                        <li>الإجابة على استفساراتك</li>
                    </ul>
                </div>
            </div>
            
            <div class="chat-suggestions" id="chat-suggestions" style="padding: 12px; background: white; border-top: 1px solid #e5e7eb; max-height: 120px; overflow-y: auto;"></div>
            
            <div class="chat-input" style="padding: 16px; background: white; border-top: 1px solid #e5e7eb;">
                <div style="display: flex; gap: 8px;">
                    <input type="text" id="chat-input" placeholder="اكتب رسالتك هنا..." style="flex: 1; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px; outline: none;">
                    <button id="send-chat" style="background: #1e3a8a; color: white; border: none; padding: 10px 16px; border-radius: 8px; cursor: pointer;">إرسال</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(chatContainer);
        
        // إنشاء زر فتح الدردشة
        const chatToggle = document.createElement('button');
        chatToggle.id = 'chat-toggle';
        chatToggle.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            width: 60px;
            height: 60px;
            background: #1e3a8a;
            color: white;
            border: none;
            border-radius: 50%;
            cursor: pointer;
            z-index: 999;
            font-size: 24px;
            box-shadow: 0 4px 12px rgba(30, 58, 138, 0.3);
            transition: all 0.3s ease;
        `;
        chatToggle.innerHTML = '💬';
        chatToggle.title = 'فتح المساعد الذكي';
        
        document.body.appendChild(chatToggle);
    }

    // إصلاح الأزرار الموجودة
    fixExistingButtons() {
        // إصلاح أزرار Add
        document.querySelectorAll('button').forEach(button => {
            if (button.textContent.includes('Add') || button.textContent.includes('إضافة')) {
                this.enhanceAddButton(button);
            }
        });
        
        // إصلاح أزرار المقارنة
        document.querySelectorAll('[onclick*="compare"], [data-action="compare"]').forEach(button => {
            this.enhanceCompareButton(button);
        });
    }

    // تحسين زر Add
    enhanceAddButton(button) {
        // إضافة عداد المنتجات
        if (!button.querySelector('.product-counter')) {
            const counter = document.createElement('span');
            counter.className = 'product-counter';
            counter.style.cssText = `
                background: #dc2626;
                color: white;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                font-size: 11px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                margin-left: 8px;
                min-width: 20px;
            `;
            counter.textContent = '0';
            button.appendChild(counter);
        }
        
        // تحسين وظيفة الزر
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const productElement = button.closest('.product-item, .card, tr');
            if (productElement) {
                this.addProductToQuote(productElement, button);
            }
        });
    }

    // تحسين زر المقارنة
    enhanceCompareButton(button) {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const productElement = button.closest('.product-item, .card, tr');
            if (productElement) {
                this.addProductToComparison(productElement);
            }
        });
    }

    // إضافة منتج لعرض السعر
    addProductToQuote(productElement, button) {
        try {
            // استخراج بيانات المنتج
            const product = this.extractProductData(productElement);
            
            if (product) {
                // إضافة للقائمة
                this.products.push(product);
                
                // تحديث العداد
                const counter = button.querySelector('.product-counter');
                if (counter) {
                    counter.textContent = this.products.length;
                    counter.style.display = 'inline-flex';
                }
                
                // تحديث الزر
                button.style.background = '#059669';
                button.innerHTML = `✓ تم الإضافة ${counter ? counter.outerHTML : ''}`;
                
                // إظهار toast
                this.showToast('تم إضافة المنتج لعرض السعر', 'success');
                
                // إرسال للدردشة
                this.sendChatMessage(`تم إضافة منتج: ${product.name}`, 'system');
                
                // اقتراح منتجات مشابهة
                this.suggestSimilarProducts(product);
                
                // تحديث واجهة المستخدم
                this.updateQuoteInterface();
                
            } else {
                throw new Error('لا يمكن استخراج بيانات المنتج');
            }
            
        } catch (error) {
            console.error('Error adding product:', error);
            this.showToast('حدث خطأ في إضافة المنتج', 'error');
        }
    }

    // إضافة منتج للمقارنة
    addProductToComparison(productElement) {
        try {
            const product = this.extractProductData(productElement);
            
            if (product) {
                // التحقق من وجود المنتج في المقارنة
                const existingComparison = this.getComparisonProducts();
                
                if (existingComparison.find(p => p.id === product.id)) {
                    this.showToast('المنتج موجود بالفعل في المقارنة', 'warning');
                    return;
                }
                
                // إضافة للمقارنة
                this.addToComparison(product);
                
                // إظهار toast
                this.showToast('تم إضافة المنتج للمقارنة', 'success');
                
                // فتح نافذة المقارنة إذا كان هناك منتجان أو أكثر
                if (this.getComparisonProducts().length >= 2) {
                    this.showComparisonModal();
                }
                
            } else {
                throw new Error('لا يمكن استخراج بيانات المنتج');
            }
            
        } catch (error) {
            console.error('Error adding to comparison:', error);
            this.showToast('حدث خطأ في إضافة المنتج للمقارنة', 'error');
        }
    }

    // استخراج بيانات المنتج
    extractProductData(element) {
        try {
            const product = {
                id: Math.random().toString(36).substr(2, 9),
                name: '',
                price: '',
                pn: '',
                brand: '',
                image: '',
                description: ''
            };
            
            // استخراج الاسم
            const nameElement = element.querySelector('.product-name, .title, h3, h4, td:nth-child(2)');
            if (nameElement) {
                product.name = nameElement.textContent.trim();
            }
            
            // استخراج السعر
            const priceElement = element.querySelector('.price, .product-price, [class*="price"]');
            if (priceElement) {
                product.price = priceElement.textContent.trim();
            }
            
            // استخراج PN
            const pnElement = element.querySelector('.pn, [class*="pn"], td:nth-child(3)');
            if (pnElement) {
                product.pn = pnElement.textContent.trim();
            }
            
            // استخراج البراند
            const brandElement = element.querySelector('.brand, .manufacturer, td:nth-child(4)');
            if (brandElement) {
                product.brand = brandElement.textContent.trim();
            }
            
            // استخراج الصورة
            const imageElement = element.querySelector('img');
            if (imageElement) {
                product.image = imageElement.src || imageElement.dataset.src;
            }
            
            // استخراج الوصف
            const descElement = element.querySelector('.description, .desc');
            if (descElement) {
                product.description = descElement.textContent.trim();
            }
            
            // التحقق من وجود بيانات أساسية
            if (!product.name && !product.pn) {
                throw new Error('لا يمكن العثور على اسم المنتج أو PN');
            }
            
            return product;
            
        } catch (error) {
            console.error('Error extracting product data:', error);
            return null;
        }
    }

    // تحديث واجهة عرض السعر
    updateQuoteInterface() {
        // البحث عن عداد المنتجات في الواجهة
        let quoteCounter = document.querySelector('#quote-counter');
        
        if (!quoteCounter) {
            // إنشاء عداد جديد
            quoteCounter = document.createElement('div');
            quoteCounter.id = 'quote-counter';
            quoteCounter.style.cssText = `
                position: fixed;
                top: 100px;
                right: 20px;
                background: #1e3a8a;
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                z-index: 1000;
                cursor: pointer;
                transition: all 0.3s ease;
            `;
            
            document.body.appendChild(quoteCounter);
            
            // إضافة حدث النقر
            quoteCounter.addEventListener('click', () => {
                this.showQuoteModal();
            });
        }
        
        // تحديث المحتوى
        quoteCounter.innerHTML = `
            <div style="text-align: center;">
                <div style="font-size: 18px; font-weight: bold;">${this.products.length}</div>
                <div style="font-size: 12px; opacity: 0.9;">منتج في العرض</div>
            </div>
        `;
        
        // إضافة تأثير النبض إذا كان هناك منتجات
        if (this.products.length > 0) {
            quoteCounter.style.animation = 'pulse 2s infinite';
        }
    }

    // عرض نافذة عرض السعر
    showQuoteModal() {
        // إنشاء المودال
        const modal = document.createElement('div');
        modal.id = 'quote-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            border-radius: 12px;
            max-width: 800px;
            width: 100%;
            max-height: 80vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        `;
        
        // رأس المودال
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 20px;
            background: #1e3a8a;
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        header.innerHTML = `
            <h2 style="margin: 0;">عرض السعر (${this.products.length} منتج)</h2>
            <button onclick="this.closest('#quote-modal').remove()" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer;">&times;</button>
        `;
        
        // محتوى المودال
        const body = document.createElement('div');
        body.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 20px;
        `;
        
        // إنشاء جدول المنتجات
        const table = document.createElement('table');
        table.style.cssText = `
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        `;
        
        let tableHTML = `
            <thead>
                <tr style="background: #f8fafc;">
                    <th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">المنتج</th>
                    <th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">PN</th>
                    <th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">البراند</th>
                    <th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">السعر</th>
                    <th style="padding: 12px; text-align: center; border: 1px solid #e5e7eb;">إجراء</th>
                </tr>
            </thead>
            <tbody>
        `;
        
        this.products.forEach((product, index) => {
            tableHTML += `
                <tr>
                    <td style="padding: 12px; border: 1px solid #e5e7eb;">${product.name}</td>
                    <td style="padding: 12px; border: 1px solid #e5e7eb;">${product.pn}</td>
                    <td style="padding: 12px; border: 1px solid #e5e7eb;">${product.brand}</td>
                    <td style="padding: 12px; border: 1px solid #e5e7eb;">${product.price}</td>
                    <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">
                        <button onclick="window.fixedChat.removeProductFromQuote(${index})" style="background: #dc2626; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">حذف</button>
                    </td>
                </tr>
            `;
        });
        
        tableHTML += '</tbody>';
        table.innerHTML = tableHTML;
        
        // أزرار الإجراءات
        const actions = document.createElement('div');
        actions.style.cssText = `
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
        `;
        actions.innerHTML = `
            <button onclick="window.fixedChat.clearQuote(); this.closest('#quote-modal').remove();" style="background: #6b7280; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">مسح الكل</button>
            <button onclick="window.fixedChat.sendQuoteRequest(); this.closest('#quote-modal').remove();" style="background: #059669; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">إرسال طلب عرض السعر</button>
        `;
        
        body.appendChild(table);
        body.appendChild(actions);
        
        modalContent.appendChild(header);
        modalContent.appendChild(body);
        modal.appendChild(modalContent);
        
        document.body.appendChild(modal);
        
        // إغلاق عند النقر خارج المودال
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    // حذف منتج من عرض السعر
    removeProductFromQuote(index) {
        this.products.splice(index, 1);
        this.updateQuoteInterface();
        this.showToast('تم حذف المنتج من عرض السعر', 'success');
        
        // إعادة فتح المودال بالبيانات المحدثة
        document.getElementById('quote-modal')?.remove();
        if (this.products.length > 0) {
            this.showQuoteModal();
        }
    }

    // مسح عرض السعر
    clearQuote() {
        this.products = [];
        this.updateQuoteInterface();
        document.getElementById('quote-counter')?.remove();
        this.showToast('تم مسح عرض السعر', 'success');
    }

    // إرسال طلب عرض السعر
    sendQuoteRequest() {
        if (this.products.length === 0) {
            this.showToast('لا توجد منتجات في عرض السعر', 'warning');
            return;
        }
        
        // هنا يمكن إضافة الكود لإرسال الطلب للخادم
        console.log('Sending quote request:', this.products);
        
        // عرض نموذج إرسال الطلب
        this.showQuoteRequestForm();
    }

    // عرض نموذج طلب عرض السعر
    showQuoteRequestForm() {
        // فتح نافذة الطلب الموجودة أو إنشاء واحدة جديدة
        if (window.openQuoteModal) {
            window.openQuoteModal();
        } else {
            // كود احتياطي لإنشاء النموذج
            window.open('/quote.html', '_blank');
        }
        
        this.showToast('سيتم فتح نموذج طلب عرض السعر', 'info');
    }

    // الحصول على منتجات المقارنة
    getComparisonProducts() {
        return JSON.parse(localStorage.getItem('comparison_products') || '[]');
    }

    // إضافة للمقارنة
    addToComparison(product) {
        const comparisonProducts = this.getComparisonProducts();
        comparisonProducts.push(product);
        localStorage.setItem('comparison_products', JSON.stringify(comparisonProducts));
        
        // تحديث عداد المقارنة
        this.updateComparisonCounter(comparisonProducts.length);
    }

    // تحديث عداد المقارنة
    updateComparisonCounter(count) {
        let counter = document.querySelector('#comparison-counter');
        
        if (!counter && count > 0) {
            counter = document.createElement('div');
            counter.id = 'comparison-counter';
            counter.style.cssText = `
                position: fixed;
                top: 180px;
                right: 20px;
                background: #0ea5e9;
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                z-index: 1000;
                cursor: pointer;
                transition: all 0.3s ease;
            `;
            
            document.body.appendChild(counter);
            
            counter.addEventListener('click', () => {
                this.showComparisonModal();
            });
        }
        
        if (counter) {
            if (count > 0) {
                counter.innerHTML = `
                    <div style="text-align: center;">
                        <div style="font-size: 18px; font-weight: bold;">${count}</div>
                        <div style="font-size: 12px; opacity: 0.9;">للمقارنة</div>
                    </div>
                `;
                counter.style.display = 'block';
            } else {
                counter.remove();
            }
        }
    }

    // عرض نافذة المقارنة
    showComparisonModal() {
        const products = this.getComparisonProducts();
        
        if (products.length < 2) {
            this.showToast('يحب إضافة منتجين على الأقل للمقارنة', 'warning');
            return;
        }
        
        // استخدام المودال المحسن إذا كان متاحاً
        if (window.enhancedUI && window.enhancedUI.showComparisonModal) {
            window.enhancedUI.showComparisonModal(products);
        } else {
            // إنشاء مودال مقارنة بسيط
            this.createSimpleComparisonModal(products);
        }
    }

    // إنشاء مودال مقارنة بسيط
    createSimpleComparisonModal(products) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            border-radius: 12px;
            max-width: 90vw;
            max-height: 80vh;
            overflow: auto;
            padding: 20px;
        `;
        
        content.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>مقارنة المنتجات</h2>
                <button onclick="this.closest('div[style*=\"position: fixed\"]').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            ${products.map(p => `<th style="padding: 12px; border: 1px solid #e5e7eb; min-width: 200px;">${p.name}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td colspan="${products.length}" style="padding: 12px; font-weight: bold; background: #f3f4f6;">الصورة</td>
                        </tr>
                        <tr>
                            ${products.map(p => `<td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;"><img src="${p.image || '/placeholder.png'}" style="width: 100px; height: 100px; object-fit: contain;"></td>`).join('')}
                        </tr>
                        <tr>
                            <td colspan="${products.length}" style="padding: 12px; font-weight: bold; background: #f3f4f6;">PN</td>
                        </tr>
                        <tr>
                            ${products.map(p => `<td style="padding: 12px; border: 1px solid #e5e7eb;">${p.pn || '-'}</td>`).join('')}
                        </tr>
                        <tr>
                            <td colspan="${products.length}" style="padding: 12px; font-weight: bold; background: #f3f4f6;">البراند</td>
                        </tr>
                        <tr>
                            ${products.map(p => `<td style="padding: 12px; border: 1px solid #e5e7eb;">${p.brand || '-'}</td>`).join('')}
                        </tr>
                        <tr>
                            <td colspan="${products.length}" style="padding: 12px; font-weight: bold; background: #f3f4f6;">السعر</td>
                        </tr>
                        <tr>
                            ${products.map(p => `<td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold; color: #1e3a8a;">${p.price || '-'}</td>`).join('')}
                        </tr>
                    </tbody>
                </table>
            </div>
            <div style="margin-top: 20px; text-align: center;">
                <button onclick="localStorage.removeItem('comparison_products'); window.fixedChat.updateComparisonCounter(0); this.closest('div[style*=\"position: fixed\"]').remove();" style="background: #dc2626; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">مسح المقارنة</button>
            </div>
        `;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    // عرض Toast
    showToast(message, type = 'info') {
        // استخدام نظام Toast الموجود إن أمكن
        if (window.QiqToast) {
            window.QiqToast[type]?.(message);
            return;
        }
        
        // إنشاء toast بسيط
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#059669' : type === 'error' ? '#dc2626' : type === 'warning' ? '#d97706' : '#1e3a8a'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            max-width: 300px;
            animation: slideInRight 0.3s ease;
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ربط الأحداث
    bindEvents() {
        // ربط أحداث الدردشة
        document.addEventListener('click', (e) => {
            if (e.target.id === 'chat-toggle') {
                this.toggleChat();
            } else if (e.target.id === 'close-chat') {
                this.closeChat();
            } else if (e.target.id === 'send-chat') {
                this.sendMessage();
            }
        });
        
        // ربط Enter key في حقل الدردشة
        document.addEventListener('keypress', (e) => {
            if (e.target.id === 'chat-input' && e.key === 'Enter') {
                this.sendMessage();
            }
        });
    }

    // تبديل حالة الدردشة
    toggleChat() {
        const chatContainer = document.getElementById('chat-container');
        const chatToggle = document.getElementById('chat-toggle');
        
        if (chatContainer && chatToggle) {
            if (chatContainer.style.display === 'none') {
                chatContainer.style.display = 'flex';
                chatToggle.style.display = 'none';
                this.loadInitialSuggestions();
            } else {
                chatContainer.style.display = 'none';
                chatToggle.style.display = 'block';
            }
        }
    }

    // إغلاق الدردشة
    closeChat() {
        const chatContainer = document.getElementById('chat-container');
        const chatToggle = document.getElementById('chat-toggle');
        
        if (chatContainer && chatToggle) {
            chatContainer.style.display = 'none';
            chatToggle.style.display = 'block';
        }
    }

    // إرسال رسالة
    sendMessage() {
        const input = document.getElementById('chat-input');
        const message = input?.value?.trim();
        
        if (!message) return;
        
        // إضافة رسالة المستخدم
        this.addMessageToChat(message, 'user');
        
        // مسح حقل الإدخال
        input.value = '';
        
        // إظهار حالة الكتابة
        this.showTyping();
        
        // معالجة الرسالة والرد
        setTimeout(() => {
            this.processMessage(message);
        }, 1000);
    }

    // إضافة رسالة للدردشة
    addMessageToChat(message, sender = 'user') {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            margin-bottom: 12px;
            display: flex;
            ${sender === 'user' ? 'justify-content: flex-end;' : 'justify-content: flex-start;'}
        `;
        
        const messageContent = document.createElement('div');
        messageContent.style.cssText = `
            max-width: 80%;
            padding: 10px 14px;
            border-radius: 18px;
            ${sender === 'user' 
                ? 'background: #1e3a8a; color: white; border-bottom-right-radius: 6px;' 
                : 'background: white; color: #333; border: 1px solid #e5e7eb; border-bottom-left-radius: 6px;'}
            font-size: 14px;
            line-height: 1.4;
        `;
        messageContent.innerHTML = message;
        
        messageDiv.appendChild(messageContent);
        chatMessages.appendChild(messageDiv);
        
        // تمرير لأسفل
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // إظهار حالة الكتابة
    showTyping() {
        this.hideTyping(); // مسح أي حالة كتابة موجودة
        
        const typingDiv = document.createElement('div');
        typingDiv.id = 'typing-indicator';
        typingDiv.style.cssText = `
            margin-bottom: 12px;
            display: flex;
            justify-content: flex-start;
        `;
        
        typingDiv.innerHTML = `
            <div style="
                background: white; 
                color: #666; 
                padding: 10px 14px; 
                border-radius: 18px; 
                border-bottom-left-radius: 6px;
                border: 1px solid #e5e7eb;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 8px;
            ">
                <div style="display: flex; gap: 2px;">
                    <div style="width: 6px; height: 6px; background: #666; border-radius: 50%; animation: typing 1.4s infinite ease-in-out;"></div>
                    <div style="width: 6px; height: 6px; background: #666; border-radius: 50%; animation: typing 1.4s infinite ease-in-out 0.2s;"></div>
                    <div style="width: 6px; height: 6px; background: #666; border-radius: 50%; animation: typing 1.4s infinite ease-in-out 0.4s;"></div>
                </div>
                المساعد يكتب...
            </div>
        `;
        
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.appendChild(typingDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    // إخفاء حالة الكتابة
    hideTyping() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    // معالجة الرسالة
    processMessage(message) {
        this.hideTyping();
        
        // تحليل الرسالة وإنشاء رد
        let response = this.generateResponse(message);
        
        // إضافة الرد
        this.addMessageToChat(response, 'assistant');
        
        // تحديث الاقتراحات
        this.updateSuggestions(message);
    }

    // إنشاء رد
    generateResponse(message) {
        const lowerMessage = message.toLowerCase();
        
        // ردود ذكية حسب المحتوى
        if (lowerMessage.includes('سعر') || lowerMessage.includes('تكلفة')) {
            return `يمكنني مساعدتك في الحصول على أفضل الأسعار! لديك حالياً ${this.products.length} منتج في عرض السعر. هل تريد إضافة منتجات أخرى؟`;
        }
        
        if (lowerMessage.includes('مقارنة')) {
            const compProducts = this.getComparisonProducts();
            return `يمكنك مقارنة المنتجات بسهولة! لديك حالياً ${compProducts.length} منتج في المقارنة. اضغط على زر "مقارنة" بجانب أي منتج لإضافته.`;
        }
        
        if (lowerMessage.includes('لابتوب') || lowerMessage.includes('laptop')) {
            return `ممتاز! لدينا مجموعة واسعة من اللابتوبات. هل تبحث عن استخدام محدد؟ (مكتبي، ألعاب، أعمال، طلاب)`;
        }
        
        if (lowerMessage.includes('سرفر') || lowerMessage.includes('server')) {
            return `سيرفرات عالية الأداء متاحة! ما هو حجم العمل المطلوب؟ (صغير، متوسط، مؤسسي)`;
        }
        
        if (lowerMessage.includes('شكرا') || lowerMessage.includes('شكراً')) {
            return `العفو! أنا هنا دائماً لمساعدتك. هل تحتاج إلى أي شيء آخر؟`;
        }
        
        if (lowerMessage.includes('مساعدة') || lowerMessage.includes('help')) {
            return `بالطبع! يمكنني مساعدتك في:<br>
                   • البحث عن المنتجات المناسبة<br>
                   • مقارنة المنتجات<br>
                   • إنشاء عروض أسعار<br>
                   • الإجابة على استفساراتك التقنية<br>
                   ما الذي تحتاج إليه تحديداً؟`;
        }
        
        // رد افتراضي ذكي
        return `شكراً لرسالتك! ${this.getContextualResponse()}`;
    }

    // رد حسب السياق
    getContextualResponse() {
        const responses = [
            'كيف يمكنني مساعدتك اليوم؟',
            'هل تبحث عن منتج معين؟',
            'يمكنني اقتراح أفضل المنتجات لاحتياجاتك.',
            'لا تتردد في سؤالي عن أي شيء!',
            'هل تريد رؤية التوصيات الذكية؟'
        ];
        
        return responses[Math.floor(Math.random() * responses.length)];
    }

    // تحديث الاقتراحات
    updateSuggestions(userMessage) {
        const suggestions = document.getElementById('chat-suggestions');
        if (!suggestions) return;
        
        const newSuggestions = this.getSuggestionsBasedOnMessage(userMessage);
        
        suggestions.innerHTML = newSuggestions.map(suggestion => 
            `<button onclick="document.getElementById('chat-input').value='${suggestion}'; window.fixedChat.sendMessage();" style="
                background: #f3f4f6;
                border: 1px solid #d1d5db;
                border-radius: 20px;
                padding: 6px 12px;
                margin: 4px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s ease;
            " onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">
                ${suggestion}
            </button>`
        ).join('');
    }

    // الحصول على اقتراحات حسب الرسالة
    getSuggestionsBasedOnMessage(message) {
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('لابتوب')) {
            return ['أريد لابتوب للألعاب', 'لابتوب للأعمال', 'لابتوب للطلاب', 'ما أفضل المواصفات؟'];
        }
        
        if (lowerMessage.includes('سرفر')) {
            return ['سرفر صغير', 'سرفر مؤسسي', 'ما أفضل المواصفات؟', 'أحتاج استشارة'];
        }
        
        if (lowerMessage.includes('سعر')) {
            return ['أريد خصم', 'ما أفضل عرض؟', 'هل يوجد تخفيضات؟', 'طرق الدفع'];
        }
        
        return [
            'أريد توصية منتج',
            'ما الجديد؟',
            'أحتاج مساعدة',
            'عرض الأسعار'
        ];
    }

    // تحميل الاقتراحات الأولية
    loadInitialSuggestions() {
        const initialSuggestions = [
            'أريد لابتوب جديد',
            'أبحث عن سرفرات',
            'ما أفضل العروض؟',
            'أحتاج مساعدة في الاختيار'
        ];
        
        const suggestions = document.getElementById('chat-suggestions');
        if (suggestions) {
            suggestions.innerHTML = initialSuggestions.map(suggestion => 
                `<button onclick="document.getElementById('chat-input').value='${suggestion}'; window.fixedChat.sendMessage();" style="
                    background: #f3f4f6;
                    border: 1px solid #d1d5db;
                    border-radius: 20px;
                    padding: 6px 12px;
                    margin: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.2s ease;
                " onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">
                    ${suggestion}
                </button>`
            ).join('');
        }
    }

    // تحميل بيانات الدردشة
    loadChatData() {
        // تحميل البيانات المحفوظة
        const savedProducts = localStorage.getItem('quote_products');
        if (savedProducts) {
            this.products = JSON.parse(savedProducts);
            this.updateQuoteInterface();
        }
        
        const savedComparison = this.getComparisonProducts();
        if (savedComparison.length > 0) {
            this.updateComparisonCounter(savedComparison.length);
        }
    }

    // بدء التوصيات الذكية
    startSmartRecommendations() {
        // تشغيل التوصيات كل 30 ثانية
        setInterval(() => {
            if (this.products.length > 0) {
                this.generateSmartSuggestions();
            }
        }, 30000);
    }

    // إنشاء اقتراحات ذكية
    generateSmartSuggestions() {
        // اقتراحات حسب المنتجات الموجودة
        const categories = this.products.map(p => p.name?.toLowerCase());
        
        if (categories.some(c => c?.includes('laptop') || c?.includes('لابتوب'))) {
            this.addMessageToChat('💡 اقتراح ذكي: قد تحتاج إلى حقيبة لابتوب أو فأرة لاسلكية؟', 'assistant');
        }
        
        if (categories.some(c => c?.includes('server') || c?.includes('سرفر'))) {
            this.addMessageToChat('💡 اقتراح ذكي: هل تحتاج إلى مبدل شبكة أو كابلات إضافية؟', 'assistant');
        }
    }

    // إضافة CSS animations
    addStyles() {
        if (document.getElementById('fixed-chat-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'fixed-chat-styles';
        style.innerHTML = `
            @keyframes typing {
                0%, 60%, 100% {
                    transform: translateY(0);
                }
                30% {
                    transform: translateY(-10px);
                }
            }
            
            @keyframes pulse {
                0% {
                    transform: scale(1);
                }
                50% {
                    transform: scale(1.05);
                }
                100% {
                    transform: scale(1);
                }
            }
            
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        
        document.head.appendChild(style);
    }

    // حفظ البيانات
    saveData() {
        localStorage.setItem('quote_products', JSON.stringify(this.products));
    }
}

// تهيئة النظام
document.addEventListener('DOMContentLoaded', function() {
    try {
        // Initialize only when not disabled and when primary chat is absent
        if (window.QIQ_DISABLE_FIXED_CHAT === true) return;
        if (document.getElementById('qiq-form')) return;
        window.fixedChat = new FixedChatSystem();
        if (window.fixedChat && typeof window.fixedChat.addStyles === 'function') {
            window.fixedChat.addStyles();
        }
        // حفظ البيانات عند الإغلاق
        window.addEventListener('beforeunload', () => {
            try { window.fixedChat && window.fixedChat.saveData && window.fixedChat.saveData(); } catch {}
        });
    } catch (e) { console.warn('FixedChat init skipped:', e); }
});