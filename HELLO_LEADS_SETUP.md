# دليل تفعيل التكامل مع Hello Leads CRM

## نظرة عامة
يتضمن هذا المشروع تكاملاً كاملاً مع Hello Leads CRM لإرسال جميع طلبات الأسعار تلقائياً إلى نظام إدارة العلاقات مع العملاء.

## الحالة الحالية للتكامل
✅ **مكتمل**: API endpoint للتكامل مع Hello Leads  
✅ **مكتمل**: Frontend integration في صفحة الاقتباس  
✅ **مكتمل**: سكريپت الاختبار  
⚠️ **يحتاج إعداد**: مفاتيح API من Hello Leads  

## ملفات التكامل الموجودة:

### 1. `/api/hello-leads.js`
- API endpoint لإرسال البيانات إلى Hello Leads
- يدعم متعدد أشكال لمتغيرات البيئة
- معالجة أخطاء شاملة

### 2. `/public/js/quote.js` 
- التكامل Frontend - يرسل كل طلب إلى Hello Leads قبل حفظه محلياً
- يعمل في الخلفية (non-blocking)
- خطوط 612-616 و 667-671

### 3. `/scripts/test-hello-leads.mjs`
- سكريپت اختبار للتكامل
- يختبر endpoint بدون مشاكل PowerShell quoting

## خطوات التفعيل:

### الخطوة 1: الحصول على مفاتيح Hello Leads API

1. اذهب إلى حسابك في Hello Leads على vercel.com
2. احصل على:
   - `API Key` 
   - `List Key`
   - `Endpoint URL` (اختياري - يستخدم الافتراضي)

### الخطوة 2: إعداد متغيرات البيئة

أضف المفاتيح التالية إلى ملف `.env`:

```bash
# Hello Leads CRM Configuration
HELLO_LEADS_API_KEY=your_actual_api_key_here
HELLO_LEADS_LIST_KEY=your_actual_list_key_here
HELLO_LEADS_ENDPOINT=https://app.helloleads.io/index.php/api/leads/add
```

**أشكال مدعومة أخرى للمتغيرات:**
```bash
# Alternative formats supported:
HELLOLEADS_API_KEY=your_key
HELLOLEADS_LIST_KEY=your_key
Heallo_Leads_API_Key_Token=your_key
Heallo_Leads_QuickITQuote_List_Key=your_key
```

### الخطوة 3: اختبار التكامل

```powershell
# تشغيل السيرفر
npm start

# في terminal آخر - اختبار Hello Leads
node scripts/test-hello-leads.mjs 3039

# أو استخدام سكريپت PowerShell المخصص
.\scripts\test-hello-leads-integration.ps1 -ApiKey "your_key" -ListKey "your_list_key"
```

### الخطوة 4: التحقق من الاتصال

```powershell
# فحص حالة الاتصالات
Invoke-RestMethod -Uri "http://localhost:3039/health" -Method GET
```

يجب أن ترى `hasHelloLeads: true` في الاستجابة.

## كيف يعمل التكامل:

### عند إرسال طلب اقتباس:
1. **Frontend** يجمع بيانات النموذج
2. **يرسل إلى Hello Leads أولاً** (في الخلفية)
3. **ثم يحفظ محلياً** في قاعدة البيانات
4. **يرسل إيميل** للعميل والإدارة

### البيانات المُرسلة إلى Hello Leads:
- **معلومات العميل**: الاسم، الإيميل، الهاتف، الشركة
- **تفاصيل المشروع**: اسم المشروع، دور طالب الخدمة، تاريخ الإغلاق المتوقع
- **قائمة المنتجات**: أول 20 عنصر من طلب الاقتباس
- **رقم الاقتباس وتاريخه**

## استكشاف الأخطاء:

### خطأ: "HELLOLEADS keys missing"
- تأكد من وجود المفاتيح في `.env`
- أعد تشغيل السيرفر بعد إضافة المفاتيح

### خطأ: "Failed to reach HelloLeads"
- تحقق من صحة endpoint URL
- تحقق من الاتصال بالإنترنت
- تحقق من صحة المفاتيح

### خطأ: Status 502
- المفاتيح غير صحيحة
- مشكلة في Hello Leads API
- تحقق من logs السيرفر

## الملفات المُحدَّثة:

- ✅ `api/hello-leads.js` - API endpoint
- ✅ `public/js/quote.js` - Frontend integration  
- ✅ `server.js` - Server routing
- ✅ `scripts/test-hello-leads.mjs` - Test script
- 🆕 `.env` - Environment variables template
- 🆕 `scripts/test-hello-leads-integration.ps1` - PowerShell test script
- 🆕 `scripts/test-hello-leads-simple.js` - Simple test
- 🆕 `HELLO_LEADS_SETUP.md` - This guide

## الخطوات التالية:

1. **احصل على مفاتيح Hello Leads API الفعلية**
2. **أضفها إلى `.env`**
3. **اختبر التكامل**
4. **فعّل في الإنتاج**

---

## ملاحظة هامة:
التكامل **مُفعّل تلقائياً** في الكود ويعمل في الخلفية. ما تحتاجه فقط هو إضافة مفاتيح API الصحيحة!