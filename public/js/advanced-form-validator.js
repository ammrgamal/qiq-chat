/**
 * Advanced Form Validator & Field Manager
 * نظام التحقق من النماذج المتقدم ومدير الحقول
 */

class AdvancedFormValidator {
    constructor() {
        this.forms = new Map();
        this.validationRules = new Map();
        this.customMessages = new Map();
        this.init();
    }

    // تهيئة النظام
    init() {
        this.setupDefaultRules();
        this.setupDefaultMessages();
        this.attachFormListeners();
        this.enhanceFormFields();
        console.log('📝 Advanced Form Validator initialized');
    }

    // قواعد التحقق الافتراضية
    setupDefaultRules() {
        this.validationRules.set('required', (value) => {
            return value !== null && value !== undefined && value.toString().trim() !== '';
        });

        this.validationRules.set('email', (value) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return !value || emailRegex.test(value);
        });

        this.validationRules.set('phone', (value) => {
            const phoneRegex = /^[\+]?[0-9]{10,15}$/;
            return !value || phoneRegex.test(value.replace(/\s/g, ''));
        });

        this.validationRules.set('minLength', (value, minLength) => {
            return !value || value.length >= parseInt(minLength);
        });

        this.validationRules.set('maxLength', (value, maxLength) => {
            return !value || value.length <= parseInt(maxLength);
        });

        this.validationRules.set('number', (value) => {
            return !value || !isNaN(parseFloat(value));
        });

        this.validationRules.set('positiveNumber', (value) => {
            return !value || (this.validationRules.get('number')(value) && parseFloat(value) > 0);
        });

        this.validationRules.set('url', (value) => {
            try {
                return !value || new URL(value);
            } catch {
                return false;
            }
        });

        this.validationRules.set('date', (value) => {
            return !value || !isNaN(Date.parse(value));
        });

        this.validationRules.set('futureDate', (value) => {
            if (!value) return true;
            const inputDate = new Date(value);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return inputDate >= today;
        });

        this.validationRules.set('match', (value, matchFieldId) => {
            const matchField = document.getElementById(matchFieldId);
            return !value || !matchField || value === matchField.value;
        });
    }

    // الرسائل الافتراضية
    setupDefaultMessages() {
        this.customMessages.set('required', 'هذا الحقل مطلوب');
        this.customMessages.set('email', 'يرجى إدخال بريد إلكتروني صحيح');
        this.customMessages.set('phone', 'يرجى إدخال رقم هاتف صحيح');
        this.customMessages.set('minLength', 'يجب أن يكون النص على الأقل {0} أحرف');
        this.customMessages.set('maxLength', 'يجب أن لا يزيد النص عن {0} أحرف');
        this.customMessages.set('number', 'يرجى إدخال رقم صحيح');
        this.customMessages.set('positiveNumber', 'يرجى إدخال رقم موجب');
        this.customMessages.set('url', 'يرجى إدخال رابط صحيح');
        this.customMessages.set('date', 'يرجى إدخال تاريخ صحيح');
        this.customMessages.set('futureDate', 'يجب أن يكون التاريخ في المستقبل');
        this.customMessages.set('match', 'القيمتان غير متطابقتان');
    }

    // ربط مستمعي الأحداث بالنماذج
    attachFormListeners() {
        document.addEventListener('submit', (e) => {
            if (e.target.tagName === 'FORM') {
                this.handleFormSubmit(e);
            }
        });

        // مراقبة التغييرات المباشرة
        document.addEventListener('input', (e) => {
            if (e.target.hasAttribute('data-validate')) {
                this.validateField(e.target);
            }
        });

        document.addEventListener('blur', (e) => {
            if (e.target.hasAttribute('data-validate')) {
                this.validateField(e.target);
            }
        });
    }

    // معالجة إرسال النموذج
    handleFormSubmit(event) {
        const form = event.target;
        const isValid = this.validateForm(form);
        
        if (!isValid) {
            event.preventDefault();
            event.stopPropagation();
            
            // التركيز على أول حقل خاطئ
            const firstError = form.querySelector('.field-error');
            if (firstError) {
                const errorField = firstError.closest('.form-group')?.querySelector('input, select, textarea');
                if (errorField) {
                    errorField.focus();
                    errorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
            
            // عرض رسالة خطأ عامة
            this.showFormMessage(form, 'يرجى تصحيح الأخطاء قبل المتابعة', 'error');
            return false;
        }

        // إضافة loading state
        this.setFormLoading(form, true);
        
        return true;
    }

    // التحقق من النموذج كاملاً
    validateForm(form) {
        let isValid = true;
        const fields = form.querySelectorAll('[data-validate]');
        
        // مسح الأخطاء السابقة
        this.clearFormErrors(form);
        
        fields.forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });
        
        return isValid;
    }

    // التحقق من حقل واحد
    validateField(field) {
        const rules = field.getAttribute('data-validate').split('|');
        const value = field.value;
        let isValid = true;
        let errorMessage = '';
        
        for (const rule of rules) {
            const [ruleName, ruleParam] = rule.split(':');
            const validationFunction = this.validationRules.get(ruleName.trim());
            
            if (validationFunction) {
                const ruleResult = validationFunction(value, ruleParam?.trim());
                
                if (!ruleResult) {
                    isValid = false;
                    errorMessage = this.getErrorMessage(ruleName.trim(), ruleParam?.trim());
                    break;
                }
            } else {
                console.warn(`Unknown validation rule: ${ruleName}`);
            }
        }
        
        // عرض/إخفاء رسالة الخطأ
        this.showFieldError(field, isValid ? null : errorMessage);
        
        return isValid;
    }

    // الحصول على رسالة الخطأ
    getErrorMessage(ruleName, ruleParam) {
        let message = this.customMessages.get(ruleName) || `خطأ في التحقق من ${ruleName}`;
        
        if (ruleParam && message.includes('{0}')) {
            message = message.replace('{0}', ruleParam);
        }
        
        return message;
    }

    // عرض خطأ الحقل
    showFieldError(field, errorMessage) {
        const formGroup = field.closest('.form-group') || field.parentNode;
        let errorElement = formGroup.querySelector('.field-error');
        
        if (errorMessage) {
            // إضافة كلاس الخطأ
            field.classList.add('error');
            formGroup.classList.add('has-error');
            
            // إنشاء أو تحديث عنصر الخطأ
            if (!errorElement) {
                errorElement = document.createElement('div');
                errorElement.className = 'field-error';
                errorElement.style.cssText = 'color: #dc2626; font-size: 12px; margin-top: 4px; display: block;';
                formGroup.appendChild(errorElement);
            }
            
            errorElement.textContent = errorMessage;
            errorElement.style.display = 'block';
        } else {
            // إزالة الخطأ
            field.classList.remove('error');
            formGroup.classList.remove('has-error');
            
            if (errorElement) {
                errorElement.style.display = 'none';
            }
        }
    }

    // مسح أخطاء النموذج
    clearFormErrors(form) {
        const errorElements = form.querySelectorAll('.field-error');
        const errorFields = form.querySelectorAll('.error');
        const errorGroups = form.querySelectorAll('.has-error');
        
        errorElements.forEach(el => el.style.display = 'none');
        errorFields.forEach(field => field.classList.remove('error'));
        errorGroups.forEach(group => group.classList.remove('has-error'));
    }

    // عرض رسالة النموذج العامة
    showFormMessage(form, message, type = 'info') {
        let messageElement = form.querySelector('.form-message');
        
        if (!messageElement) {
            messageElement = document.createElement('div');
            messageElement.className = 'form-message';
            form.insertBefore(messageElement, form.firstChild);
        }
        
        messageElement.className = `form-message ${type}`;
        messageElement.style.cssText = `
            padding: 12px 16px;
            margin-bottom: 16px;
            border-radius: 6px;
            font-size: 14px;
            ${type === 'error' ? 'background: #fef2f2; color: #dc2626; border: 1px solid #fecaca;' : ''}
            ${type === 'success' ? 'background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0;' : ''}
            ${type === 'info' ? 'background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe;' : ''}
        `;
        messageElement.textContent = message;
        
        // إخفاء الرسالة تلقائياً بعد 5 ثوانٍ
        setTimeout(() => {
            if (messageElement) {
                messageElement.style.display = 'none';
            }
        }, 5000);
    }

    // تعيين حالة التحميل
    setFormLoading(form, loading) {
        const submitButton = form.querySelector('[type="submit"]');
        const inputs = form.querySelectorAll('input, select, textarea');
        
        if (loading) {
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.dataset.originalText = submitButton.textContent;
                submitButton.innerHTML = '⏳ جاري الإرسال...';
            }
            
            inputs.forEach(input => input.disabled = true);
            form.classList.add('form-loading');
        } else {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = submitButton.dataset.originalText || 'إرسال';
            }
            
            inputs.forEach(input => input.disabled = false);
            form.classList.remove('form-loading');
        }
    }

    // تحسين حقول النموذج
    enhanceFormFields() {
        this.addPlaceholderAnimation();
        this.setupAutoComplete();
        this.setupFieldFormatting();
        this.setupConditionalFields();
    }

    // إضافة تحريك للـ placeholders
    addPlaceholderAnimation() {
        document.querySelectorAll('.form-group input, .form-group textarea').forEach(field => {
            const label = field.previousElementSibling;
            
            if (label && label.tagName === 'LABEL') {
                // إضافة أنماط CSS للتحريك
                if (!document.getElementById('form-animation-styles')) {
                    const style = document.createElement('style');
                    style.id = 'form-animation-styles';
                    style.innerHTML = `
                        .form-group {
                            position: relative;
                            margin-bottom: 20px;
                        }
                        
                        .form-group label.floating {
                            position: absolute;
                            top: 12px;
                            right: 12px;
                            color: #9ca3af;
                            pointer-events: none;
                            transition: all 0.2s ease;
                            background: white;
                            padding: 0 4px;
                        }
                        
                        .form-group input:focus + label.floating,
                        .form-group input:not(:placeholder-shown) + label.floating,
                        .form-group.has-value label.floating {
                            top: -8px;
                            right: 8px;
                            font-size: 12px;
                            color: #3b82f6;
                        }
                        
                        .form-group input {
                            padding: 12px;
                            border: 2px solid #e5e7eb;
                            border-radius: 6px;
                            transition: border-color 0.2s ease;
                            width: 100%;
                        }
                        
                        .form-group input:focus {
                            outline: none;
                            border-color: #3b82f6;
                        }
                        
                        .form-group input.error {
                            border-color: #dc2626;
                        }
                    `;
                    document.head.appendChild(style);
                }
                
                // تحويل الـ label لنمط floating
                label.classList.add('floating');
                
                // مراقبة التغييرات
                field.addEventListener('input', () => {
                    if (field.value.trim()) {
                        field.closest('.form-group').classList.add('has-value');
                    } else {
                        field.closest('.form-group').classList.remove('has-value');
                    }
                });
            }
        });
    }

    // إعداد الإكمال التلقائي
    setupAutoComplete() {
        // إضافة autocomplete للحقول الشائعة
        document.querySelectorAll('input[type="email"]').forEach(input => {
            input.setAttribute('autocomplete', 'email');
        });

        document.querySelectorAll('input[type="tel"]').forEach(input => {
            input.setAttribute('autocomplete', 'tel');
        });

        document.querySelectorAll('input[name*="name"]').forEach(input => {
            input.setAttribute('autocomplete', 'name');
        });
    }

    // إعداد تنسيق الحقول
    setupFieldFormatting() {
        // تنسيق أرقام الهاتف
        document.querySelectorAll('input[type="tel"]').forEach(input => {
            input.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length > 0) {
                    // تنسيق الرقم: 1234-567-890
                    value = value.replace(/(\d{4})(\d{3})(\d{3})/, '$1-$2-$3');
                }
                e.target.value = value;
            });
        });

        // تنسيق الأرقام
        document.querySelectorAll('input[data-format="number"]').forEach(input => {
            input.addEventListener('input', (e) => {
                let value = e.target.value.replace(/[^\d.-]/g, '');
                e.target.value = value;
            });
        });
    }

    // إعداد الحقول الشرطية
    setupConditionalFields() {
        document.querySelectorAll('[data-show-if]').forEach(conditionalField => {
            const condition = conditionalField.getAttribute('data-show-if');
            const [fieldId, expectedValue] = condition.split('=');
            
            const triggerField = document.getElementById(fieldId);
            if (triggerField) {
                const checkCondition = () => {
                    const show = triggerField.value === expectedValue;
                    conditionalField.style.display = show ? 'block' : 'none';
                    
                    // تعطيل التحقق للحقول المخفية
                    const inputs = conditionalField.querySelectorAll('input, select, textarea');
                    inputs.forEach(input => {
                        if (show) {
                            input.removeAttribute('disabled');
                        } else {
                            input.setAttribute('disabled', 'true');
                            input.value = '';
                            this.showFieldError(input, null);
                        }
                    });
                };
                
                triggerField.addEventListener('change', checkCondition);
                checkCondition(); // تحقق أولي
            }
        });
    }

    // إضافة قاعدة تحقق مخصصة
    addValidationRule(name, validator, message) {
        this.validationRules.set(name, validator);
        this.customMessages.set(name, message);
    }

    // التحقق من نموذج محدد برمجياً
    validateFormById(formId) {
        const form = document.getElementById(formId);
        return form ? this.validateForm(form) : false;
    }

    // إعادة تعيين النموذج
    resetForm(formId) {
        const form = document.getElementById(formId);
        if (form) {
            form.reset();
            this.clearFormErrors(form);
            this.setFormLoading(form, false);
            
            // إزالة حالة has-value
            form.querySelectorAll('.form-group.has-value').forEach(group => {
                group.classList.remove('has-value');
            });
        }
    }
}

// تصدير للاستخدام العام
window.AdvancedFormValidator = AdvancedFormValidator;

// تهيئة تلقائية
document.addEventListener('DOMContentLoaded', function() {
    window.formValidator = new AdvancedFormValidator();
});