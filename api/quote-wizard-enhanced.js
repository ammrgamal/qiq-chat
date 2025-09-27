export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { action, data } = req.body || {};

        switch (action) {
            case 'validate_form':
                return await validateQuoteForm(data, res);
            
            case 'generate_quote':
                return await generateQuote(data, res);
            
            case 'save_draft':
                return await saveDraft(data, res);
            
            case 'load_draft':
                return await loadDraft(data, res);
            
            case 'send_email':
                return await sendQuoteEmail(data, res);
            
            case 'create_pdf':
                return await createQuotePDF(data, res);
            
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid action specified'
                });
        }
    } catch (error) {
        console.error('Quote Wizard API Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Quote service temporarily unavailable',
            error: error.message
        });
    }
}

async function validateQuoteForm(data, res) {
    try {
        const validation = {
            isValid: true,
            errors: {},
            warnings: []
        };

        // التحقق من البيانات الأساسية
        if (!data.customer_name || data.customer_name.trim().length < 2) {
            validation.errors.customer_name = 'اسم العميل مطلوب (على الأقل حرفين)';
            validation.isValid = false;
        }

        if (!data.customer_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.customer_email)) {
            validation.errors.customer_email = 'بريد إلكتروني صحيح مطلوب';
            validation.isValid = false;
        }

        if (!data.customer_phone || !/^[\d\s\+\-\(\)]{10,}$/.test(data.customer_phone)) {
            validation.errors.customer_phone = 'رقم هاتف صحيح مطلوب';
            validation.isValid = false;
        }

        // التحقق من المنتجات
        if (!data.products || !Array.isArray(data.products) || data.products.length === 0) {
            validation.errors.products = 'يجب إضافة منتج واحد على الأقل';
            validation.isValid = false;
        } else {
            // التحقق من كل منتج
            data.products.forEach((product, index) => {
                if (!product.name || product.name.trim().length < 2) {
                    validation.errors[`product_${index}_name`] = `اسم المنتج ${index + 1} مطلوب`;
                    validation.isValid = false;
                }
                
                if (!product.quantity || product.quantity < 1) {
                    validation.errors[`product_${index}_quantity`] = `كمية المنتج ${index + 1} يجب أن تكون أكبر من صفر`;
                    validation.isValid = false;
                }
                
                if (!product.price || product.price < 0) {
                    validation.warnings.push(`سعر المنتج ${index + 1} غير محدد`);
                }
            });
        }

        // التحقق من معلومات الشركة (اختيارية ولكن مُحبذة)
        if (!data.company_name) {
            validation.warnings.push('اسم الشركة غير محدد - سيتم استخدام "عميل فردي"');
        }

        if (!data.delivery_address) {
            validation.warnings.push('عنوان التسليم غير محدد');
        }

        // التحقق من البيانات الإضافية
        if (data.delivery_date && new Date(data.delivery_date) < new Date()) {
            validation.errors.delivery_date = 'تاريخ التسليم يجب أن يكون في المستقبل';
            validation.isValid = false;
        }

        return res.status(200).json({
            success: true,
            validation: validation,
            message: validation.isValid ? 'البيانات صحيحة' : 'يرجى تصحيح الأخطاء المذكورة'
        });

    } catch (error) {
        console.error('Form validation error:', error);
        return res.status(500).json({
            success: false,
            message: 'خطأ في التحقق من البيانات',
            error: error.message
        });
    }
}

async function generateQuote(data, res) {
    try {
        // حساب إجمالي المبلغ
        let subtotal = 0;
        const processedProducts = data.products.map(product => {
            const productTotal = (product.price || 0) * (product.quantity || 1);
            subtotal += productTotal;
            
            return {
                ...product,
                total: productTotal,
                formatted_price: formatCurrency(product.price || 0),
                formatted_total: formatCurrency(productTotal)
            };
        });

        // حساب الضرائب والخصومات
        const taxRate = data.tax_rate || 0.14; // 14% ضريبة القيمة المضافة
        const discount = data.discount || 0;
        const taxAmount = subtotal * taxRate;
        const discountAmount = subtotal * (discount / 100);
        const total = subtotal + taxAmount - discountAmount;

        // إنشاء رقم العرض
        const quoteNumber = generateQuoteNumber();

        // بيانات العرض
        const quote = {
            quote_number: quoteNumber,
            created_at: new Date().toISOString(),
            valid_until: getValidUntilDate(data.validity_days || 30),
            
            // بيانات العميل
            customer: {
                name: data.customer_name,
                email: data.customer_email,
                phone: data.customer_phone,
                company: data.company_name || 'عميل فردي',
                address: data.delivery_address || 'غير محدد'
            },

            // المنتجات
            products: processedProducts,

            // الحسابات المالية
            financial: {
                subtotal: subtotal,
                tax_rate: taxRate,
                tax_amount: taxAmount,
                discount_percentage: discount,
                discount_amount: discountAmount,
                total: total,
                currency: 'EGP'
            },

            // التفاصيل الإضافية
            details: {
                delivery_date: data.delivery_date,
                payment_terms: data.payment_terms || 'الدفع عند الاستلام',
                notes: data.special_requirements || '',
                warranty: data.warranty_terms || 'ضمان الوكيل'
            },

            // حالة العرض
            status: 'pending',
            
            // بيانات منسقة للعرض
            formatted: {
                subtotal: formatCurrency(subtotal),
                tax_amount: formatCurrency(taxAmount),
                discount_amount: formatCurrency(discountAmount),
                total: formatCurrency(total)
            }
        };

        // حفظ العرض في قاعدة البيانات المحلية
        await saveQuoteToStorage(quote);

        // إرسال إلى HelloLeads إذا كان متاحاً
        try {
            const helloLeadsKey = process.env.HELLOLEADS_API_KEY;
            if (helloLeadsKey) {
                await sendQuoteToHelloLeads(quote, helloLeadsKey);
            }
        } catch (helloLeadsError) {
            console.log('HelloLeads integration failed:', helloLeadsError.message);
        }

        return res.status(200).json({
            success: true,
            message: 'تم إنشاء العرض بنجاح',
            quote: quote
        });

    } catch (error) {
        console.error('Quote generation error:', error);
        return res.status(500).json({
            success: false,
            message: 'خطأ في إنشاء العرض',
            error: error.message
        });
    }
}

async function saveDraft(data, res) {
    try {
        const draftId = data.draft_id || `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const draft = {
            id: draftId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            data: data.form_data,
            progress: calculateFormProgress(data.form_data),
            auto_saved: data.auto_save || false
        };

        // حفظ المسودة محلياً
        await saveDraftToStorage(draft);

        return res.status(200).json({
            success: true,
            message: 'تم حفظ المسودة',
            draft_id: draftId,
            progress: draft.progress
        });

    } catch (error) {
        console.error('Draft save error:', error);
        return res.status(500).json({
            success: false,
            message: 'خطأ في حفظ المسودة',
            error: error.message
        });
    }
}

async function loadDraft(data, res) {
    try {
        if (!data.draft_id) {
            throw new Error('Draft ID is required');
        }

        const draft = await loadDraftFromStorage(data.draft_id);
        
        if (!draft) {
            return res.status(404).json({
                success: false,
                message: 'المسودة غير موجودة'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'تم تحميل المسودة',
            draft: draft
        });

    } catch (error) {
        console.error('Draft load error:', error);
        return res.status(500).json({
            success: false,
            message: 'خطأ في تحميل المسودة',
            error: error.message
        });
    }
}

async function sendQuoteEmail(data, res) {
    try {
        if (!data.quote_id && !data.quote) {
            throw new Error('Quote data is required');
        }

        const quote = data.quote || await loadQuoteFromStorage(data.quote_id);
        
        if (!quote) {
            throw new Error('Quote not found');
        }

        // إنشاء محتوى البريد الإلكتروني
        const emailContent = generateQuoteEmailContent(quote);
        
        // إرسال البريد الإلكتروني
        const emailResult = await sendEmail({
            to: quote.customer.email,
            subject: `عرض سعر رقم ${quote.quote_number} من QuickITQuote`,
            html: emailContent.html,
            text: emailContent.text,
            attachments: data.include_pdf ? [await generateQuotePDFBuffer(quote)] : []
        });

        return res.status(200).json({
            success: true,
            message: 'تم إرسال العرض بالبريد الإلكتروني',
            email_result: emailResult
        });

    } catch (error) {
        console.error('Email send error:', error);
        return res.status(500).json({
            success: false,
            message: 'خطأ في إرسال البريد الإلكتروني',
            error: error.message
        });
    }
}

async function createQuotePDF(data, res) {
    try {
        if (!data.quote_id && !data.quote) {
            throw new Error('Quote data is required');
        }

        const quote = data.quote || await loadQuoteFromStorage(data.quote_id);
        
        if (!quote) {
            throw new Error('Quote not found');
        }

        // إنشاء PDF
        const pdfBuffer = await generateQuotePDFBuffer(quote);
        
        // إعداد headers للاستجابة
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="quote_${quote.quote_number}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        return res.end(pdfBuffer);

    } catch (error) {
        console.error('PDF creation error:', error);
        return res.status(500).json({
            success: false,
            message: 'خطأ في إنشاء PDF',
            error: error.message
        });
    }
}

// وظائف مساعدة
function generateQuoteNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    
    return `QIQ${year}${month}${day}${random}`;
}

function getValidUntilDate(validityDays) {
    const date = new Date();
    date.setDate(date.getDate() + validityDays);
    return date.toISOString();
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('ar-EG', {
        style: 'currency',
        currency: 'EGP'
    }).format(amount);
}

function calculateFormProgress(formData) {
    const requiredFields = ['customer_name', 'customer_email', 'customer_phone', 'products'];
    const optionalFields = ['company_name', 'delivery_address', 'delivery_date', 'special_requirements'];
    
    let completedRequired = 0;
    let completedOptional = 0;
    
    requiredFields.forEach(field => {
        if (formData[field] && formData[field].toString().trim()) {
            completedRequired++;
        }
    });
    
    optionalFields.forEach(field => {
        if (formData[field] && formData[field].toString().trim()) {
            completedOptional++;
        }
    });
    
    const requiredProgress = (completedRequired / requiredFields.length) * 80; // 80% للحقول المطلوبة
    const optionalProgress = (completedOptional / optionalFields.length) * 20; // 20% للحقول الاختيارية
    
    return Math.round(requiredProgress + optionalProgress);
}

// وظائف التخزين والتكامل (سيتم تطويرها حسب البنية التحتية)
async function saveQuoteToStorage(quote) {
    // يمكن حفظها في قاعدة بيانات أو ملف JSON محلياً
    console.log('Saving quote:', quote.quote_number);
    return true;
}

async function loadQuoteFromStorage(quoteId) {
    // تحميل من قاعدة البيانات أو التخزين المحلي
    console.log('Loading quote:', quoteId);
    return null;
}

async function saveDraftToStorage(draft) {
    // حفظ المسودة
    console.log('Saving draft:', draft.id);
    return true;
}

async function loadDraftFromStorage(draftId) {
    // تحميل المسودة
    console.log('Loading draft:', draftId);
    return null;
}

async function sendQuoteToHelloLeads(quote, apiKey) {
    const leadData = {
        email: quote.customer.email,
        first_name: quote.customer.name.split(' ')[0],
        last_name: quote.customer.name.split(' ').slice(1).join(' '),
        company: quote.customer.company,
        phone: quote.customer.phone,
        quote_number: quote.quote_number,
        quote_value: quote.financial.total,
        products_count: quote.products.length,
        quote_stage: 'generated'
    };

    const response = await fetch('https://api.helloleads.io/v2/contacts', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(leadData)
    });

    if (!response.ok) {
        throw new Error('HelloLeads integration failed');
    }

    return await response.json();
}

function generateQuoteEmailContent(quote) {
    const html = `
        <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right;">
            <h2>عرض سعر رقم ${quote.quote_number}</h2>
            <p>عزيزي/عزيزتي ${quote.customer.name}،</p>
            <p>نتشرف بتقديم عرض السعر التالي:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr style="background: #f5f5f5;">
                    <th style="border: 1px solid #ddd; padding: 8px;">المنتج</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">الكمية</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">السعر</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">الإجمالي</th>
                </tr>
                ${quote.products.map(product => `
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 8px;">${product.name}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${product.quantity}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${product.formatted_price}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${product.formatted_total}</td>
                    </tr>
                `).join('')}
            </table>
            
            <div style="margin: 20px 0; padding: 15px; background: #f9f9f9;">
                <p><strong>الإجمالي الفرعي:</strong> ${quote.formatted.subtotal}</p>
                <p><strong>الضرائب:</strong> ${quote.formatted.tax_amount}</p>
                <p><strong>الخصم:</strong> ${quote.formatted.discount_amount}</p>
                <h3><strong>المجموع الكلي:</strong> ${quote.formatted.total}</h3>
            </div>
            
            <p>شكراً لاختياركم QuickITQuote</p>
        </div>
    `;

    const text = `
        عرض سعر رقم ${quote.quote_number}
        
        عزيزي/عزيزتي ${quote.customer.name}،
        
        المجموع الكلي: ${quote.formatted.total}
        
        شكراً لاختياركم QuickITQuote
    `;

    return { html, text };
}

async function sendEmail(emailData) {
    // تكامل مع خدمة البريد الإلكتروني (SendGrid, Mailgun, etc.)
    console.log('Sending email to:', emailData.to);
    return { success: true, message_id: `email_${Date.now()}` };
}

async function generateQuotePDFBuffer(quote) {
    // إنشاء PDF buffer
    // يمكن استخدام مكتبة مثل puppeteer أو jsPDF
    console.log('Generating PDF for quote:', quote.quote_number);
    return Buffer.from('PDF content placeholder');
}