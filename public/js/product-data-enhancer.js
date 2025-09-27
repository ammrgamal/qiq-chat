/**
 * Product Data Enhancer
 * محسن بيانات المنتجات لحل مشكلة "Unknown" في المقارنة
 */

class ProductDataEnhancer {
    constructor() {
        this.fieldMappings = this.getFieldMappings();
        this.dataExtractors = this.getDataExtractors();
        this.fallbackStrategies = this.getFallbackStrategies();
    }

    // خريطة حقول البيانات
    getFieldMappings() {
        return {
            // معلومات أساسية
            name: ['name', 'title', 'product_name', 'Name', 'Title', 'اسم المنتج'],
            price: ['price', 'list_price', 'Price', 'List Price', 'unit_price', 'السعر'],
            sku: ['sku', 'pn', 'mpn', 'part_number', 'SKU', 'PN', 'MPN', 'Part Number', 'رقم المنتج'],
            brand: ['brand', 'manufacturer', 'vendor', 'company', 'Brand', 'Manufacturer', 'الشركة'],
            
            // معلومات تقنية
            cpu: ['cpu', 'processor', 'CPU', 'Processor', 'chipset', 'المعالج'],
            ram: ['ram', 'memory', 'RAM', 'Memory', 'memory_size', 'الذاكرة'],
            storage: ['storage', 'disk', 'hdd', 'ssd', 'Storage', 'HDD', 'SSD', 'التخزين'],
            ports: ['ports', 'port_count', 'interfaces', 'Ports', 'Port Count', 'المنافذ'],
            speed: ['speed', 'bandwidth', 'throughput', 'data_rate', 'السرعة'],
            
            // معلومات شبكة
            ethernet_ports: ['ethernet_ports', 'lan_ports', 'network_ports', 'منافذ الشبكة'],
            poe_ports: ['poe_ports', 'poe_plus_ports', 'منافذ PoE'],
            sfp_ports: ['sfp_ports', 'fiber_ports', 'منافذ الألياف'],
            
            // معلومات فيزيائية
            form_factor: ['form_factor', 'formFactor', 'form', 'size', 'الشكل', 'الحجم'],
            dimensions: ['dimensions', 'size', 'الأبعاد'],
            weight: ['weight', 'الوزن'],
            power: ['power', 'power_consumption', 'الطاقة'],
            
            // معلومات إضافية
            warranty: ['warranty', 'guarantee', 'الضمان'],
            features: ['features', 'specifications', 'specs', 'المميزات'],
            description: ['description', 'details', 'overview', 'الوصف'],
            category: ['category', 'type', 'product_type', 'الفئة'],
            
            // معلومات توفر
            availability: ['availability', 'stock', 'in_stock', 'التوفر'],
            lead_time: ['lead_time', 'delivery_time', 'وقت التسليم']
        };
    }

    // استخراج البيانات من النص
    getDataExtractors() {
        return {
            ports: (text) => {
                const portMatches = text.match(/(\d+)[\s-]*port|(\d+)[\s-]*منفذ/gi);
                if (portMatches) {
                    return portMatches[0].match(/\d+/)[0] + ' منافذ';
                }
                return null;
            },
            
            speed: (text) => {
                const speedMatches = text.match(/(\d+(?:\.\d+)?)\s*(gbps|mbps|gbit|mbit|جيجابت|ميجابت)/gi);
                if (speedMatches) {
                    return speedMatches[0];
                }
                return null;
            },
            
            memory: (text) => {
                const memMatches = text.match(/(\d+)\s*(gb|mb|tb|جيجا|ميجا|تيرا)/gi);
                if (memMatches) {
                    return memMatches[0];
                }
                return null;
            },
            
            power: (text) => {
                const powerMatches = text.match(/(\d+(?:\.\d+)?)\s*(w|watt|واط)/gi);
                if (powerMatches) {
                    return powerMatches[0];
                }
                return null;
            },
            
            ethernet: (text) => {
                const ethMatches = text.match(/(\d+)\s*x?\s*(gigabit|fast ethernet|10\/100\/1000|جيجابت)/gi);
                if (ethMatches) {
                    return ethMatches[0];
                }
                return null;
            }
        };
    }

    // استراتيجيات الاحتياطي
    getFallbackStrategies() {
        return {
            brand: (product) => {
                // محاولة استخراج من اسم المنتج
                const commonBrands = ['Cisco', 'HP', 'Dell', 'Aruba', 'Fortinet', 'SonicWall', 'Ubiquiti', 'TP-Link', 'D-Link', 'Netgear', 'Linksys'];
                const name = product.name || '';
                
                for (const brand of commonBrands) {
                    if (name.toLowerCase().includes(brand.toLowerCase())) {
                        return brand;
                    }
                }
                
                // محاولة استخراج من SKU
                const sku = product.sku || product.pn || '';
                if (sku.startsWith('WS-')) return 'Cisco';
                if (sku.startsWith('J') && sku.length >= 8) return 'Aruba';
                if (sku.startsWith('FG-') || sku.startsWith('FortiGate')) return 'Fortinet';
                if (sku.startsWith('UAP-') || sku.startsWith('US-')) return 'Ubiquiti';
                
                return 'غير محدد';
            },
            
            category: (product) => {
                const name = (product.name || '').toLowerCase();
                const desc = (product.description || '').toLowerCase();
                const text = name + ' ' + desc;
                
                if (/switch|سويتش/i.test(text)) return 'Network Switch';
                if (/router|راوتر/i.test(text)) return 'Router';
                if (/access point|ap|نقطة وصول/i.test(text)) return 'Access Point';
                if (/firewall|جدار حماية/i.test(text)) return 'Firewall';
                if (/cable|كابل/i.test(text)) return 'Cable';
                if (/camera|كاميرا/i.test(text)) return 'Camera';
                if (/ups|طاقة/i.test(text)) return 'Power Supply';
                
                return 'غير محدد';
            },
            
            form_factor: (product) => {
                const text = ((product.name || '') + ' ' + (product.description || '')).toLowerCase();
                
                if (/desktop|مكتبي/i.test(text)) return 'Desktop';
                if (/rack|رف/i.test(text)) return 'Rack Mount';
                if (/wall|جداري/i.test(text)) return 'Wall Mount';
                if (/outdoor|خارجي/i.test(text)) return 'Outdoor';
                if (/indoor|داخلي/i.test(text)) return 'Indoor';
                
                return 'قياسي';
            }
        };
    }

    // تحسين بيانات المنتج
    enhanceProduct(product) {
        const enhanced = { ...product };
        
        // تحسين كل حقل
        Object.keys(this.fieldMappings).forEach(field => {
            enhanced[field] = this.getFieldValue(product, field);
        });
        
        // تطبيق استراتيجيات الاحتياطي
        Object.keys(this.fallbackStrategies).forEach(field => {
            if (!enhanced[field] || enhanced[field] === 'Unknown' || enhanced[field] === 'غير معروف') {
                enhanced[field] = this.fallbackStrategies[field](product);
            }
        });
        
        // تحسين البيانات من النصوص
        this.extractFromText(enhanced);
        
        return enhanced;
    }

    // الحصول على قيمة الحقل
    getFieldValue(product, field) {
        const mappings = this.fieldMappings[field] || [field];
        
        for (const mapping of mappings) {
            const value = this.getNestedValue(product, mapping);
            if (value !== null && value !== undefined && value !== '' && value !== 'Unknown') {
                return this.cleanValue(value);
            }
        }
        
        return null;
    }

    // الحصول على قيمة متداخلة
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : null;
        }, obj);
    }

    // تنظيف القيم
    cleanValue(value) {
        if (typeof value !== 'string') {
            return value;
        }
        
        // إزالة HTML tags
        value = value.replace(/<[^>]*>/g, '');
        
        // تنظيف المسافات
        value = value.trim();
        
        // إزالة الأقواس الفارغة
        value = value.replace(/\(\s*\)/g, '');
        
        return value || null;
    }

    // استخراج البيانات من النص
    extractFromText(product) {
        const textSources = [
            product.name,
            product.description,
            product.specifications,
            product.features
        ].filter(Boolean).join(' ');
        
        if (!textSources) return;
        
        // تطبيق مستخرجات البيانات
        Object.keys(this.dataExtractors).forEach(field => {
            if (!product[field]) {
                const extracted = this.dataExtractors[field](textSources);
                if (extracted) {
                    product[field] = extracted;
                }
            }
        });
    }

    // تحسين مجموعة من المنتجات
    enhanceProducts(products) {
        return products.map(product => this.enhanceProduct(product));
    }

    // الحصول على بيانات للمقارنة
    getComparisonData(product, fields) {
        const enhanced = this.enhanceProduct(product);
        const comparisonData = {};
        
        fields.forEach(field => {
            let value = enhanced[field.key];
            
            if (!value || value === 'Unknown') {
                value = this.generateFallbackValue(enhanced, field.key);
            }
            
            if (!value || value === 'Unknown') {
                value = 'غير متوفر';
            }
            
            comparisonData[field.key] = {
                value: value,
                label: field.label,
                type: field.type || 'text'
            };
        });
        
        return comparisonData;
    }

    // توليد قيمة احتياطية
    generateFallbackValue(product, field) {
        const name = product.name || '';
        const desc = product.description || '';
        const text = (name + ' ' + desc).toLowerCase();
        
        switch (field) {
            case 'cpu':
                if (/intel/i.test(text)) return 'Intel Processor';
                if (/amd/i.test(text)) return 'AMD Processor';
                if (/arm/i.test(text)) return 'ARM Processor';
                break;
                
            case 'warranty':
                if (/lifetime|مدى الحياة/i.test(text)) return 'مدى الحياة';
                if (/3 year|3 سنوات/i.test(text)) return '3 سنوات';
                if (/1 year|سنة واحدة/i.test(text)) return 'سنة واحدة';
                return 'سنة واحدة'; // افتراضي
                
            case 'power':
                if (/poe\+|poe plus/i.test(text)) return 'PoE+';
                if (/poe/i.test(text)) return 'PoE';
                break;
        }
        
        return null;
    }
}

// تصدير للاستخدام العام
window.ProductDataEnhancer = ProductDataEnhancer;

// تطبيق التحسينات تلقائياً
document.addEventListener('DOMContentLoaded', function() {
    const enhancer = new ProductDataEnhancer();
    window.productEnhancer = enhancer;
    
    // تحسين دالة hitToCard الموجودة
    const originalHitToCard = window.hitToCard;
    if (originalHitToCard) {
        window.hitToCard = function(hit) {
            const enhancedHit = enhancer.enhanceProduct(hit);
            return originalHitToCard(enhancedHit);
        };
    }
    
    // تحسين نظام المقارنة
    if (window.QiqComparison) {
        const originalOpenModal = window.QiqComparison.openModal;
        if (originalOpenModal) {
            window.QiqComparison.openModal = function() {
                const products = this.getProducts();
                const enhancedProducts = enhancer.enhanceProducts(products);
                
                // إنشاء HTML محسن للمقارنة
                const comparisonHTML = generateEnhancedComparisonHTML(enhancedProducts, enhancer);
                
                if (window.QiqModal) {
                    window.QiqModal.open('', {
                        html: comparisonHTML,
                        title: 'مقارنة المنتجات المحسنة',
                        size: 'lg'
                    });
                }
            };
        }
    }
});

// توليد HTML محسن للمقارنة
function generateEnhancedComparisonHTML(products, enhancer) {
    if (!products || products.length === 0) {
        return `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
                <h3 style="margin: 0 0 8px 0; color: #374151;">لا توجد منتجات للمقارنة</h3>
                <p style="color: #6b7280; margin: 0;">أضف منتجين أو أكثر للمقارنة بينهم</p>
            </div>`;
    }

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
        <div style="max-width: 100%; overflow-x: auto; padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <div>
                    <h2 style="margin: 0; color: #111827;">مقارنة المنتجات</h2>
                    <p style="margin: 4px 0 0 0; color: #6b7280;">${products.length} منتجات محسنة للمقارنة</p>
                </div>
                <div style="display: flex; gap: 12px;">
                    <button onclick="exportComparisonToPDF()" class="btn success">
                        📄 تصدير PDF
                    </button>
                    <button onclick="addAllComparisonToQuote()" class="btn" style="background: #059669;">
                        ➕ إضافة الكل للعرض
                    </button>
                    <button onclick="clearAllComparison()" class="btn danger">
                        🗑️ مسح الكل
                    </button>
                </div>
            </div>
            
            <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;" class="comparison-table">
                    <thead>
                        <tr style="background: linear-gradient(135deg, #f8fafc 0%, #e5e7eb 100%);">
                            <th style="text-align: right; padding: 16px; border-bottom: 2px solid #e5e7eb; font-weight: 700; color: #374151;">الخاصية</th>`;
    
    products.forEach((product, index) => {
        const productImage = product.image || 'https://via.placeholder.com/80x80?text=IMG';
        html += `
            <th style="text-align: center; padding: 16px; border-bottom: 2px solid #e5e7eb; min-width: 180px;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
                    <img src="${productImage}" 
                         style="width: 80px; height: 80px; object-fit: cover; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"
                         onerror="this.src='https://via.placeholder.com/80x80?text=IMG'" />
                    <div style="text-align: center;">
                        <div style="font-weight: 600; color: #111827; margin-bottom: 4px; line-height: 1.3;">
                            ${(product.name || 'منتج غير معروف').substring(0, 40)}${product.name && product.name.length > 40 ? '...' : ''}
                        </div>
                        <button onclick="removeFromComparison('${product.id}')" 
                                class="btn danger" style="padding: 6px 12px; font-size: 11px;">
                            ✕ إزالة
                        </button>
                    </div>
                </div>
            </th>`;
    });

    html += `</tr></thead><tbody>`;

    comparisonFields.forEach((field, fieldIndex) => {
        const isEvenRow = fieldIndex % 2 === 0;
        html += `<tr style="background: ${isEvenRow ? '#fafafa' : 'white'};">
                    <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151;">
                        ${field.label}
                    </td>`;
        
        products.forEach(product => {
            const comparisonData = enhancer.getComparisonData(product, [field]);
            let value = comparisonData[field.key]?.value || 'غير متوفر';
            
            if (field.type === 'price' && value !== 'غير متوفر') {
                value = `${value} ${window.QiqSession?.currency || 'EGP'}`;
            }
            
            const cellClass = value === 'غير متوفر' ? 'color: #9ca3af; font-style: italic;' : 'color: #111827;';
            
            html += `<td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: center; ${cellClass}">
                        ${escapeHtml(String(value))}
                     </td>`;
        });
        
        html += `</tr>`;
    });

    html += `
            </tbody>
        </table>
    </div>
    
    <div style="margin-top: 24px; padding: 20px; background: #f8fafc; border-radius: 12px; text-align: center;">
        <p style="margin: 0 0 16px 0; color: #6b7280;">هل أنت راض عن المقارنة؟</p>
        <div style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
            <button onclick="addAllComparisonToQuote()" class="btn success" style="padding: 12px 24px;">
                ➕ إضافة جميع المنتجات للعرض
            </button>
            <button onclick="shareComparison()" class="btn ghost" style="padding: 12px 24px;">
                🔗 مشاركة المقارنة
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
                // إعادة فتح النافذة مع البيانات المحدثة
                setTimeout(() => {
                    window.QiqComparison.openModal();
                }, 300);
            }
        }
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
    
    function addAllComparisonToQuote() {
        if (window.QiqComparison && window.AddToQuote) {
            const products = window.QiqComparison.getProducts();
            let addedCount = 0;
            
            products.forEach(product => {
                try {
                    const fakeButton = {
                        dataset: {
                            name: product.name,
                            price: product.price,
                            pn: product.sku,
                            image: product.image,
                            manufacturer: product.manufacturer || product.brand,
                            source: 'Comparison'
                        }
                    };
                    window.AddToQuote(fakeButton);
                    addedCount++;
                } catch (error) {
                    console.warn('فشل في إضافة المنتج:', product.name, error);
                }
            });
            
            window.QiqModal?.close();
            if (window.QiqToast?.success) {
                window.QiqToast.success(\`تم إضافة \${addedCount} منتجات للعرض بنجاح!\`);
            }
        }
    }
    
    function exportComparisonToPDF() {
        if (window.QiqToast?.info) {
            window.QiqToast.info('ميزة تصدير PDF قيد التطوير...');
        }
    }
    
    function shareComparison() {
        if (navigator.share) {
            navigator.share({
                title: 'مقارنة المنتجات - QuickITQuote',
                text: 'شاهد مقارنة المنتجات على QuickITQuote',
                url: window.location.href
            });
        } else if (window.QiqToast?.info) {
            window.QiqToast.info('المشاركة غير مدعومة في هذا المتصفح');
        }
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
</script>`;

    return html;
}