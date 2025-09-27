# QuickITQuote - HelloLeads Integration

## نظرة عامة

تم تطوير تكامل شامل بين نظام QuickITQuote و HelloLeads API لتتبع العملاء المحتملين وإدارة بيانات الزوار بشكل متقدم.

## الميزات الجديدة

### 🔍 تتبع الزوار المتقدم

- **معرف الجلسة الفريد**: يتم إنشاء معرف فريد لكل زائر
- **تتبع مصدر الزيارة**: UTM parameters و referrer tracking
- **تحليل سلوك الزائر**: وقت البقاء، عدد الصفحات، scroll depth
- **معلومات الجهاز**: Browser، OS، Device type، Screen resolution
- **الموقع الجغرافي**: IP address tracking

### 📊 ربط الكوتيشن بـ HelloLeads

- **إرسال تلقائي**: كل كوتيشن يتم إرسالها تلقائياً إلى HelloLeads
- **بيانات شاملة**: تتضمن تفاصيل العميل، المشروع، والمنتجات
- **معلومات تجارية**: إجمالي السعر، العملة، عدد المنتجات
- **سياق الزيارة**: مصدر الزائر، مدة الجلسة، نوع الجهاز

## التكوين المطلوب

### متغيرات البيئة في Vercel

يجب إعداد المتغيرات التالية في إعدادات Vercel:

```bash
# HelloLeads API Configuration
HELLOLEADS_API_KEY=your_helloleads_api_key_here
HELLOLEADS_LIST_KEY=your_helloleads_list_key_here
HELLOLEADS_ENDPOINT=https://app.helloleads.io/index.php/api/leads/add

# Alternative environment variable names (for compatibility)
HELLO_LEADS_API_KEY_TOKEN=your_key
Heallo_Leads_QuickITQuote_List_Key=your_list_key
```

### التحقق من الاتصال

يمكنك التحقق من حالة الاتصال عبر:
- صفحة `/health` - تعرض حالة جميع الخدمات المتصلة
- Console logs في المتصفح عند إرسال الكوتيشن

## كيف يعمل النظام

### 1. تتبع الزائر

```javascript
// يتم تهيئة المتتبع تلقائياً عند تحميل الصفحة
const tracker = new QiqVisitorTracker();

// تتبع الأحداث المهمة
tracker.trackEvent('quote_started');
tracker.trackEvent('product_added');
tracker.trackEvent('quote_submitted');
```

### 2. إرسال الكوتيشن

عند إرسال أي كوتيشن، يتم:

1. **جمع بيانات الزائر**:
   ```javascript
   const visitorData = {
     sessionId: "qiq_1234567890_abc123",
     browser: "chrome",
     os: "windows",
     device: "desktop",
     utm: { utm_source: "google", utm_medium: "cpc" }
   }
   ```

2. **إرسال إلى HelloLeads**:
   ```javascript
   const leadData = {
     client: clientInfo,
     project: projectInfo,
     items: quotationItems,
     visitor: visitorData,
     quotation: {
       id: "Q-2025-ABC123",
       total: 15750.00,
       currency: "SAR"
     }
   }
   ```

3. **تسجيل النتيجة**:
   - ✅ نجح الإرسال: يظهر في console
   - ⚠️ فشل الإرسال: يسجل التفاصيل للمراجعة
   - ℹ️ غير مُفعّل: يتم تجاهل الإرسال

## البيانات المرسلة إلى HelloLeads

### معلومات العميل
- اسم الشركة/العميل
- الشخص المسؤول
- البريد الإلكتروني
- رقم الهاتف

### معلومات المشروع
- اسم المشروع
- الموقع
- دور مقدم الطلب
- تاريخ التنفيذ المتوقع

### معلومات الكوتيشن
- رقم الكوتيشن
- تاريخ الإنشاء
- العملة المستخدمة
- الإجمالي الكلي
- عدد المنتجات
- نوع العملية (download/send/custom)

### معلومات الزائر
- عنوان IP
- نوع المتصفح ونظام التشغيل
- نوع الجهاز (mobile/tablet/desktop)
- مصدر الزيارة (UTM parameters)
- مدة الجلسة
- عدد الصفحات المشاهدة

## مراقبة الأداء

### Console Logs
```bash
✅ HelloLeads: Lead created successfully
⚠️ HelloLeads: Failed to create lead { reason: "invalid_email" }
ℹ️ HelloLeads: Not configured, skipping lead creation
```

### Response Data
```javascript
{
  "ok": true,
  "pdfBase64": "...",
  "csvBase64": "...",
  "email": {
    "admin": { "ok": true, "provider": "resend" },
    "client": { "ok": true, "provider": "resend" }
  },
  "helloleads": {
    "ok": true,
    "provider": "HelloLeads",
    "status": 200,
    "response": "Lead created successfully"
  }
}
```

## استكشاف الأخطاء

### المشاكل الشائعة

1. **HelloLeads غير مُفعّل**
   - تأكد من وجود `HELLOLEADS_API_KEY` و `HELLOLEADS_LIST_KEY`
   - تحقق من صحة المفاتيح في لوحة HelloLeads

2. **فشل إرسال البيانات**
   - تأكد من صحة endpoint URL
   - تحقق من permissions في HelloLeads
   - راجع network logs في المتصفح

3. **بيانات الزائر غير كاملة**
   - تأكد من تحميل `visitor-tracker.js`
   - تحقق من عدم حجب JavaScript بواسطة ad blockers

### تفعيل Debugging

في environment variables:
```bash
DEBUG=true
LOG_HELLOLEADS=true
```

## الخطوات التالية

### تحسينات مقترحة

1. **تحليل البيانات**
   - إنشاء dashboard لمراقبة conversion rates
   - تحليل أداء مصادر الزيارة المختلفة

2. **تخصيص المزيد**
   - إضافة custom fields حسب احتياجات العمل
   - ربط مع Google Analytics و Facebook Pixel

3. **أتمتة المتابعة**
   - إرسال follow-up emails تلقائياً
   - تسجيل نشاط العملاء في CRM

## الدعم

للمساعدة في التكامل أو حل المشاكل، يرجى التواصل مع فريق التطوير مع تضمين:

- Console logs من المتصفح
- Network requests في developer tools
- تفاصيل المشكلة والخطوات المؤدية إليها

---

**ملاحظة**: هذا التكامل يحترم privacy المستخدمين ويتوافق مع GDPR ولوائح حماية البيانات.