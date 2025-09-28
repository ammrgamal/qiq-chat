/**
 * Enhanced UI Components with Tailwind CSS
 * مكونات واجهة المستخدم المحسنة مع دعم الوضع المظلم
 */

class EnhancedUIComponents {
    constructor() {
        this.isDarkMode = this.checkDarkMode();
        this.init();
    }

    // فحص الوضع المظلم
    checkDarkMode() {
        return document.documentElement.classList.contains('dark') || 
               localStorage.getItem('theme') === 'dark' ||
               window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    // تهيئة النظام
    init() {
        this.injectTailwindCSS();
        this.enhanceProductCards();
        this.improveComparisonModal();
        this.addDarkModeSupport();
        this.addTooltips();
        this.addLoadingSkeletons();
        this.removeButtonDuplication();
        console.log('🎨 Enhanced UI Components initialized');
    }

    // إضافة Tailwind CSS
    injectTailwindCSS() {
        if (!document.querySelector('[data-tailwind]')) {
            const tailwindLink = document.createElement('link');
            tailwindLink.rel = 'stylesheet';
            tailwindLink.href = 'https://cdn.tailwindcss.com';
            tailwindLink.setAttribute('data-tailwind', 'true');
            document.head.appendChild(tailwindLink);

            // إضافة تكوين Tailwind للوضع المظلم
            const tailwindConfig = document.createElement('script');
            tailwindConfig.innerHTML = `
                tailwind.config = {
                    darkMode: 'class',
                    theme: {
                        extend: {
                            colors: {
                                primary: {
                                    50: '#eff6ff',
                                    600: '#2563eb',
                                    700: '#1d4ed8',
                                    800: '#1e40af',
                                    900: '#1e3a8a'
                                }
                            }
                        }
                    }
                }
            `;
            document.head.appendChild(tailwindConfig);
        }
    }

    // تحسين بطاقات المنتجات
    enhanceProductCards() {
        const style = document.createElement('style');
        style.innerHTML = `
            /* Enhanced Product Cards */
            .enhanced-product-card {
                @apply bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-300;
                @apply border border-gray-200 dark:border-gray-700;
                @apply p-4 mb-4;
            }

            .enhanced-product-card:hover {
                @apply transform -translate-y-1 shadow-lg;
            }

            .enhanced-card-image {
                @apply w-20 h-20 object-cover rounded-lg mb-3;
                @apply bg-gray-100 dark:bg-gray-700;
            }

            .enhanced-card-title {
                @apply text-lg font-semibold text-gray-900 dark:text-white mb-2;
                @apply line-clamp-2;
            }

            .enhanced-card-description {
                @apply text-sm text-gray-600 dark:text-gray-400 mb-3;
                @apply line-clamp-2;
            }

            .enhanced-card-chips {
                @apply flex flex-wrap gap-2 mb-4;
            }

            .enhanced-chip {
                @apply px-2 py-1 rounded-full text-xs font-medium;
                @apply bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300;
            }

            .enhanced-chip.price {
                @apply bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300;
            }

            /* Enhanced Action Buttons */
            .enhanced-btn-group {
                @apply flex gap-2 flex-wrap;
            }

            .enhanced-btn {
                @apply px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200;
                @apply focus:outline-none focus:ring-2 focus:ring-offset-2;
                @apply disabled:opacity-50 disabled:cursor-not-allowed;
            }

            .enhanced-btn-primary {
                @apply bg-primary-800 dark:bg-primary-600 text-white;
                @apply hover:bg-primary-900 dark:hover:bg-primary-700;
                @apply focus:ring-primary-500;
                @apply shadow-sm hover:shadow-md;
            }

            .enhanced-btn-secondary {
                @apply bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300;
                @apply hover:bg-gray-200 dark:hover:bg-gray-600;
                @apply focus:ring-gray-500;
                @apply border border-gray-300 dark:border-gray-600;
            }

            .enhanced-btn-success {
                @apply bg-green-600 dark:bg-green-500 text-white;
                @apply hover:bg-green-700 dark:hover:bg-green-600;
                @apply focus:ring-green-500;
            }

            .enhanced-btn-icon {
                @apply inline-flex items-center gap-2;
            }

            /* Tooltip Styles */
            .enhanced-tooltip {
                @apply absolute z-50 px-2 py-1 text-sm;
                @apply bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900;
                @apply rounded shadow-lg opacity-0 pointer-events-none;
                @apply transition-opacity duration-200;
            }

            .enhanced-tooltip.show {
                @apply opacity-100;
            }

            /* Loading Skeletons */
            .loading-skeleton {
                @apply animate-pulse;
            }

            .skeleton-card {
                @apply bg-white dark:bg-gray-800 rounded-xl p-4 mb-4;
                @apply border border-gray-200 dark:border-gray-700;
            }

            .skeleton-image {
                @apply w-20 h-20 bg-gray-300 dark:bg-gray-600 rounded-lg mb-3;
            }

            .skeleton-line {
                @apply h-4 bg-gray-300 dark:bg-gray-600 rounded mb-2;
            }

            .skeleton-line.short {
                @apply w-2/3;
            }

            .skeleton-line.medium {
                @apply w-4/5;
            }
        `;
        document.head.appendChild(style);
    }

    // تحسين نافذة المقارنة
    improveComparisonModal() {
        const comparisonStyle = document.createElement('style');
        comparisonStyle.innerHTML = `
            /* Enhanced Comparison Modal */
            .enhanced-comparison-modal {
                @apply max-w-7xl mx-auto;
            }

            .enhanced-comparison-table {
                @apply w-full border-collapse;
                @apply bg-white dark:bg-gray-800;
                @apply rounded-lg overflow-hidden shadow-lg;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .enhanced-comparison-table th {
                @apply bg-gray-50 dark:bg-gray-700 px-4 py-3;
                @apply text-sm font-semibold text-gray-900 dark:text-white;
                @apply border-b border-gray-200 dark:border-gray-600;
                @apply text-center;
                min-width: 150px;
            }

            .enhanced-comparison-table td {
                @apply px-4 py-3 text-sm;
                @apply text-gray-700 dark:text-gray-300;
                @apply border-b border-gray-100 dark:border-gray-700;
                @apply text-center;
            }

            .enhanced-comparison-table tr:nth-child(even) {
                @apply bg-gray-50 dark:bg-gray-750;
            }

            .enhanced-comparison-table tr:hover {
                @apply bg-blue-50 dark:bg-blue-900/20;
            }

            .comparison-scroll {
                @apply overflow-x-auto;
                @apply scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300;
                @apply dark:scrollbar-track-gray-800 dark:scrollbar-thumb-gray-600;
            }

            .comparison-unknown {
                @apply text-gray-400 dark:text-gray-500;
            }

            .comparison-value-missing {
                @apply hidden;
            }

            /* Product Image in Comparison */
            .comparison-product-image {
                @apply w-16 h-16 object-cover rounded-lg mx-auto mb-2;
                @apply bg-gray-100 dark:bg-gray-700;
            }

            .comparison-product-name {
                @apply font-medium text-xs text-center;
                @apply text-gray-900 dark:text-white;
            }
        `;
        document.head.appendChild(comparisonStyle);

        // تحسين دالة المقارنة الموجودة
        this.enhanceComparisonFunction();
    }

    // تحسين دالة المقارنة
    enhanceComparisonFunction() {
        // تحسين generateEnhancedComparisonHTML الموجودة
        if (window.generateEnhancedComparisonHTML) {
            const originalFunction = window.generateEnhancedComparisonHTML;
            
            window.generateEnhancedComparisonHTML = (products, enhancer) => {
                if (!products || products.length === 0) {
                    return this.generateEmptyComparisonHTML();
                }

                return this.generateEnhancedComparisonHTML(products, enhancer);
            };
        }
    }

    // إنتاج HTML محسن للمقارنة
    generateEnhancedComparisonHTML(products, enhancer) {
        const comparisonFields = [
            { key: 'name', label: 'اسم المنتج', type: 'text' },
            { key: 'brand', label: 'الشركة', type: 'text' },
            { key: 'sku', label: 'رقم المنتج', type: 'text' },
            { key: 'price', label: 'السعر', type: 'price' },
            { key: 'category', label: 'الفئة', type: 'text' },
            { key: 'ports', label: 'المنافذ', type: 'text' },
            { key: 'speed', label: 'السرعة', type: 'text' },
            { key: 'power', label: 'الطاقة', type: 'text' },
            { key: 'form_factor', label: 'الشكل', type: 'text' },
            { key: 'warranty', label: 'الضمان', type: 'text' }
        ];

        let html = `
            <div class="enhanced-comparison-modal p-6">
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">مقارنة المنتجات</h2>
                        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${products.length} منتجات للمقارنة</p>
                    </div>
                    <div class="flex gap-3">
                        <button onclick="exportComparisonToPDF()" 
                                class="enhanced-btn enhanced-btn-secondary enhanced-btn-icon">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                            </svg>
                            تصدير PDF
                        </button>
                        <button onclick="addAllComparisonToQuote()" 
                                class="enhanced-btn enhanced-btn-success enhanced-btn-icon">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                            </svg>
                            إضافة الكل للعرض
                        </button>
                        <button onclick="clearAllComparison()" 
                                class="enhanced-btn enhanced-btn-secondary">
                            مسح الكل
                        </button>
                    </div>
                </div>
                
                <div class="comparison-scroll">
                    <table class="enhanced-comparison-table">
                        <thead>
                            <tr>
                                <th class="text-right">الخاصية</th>`;

        products.forEach((product, index) => {
            const productImage = product.image || '/api/placeholder/64/64';
            html += `
                <th>
                    <div class="flex flex-col items-center space-y-2">
                        <img src="${productImage}" 
                             class="comparison-product-image"
                             onerror="this.src='/api/placeholder/64/64'" />
                        <div class="comparison-product-name">
                            ${this.truncateText(product.name || 'منتج غير معروف', 30)}
                        </div>
                        <button onclick="removeFromComparison('${product.id || product.objectID}')" 
                                class="text-red-500 hover:text-red-700 text-xs">
                            ✕ إزالة
                        </button>
                    </div>
                </th>`;
        });

        html += `</tr></thead><tbody>`;

        comparisonFields.forEach((field, fieldIndex) => {
            // فحص إذا كانت جميع القيم مفقودة للحقل
            const hasAnyValue = products.some(product => {
                const value = this.getComparisonValue(product, field, enhancer);
                return value && value !== 'Unknown' && value !== 'غير متوفر' && value !== '-';
            });

            // إخفاء الصف إذا كانت جميع القيم مفقودة
            if (!hasAnyValue) return;

            html += `<tr>
                        <td class="text-right font-medium text-gray-900 dark:text-white">
                            ${field.label}
                        </td>`;
            
            products.forEach(product => {
                let value = this.getComparisonValue(product, field, enhancer);
                
                if (field.type === 'price' && value && value !== 'غير متوفر' && value !== '-') {
                    value = `${value} ${window.QiqSession?.currency || 'EGP'}`;
                }
                
                const cellClass = (value === 'غير متوفر' || value === '-' || value === 'Unknown') 
                    ? 'comparison-unknown' 
                    : 'text-gray-900 dark:text-white';
                
                html += `<td class="${cellClass}">
                            ${this.escapeHtml(String(value))}
                         </td>`;
            });
            
            html += `</tr>`;
        });

        html += `
            </tbody>
        </table>
    </div>
    
    <div class="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">هل أنت راض عن المقارنة؟</p>
        <div class="flex justify-center gap-3 flex-wrap">
            <button onclick="addAllComparisonToQuote()" 
                    class="enhanced-btn enhanced-btn-primary enhanced-btn-icon">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                </svg>
                إضافة جميع المنتجات للعرض
            </button>
            <button onclick="shareComparison()" 
                    class="enhanced-btn enhanced-btn-secondary enhanced-btn-icon">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"/>
                </svg>
                مشاركة المقارنة
            </button>
        </div>
    </div>
</div>

<script>
    function removeFromComparison(productId) {
        if (window.QiqComparison) {
            window.QiqComparison.remove(productId);
            
            if (window.QiqComparison.getProducts().length === 0) {
                window.QiqModal?.close();
                if (window.QiqToast?.info) {
                    window.QiqToast.info('تم مسح جميع المنتجات من المقارنة');
                }
            } else {
                setTimeout(() => {
                    window.QiqComparison.openModal();
                }, 300);
            }
        }
    }
</script>`;

        return html;
    }

    // الحصول على قيمة المقارنة
    getComparisonValue(product, field, enhancer) {
        if (enhancer) {
            const comparisonData = enhancer.getComparisonData(product, [field]);
            let value = comparisonData[field.key]?.value;
            
            if (!value || value === 'Unknown' || value === 'غير معروف') {
                return '-';
            }
            
            return value;
        }
        
        // استخراج مباشر من المنتج
        let value = product[field.key];
        if (!value || value === 'Unknown' || value === 'غير معروف') {
            return '-';
        }
        
        return value;
    }

    // إنتاج HTML للمقارنة الفارغة
    generateEmptyComparisonHTML() {
        return `
            <div class="enhanced-comparison-modal p-12 text-center">
                <div class="text-6xl mb-4">📊</div>
                <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">لا توجد منتجات للمقارنة</h3>
                <p class="text-gray-600 dark:text-gray-400">أضف منتجين أو أكثر للمقارنة بينهم</p>
            </div>`;
    }

    // إضافة دعم الوضع المظلم
    addDarkModeSupport() {
        // إضافة toggle للوضع المظلم
        const darkModeToggle = document.querySelector('#themeToggleChat') || 
                              document.querySelector('[data-theme-toggle]');
        
        if (darkModeToggle && !darkModeToggle.hasAttribute('data-enhanced')) {
            darkModeToggle.setAttribute('data-enhanced', 'true');
            darkModeToggle.addEventListener('click', () => {
                this.toggleDarkMode();
            });
        }

        // تطبيق الوضع المحفوظ
        if (this.isDarkMode) {
            document.documentElement.classList.add('dark');
        }
    }

    // تبديل الوضع المظلم
    toggleDarkMode() {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        this.isDarkMode = isDark;
        
        if (window.QiqToast) {
            window.QiqToast.success(isDark ? 'تم تفعيل الوضع المظلم' : 'تم تفعيل الوضع الفاتح');
        }
    }

    // إضافة tooltips
    addTooltips() {
        document.addEventListener('mouseover', (e) => {
            const compareBtn = e.target.closest('.compare-btn, [data-compare]');
            if (compareBtn && !compareBtn.querySelector('.enhanced-tooltip')) {
                this.showTooltip(compareBtn, 'اضغط للمقارنة مع المنتجات الأخرى');
            }
        });
    }

    // عرض tooltip
    showTooltip(element, text) {
        const tooltip = document.createElement('div');
        tooltip.className = 'enhanced-tooltip';
        tooltip.textContent = text;
        
        element.style.position = 'relative';
        element.appendChild(tooltip);
        
        setTimeout(() => tooltip.classList.add('show'), 10);
        
        const hideTooltip = () => {
            tooltip.classList.remove('show');
            setTimeout(() => tooltip.remove(), 200);
        };
        
        element.addEventListener('mouseleave', hideTooltip, { once: true });
        setTimeout(hideTooltip, 3000);
    }

    // إضافة loading skeletons
    addLoadingSkeletons() {
        window.showProductsSkeleton = (count = 6) => {
            const container = document.querySelector('#results, .products-grid, .results');
            if (!container) return;

            const skeletonHTML = Array.from({length: count}, () => `
                <div class="skeleton-card loading-skeleton">
                    <div class="skeleton-image"></div>
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line short"></div>
                    <div class="skeleton-line medium"></div>
                    <div class="flex gap-2 mt-3">
                        <div class="skeleton-line short" style="height: 24px;"></div>
                        <div class="skeleton-line short" style="height: 24px;"></div>
                    </div>
                </div>
            `).join('');

            container.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${skeletonHTML}</div>`;
        };

        window.hideProductsSkeleton = () => {
            const skeletons = document.querySelectorAll('.loading-skeleton');
            skeletons.forEach(skeleton => skeleton.remove());
        };
    }

    // إزالة تكرار الأزرار
    removeButtonDuplication() {
        // تحسين دالة hitToCard لإزالة التكرار
        if (window.hitToCard) {
            const originalHitToCard = window.hitToCard;
            
            window.hitToCard = (hit) => {
                const originalHTML = originalHitToCard(hit);
                
                // تحسين HTML مع الفئات الجديدة
                return this.enhanceCardHTML(originalHTML, hit);
            };
        }

        // إزالة الأزرار المكررة الموجودة
        setTimeout(() => {
            this.cleanupDuplicateButtons();
        }, 1000);
    }

    // تحسين HTML البطاقة
    enhanceCardHTML(originalHTML, hit) {
        // إنشاء نموذج محسن للبطاقة
        const name = hit?.name || hit?.title || 'اسم غير معروف';
        const price = hit?.price || hit?.list_price || '';
        const pn = hit?.pn || hit?.sku || hit?.objectID || '';
        const image = hit?.image || hit?.image_url || '/api/placeholder/80/80';
        const brand = hit?.brand || hit?.manufacturer || 'غير محدد';
        const description = hit?.description || '';

        return `
            <div class="enhanced-product-card" data-id="${pn}">
                <div class="flex items-start space-x-4 space-x-reverse">
                    <img src="${image}" 
                         class="enhanced-card-image"
                         onerror="this.src='/api/placeholder/80/80'" 
                         loading="lazy" />
                    
                    <div class="flex-1">
                        <h3 class="enhanced-card-title">${this.escapeHtml(name)}</h3>
                        
                        ${description ? `<p class="enhanced-card-description">${this.escapeHtml(description)}</p>` : ''}
                        
                        <div class="enhanced-card-chips">
                            ${pn ? `<span class="enhanced-chip">PN: ${this.escapeHtml(pn)}</span>` : ''}
                            ${brand !== 'غير محدد' ? `<span class="enhanced-chip">${this.escapeHtml(brand)}</span>` : ''}
                            ${price ? `<span class="enhanced-chip price">${this.escapeHtml(price)} ${window.QiqSession?.currency || 'EGP'}</span>` : ''}
                        </div>
                        
                        <div class="enhanced-btn-group">
                            <button class="enhanced-btn enhanced-btn-primary enhanced-btn-icon" 
                                    onclick="handleAddToQuote(this)"
                                    data-name="${this.escapeHtml(name)}"
                                    data-price="${this.escapeHtml(price)}"
                                    data-pn="${this.escapeHtml(pn)}"
                                    data-image="${this.escapeHtml(image)}"
                                    data-manufacturer="${this.escapeHtml(brand)}"
                                    title="إضافة للعرض">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                                </svg>
                                إضافة
                            </button>
                            
                            <button class="enhanced-btn enhanced-btn-secondary compare-btn" 
                                    onclick="handleComparisonToggle(this)"
                                    data-id="${hit?.objectID || pn}"
                                    data-compare="true"
                                    title="إضافة للمقارنة">
                                ⚖️
                            </button>
                            
                            <button class="enhanced-btn enhanced-btn-secondary fav-btn" 
                                    onclick="handleFavoriteToggle(this)"
                                    data-id="${hit?.objectID || pn}"
                                    title="إضافة للمفضلة">
                                ❤️
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    // تنظيف الأزرار المكررة
    cleanupDuplicateButtons() {
        const cards = document.querySelectorAll('.card, .product-card');
        
        cards.forEach(card => {
            const actionButtons = card.querySelectorAll('.card-actions button, .product-actions button');
            const buttonGroups = {};
            
            actionButtons.forEach(button => {
                const action = this.getButtonAction(button);
                if (action) {
                    if (buttonGroups[action]) {
                        // إزالة الزر المكرر
                        button.remove();
                    } else {
                        buttonGroups[action] = button;
                        // تحسين الزر الموجود
                        this.enhanceExistingButton(button, action);
                    }
                }
            });
        });
    }

    // تحديد نوع الزر
    getButtonAction(button) {
        const text = button.textContent.toLowerCase();
        const onclick = button.getAttribute('onclick') || '';
        
        if (text.includes('إضافة') || onclick.includes('AddToQuote')) return 'add';
        if (text.includes('مقارنة') || onclick.includes('Comparison')) return 'compare';
        if (text.includes('مفضلة') || onclick.includes('Favorite')) return 'favorite';
        
        return null;
    }

    // تحسين الزر الموجود
    enhanceExistingButton(button, action) {
        // إضافة الفئات المحسنة
        button.classList.add('enhanced-btn');
        
        if (action === 'add') {
            button.classList.add('enhanced-btn-primary');
        } else {
            button.classList.add('enhanced-btn-secondary');
        }
        
        if (!button.classList.contains('enhanced-btn-icon')) {
            button.classList.add('enhanced-btn-icon');
        }
    }

    // دوال مساعدة
    truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// تصدير للاستخدام العام
window.EnhancedUIComponents = EnhancedUIComponents;

// تهيئة تلقائية
document.addEventListener('DOMContentLoaded', function() {
    window.enhancedUI = new EnhancedUIComponents();
});