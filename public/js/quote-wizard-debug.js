/**
 * Quote Wizard Debug & Fix
 * إصلاح وتنقيح معالج العروض السعر
 */

(function() {
    console.log('🔧 Quote Wizard Debug Script Loaded');
    
    // فحص وجود العناصر الأساسية
    function checkDependencies() {
        const issues = [];
        
        if (!window.QiqModal) {
            issues.push('QiqModal غير محمل');
        }
        
        if (!window.QiqToast) {
            issues.push('QiqToast غير محمل');
        }
        
        const modal = document.getElementById('qiq-modal');
        if (!modal) {
            issues.push('عنصر المودال غير موجود');
        }
        
        const wizardButton = document.querySelector('[data-open-quote-wizard]');
        if (!wizardButton) {
            issues.push('زر معالج العروض غير موجود');
        }
        
        if (issues.length > 0) {
            console.error('⚠️ Quote Wizard Issues:', issues);
            return false;
        }
        
        console.log('✅ All Quote Wizard dependencies are loaded');
        return true;
    }
    
    // تحسين معالجة النقر على زر العروض
    function enhanceQuoteWizardButton() {
        const buttons = document.querySelectorAll('[data-open-quote-wizard]');
        
        buttons.forEach((button, index) => {
            console.log(`🔘 Found quote wizard button ${index + 1}:`, button);
            
            // إزالة المعالجات القديمة وإضافة جديدة
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            newButton.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('🎯 Quote wizard button clicked!');
                
                // فحص وجود منتجات في العرض
                const items = getStoredItems();
                console.log('📦 Items in quote:', items.length);
                
                if (items.length === 0) {
                    if (window.QiqToast?.warning) {
                        window.QiqToast.warning('يرجى إضافة منتجات إلى العرض أولاً');
                    } else {
                        alert('يرجى إضافة منتجات إلى العرض أولاً');
                    }
                    return;
                }
                
                // فتح معالج العروض
                if (window.QiqQuoteWizard?.open) {
                    console.log('🚀 Opening quote wizard...');
                    window.QiqQuoteWizard.open();
                } else {
                    console.error('❌ QiqQuoteWizard.open not found');
                    fallbackQuoteWizard();
                }
            });
            
            // تحسين مظهر الزر
            newButton.style.pointerEvents = 'auto';
            newButton.style.cursor = 'pointer';
            newButton.disabled = false;
        });
    }
    
    // الحصول على المنتجات المحفوظة
    function getStoredItems() {
        try {
            const raw = localStorage.getItem('qiq_staged_items');
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('Error reading stored items:', e);
            return [];
        }
    }
    
    // معالج احتياطي لفتح المودال
    function fallbackQuoteWizard() {
        console.log('🔄 Using fallback quote wizard');
        
        if (!window.QiqModal) {
            alert('نظام العروض غير متاح حالياً');
            return;
        }
        
        const html = `
            <div style="padding: 20px; text-align: center;">
                <h3 style="margin-bottom: 20px;">طلب عرض سعر</h3>
                <p style="color: #666; margin-bottom: 20px;">سيتم تطوير هذه الميزة قريباً</p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button onclick="window.QiqModal.close()" class="btn secondary">إلغاء</button>
                    <button onclick="downloadQuoteAsPDF()" class="btn">تحميل PDF</button>
                </div>
            </div>
        `;
        
        window.QiqModal.open('#', {
            title: 'طلب عرض سعر',
            html: html,
            size: 'md'
        });
    }
    
    // تحميل العرض كـ PDF (مبسط)
    window.downloadQuoteAsPDF = function() {
        const items = getStoredItems();
        if (items.length === 0) {
            if (window.QiqToast?.warning) {
                window.QiqToast.warning('لا توجد منتجات في العرض');
            }
            return;
        }
        
        // إنشاء محتوى PDF بسيط
        let content = 'QuickITQuote - عرض سعر\n\n';
        content += 'المنتجات:\n';
        
        items.forEach((item, index) => {
            content += `${index + 1}. ${item.name || 'منتج غير معروف'}\n`;
            content += `   السعر: ${item.price || 'غير محدد'}\n`;
            content += `   الكمية: ${item.qty || 1}\n\n`;
        });
        
        // إنشاء وتحميل الملف
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'quote.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        if (window.QiqToast?.success) {
            window.QiqToast.success('تم تحميل العرض بنجاح');
        }
        
        if (window.QiqModal) {
            window.QiqModal.close();
        }
    };
    
    // إعداد debugging للأحداث
    function setupDebugging() {
        // مراقبة النقرات على جميع الأزرار
        document.addEventListener('click', function(e) {
            if (e.target.matches('[data-open-quote-wizard]')) {
                console.log('🎯 Quote wizard button event detected');
            }
        }, true);
        
        // مراقبة تحميل المودال
        const originalModalOpen = window.QiqModal?.open;
        if (originalModalOpen) {
            window.QiqModal.open = function(...args) {
                console.log('📖 Modal opening with args:', args);
                return originalModalOpen.apply(this, args);
            };
        }
    }
    
    // تشغيل التحسينات عند تحميل الصفحة
    function initialize() {
        console.log('🚀 Initializing Quote Wizard Debug & Fix');
        
        if (checkDependencies()) {
            enhanceQuoteWizardButton();
            setupDebugging();
            console.log('✅ Quote Wizard Debug & Fix initialized successfully');
        } else {
            console.warn('⚠️ Some dependencies are missing, retrying in 2 seconds...');
            setTimeout(initialize, 2000);
        }
    }
    
    // تشغيل التهيئة
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    // تصدير للاستخدام العام
    window.QuoteWizardDebug = {
        checkDependencies,
        enhanceQuoteWizardButton,
        fallbackQuoteWizard,
        getStoredItems
    };
})();