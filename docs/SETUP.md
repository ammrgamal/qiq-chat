# QuickITQuote Local Setup Notes

This repo has integrations that depend on local assets (Arabic fonts) and environment variables. Use this as a short checklist.

## 1) Arabic PDF Fonts (client + server)
Place the following TTFs under one of these folders so Arabic text renders properly in PDFs:
- `public/fonts/` (preferred, used by client and server)
- `api/assets/fonts/` (server-only fallback)

Recommended fonts:
- `NotoNaskhArabic-Regular.ttf`
- `NotoNaskhArabic-Bold.ttf`
- `NotoKufiArabic-Regular.ttf`
- `NotoKufiArabic-Bold.ttf`

Server PDF generator (pdfkit) will auto-detect fonts from the folders above. Client-side (if used) also loads from `public/fonts/`.

If you don’t have them, download from Google Fonts (Noto Naskh Arabic, Noto Kufi Arabic) and drop the `.ttf` files as-is. The loader `public/js/pdf-arabic-fonts.js` (client) and the server will pick them up automatically.

### Arabic text shaping (pdfkit)
Server PDFs now apply a lightweight Arabic reshaping and a visual bidi adjustment to improve Arabic rendering in pdfkit.

Steps:
1. Install deps (in `qiq-chat/`):

```powershell
npm install
```

2. Make sure at least one Arabic TTF is present under `public/fonts/` or `api/assets/fonts/` (see list above).

Notes:
- We use `arabic-persian-reshaper` dynamically; if not installed, the server falls back gracefully (English unaffected; Arabic may render without shaping).
- For very complex Arabic/bidi layouts, we can upgrade to a fuller bidi pipeline later.

## 2) Environment Variables
Set these locally (e.g., `.env` or your deployment environment) to enable full functionality:

- Email (Resend)
  - `RESEND_API_KEY`
  - `EMAIL_FROM` (e.g., `no-reply@yourdomain.com`)

- AI Providers
  - `OPENAI_API_KEY`
  - `GEMINI_API_KEY` or `GOOGLE_API_KEY` (any alias your code supports)
  - `AUTO_APPROVE` = `true|false` (controls remote media/URL allow for AI; can be overridden in Admin)

- HelloLeads CRM
  - `HELLOLEADS_API_KEY` (aliases supported: `HELLO_LEADS_API_KEY`, `Heallo_Leads_API_Key_Token`)
  - `HELLOLEADS_LIST_KEY` (aliases: `HELLO_LEADS_LIST_KEY`, `Heallo_Leads_QuickITQuote_List_Key`)

Check `/health` to see detected capability flags reflected in the UI chips.

### Admin / Security Seeding
- `AUTO_ADMIN_EMAILS` : قائمة إيميلات (مفصولة بفواصل أو مسافات) يتم ترقيتها تلقائياً إلى مشرفين (idempotent). مثال:

  ```
  AUTO_ADMIN_EMAILS="founder@company.com ops@company.com"
  ```

  عند تشغيل الخادم، سيتم إنشاء المستخدم (إن لم يكن موجوداً) أو تحديثه بالحقول:
  - `role: admin`
  - `verified: true`
  - `systemSeeded: true`

- `DEV_AUTO_ADMIN` : إذا كانت = `1` أو `true` في وضع التطوير، أي طلب يحتوي الهيدر `x-dev-admin: 1` يحصل تلقائياً على جلسة `admin-session` (لا تستخدمه في الإنتاج).

ملاحظات أمان:
1. لا تضع `AUTO_ADMIN_EMAILS` في بيئة عامة بدون مراجعة.
2. احذف أو عطّل `DEV_AUTO_ADMIN` قبل النشر.
3. استخدم لاحقاً JWT حقيقي بدل التوكن البسيط الحالي.

### 2.1) local.secrets.json (مفضل للتجارب المحلية)
لدعم مفاتيح محلية لا نريد رفعها للمستودع أو كشفها في الواجهة، أضف ملف `local.secrets.json` (موجود في `.gitignore`).

مثال (انظر أيضاً `local.secrets.example.json`):

```json
{
  "RESEND_API_KEY": "re_xxx",
  "OPENAI_API_KEY": "sk-xxxx",
  "GEMINI_API_KEY": "AIza-xxxx",
  "HELLOLEADS_API_KEY": "Heallo_Leads_API_Key_Token...",
  "HELLOLEADS_LIST_KEY": "Heallo_Leads_QuickITQuote_List_Key...",
  "ALGOLIA_APP_ID": "R4ZBQNB1VE",
  "ALGOLIA_ADMIN_API_KEY": "xxxxxxxx",
  "ALGOLIA_INDEX": "woocommerce_products",
  "SQL_SERVER": "localhost",
  "SQL_DATABASE": "QuickITQuote",
  "SQL_USER": "sa",
  "SQL_PASSWORD": "YourStrong!Passw0rd",
  "SQL_ENCRYPT": "false"
}
```

آلية التحميل:
1. يتم الآن التحميل بطريقة ديناميكية (dynamic import) في وقت التشغيل فقط، بدون `import` ثابت، لتقليل أي احتمال تجميع أو نشر غير مقصود.
2. إذا كان المتغير `DISABLE_LOCAL_SECRETS=1` فلن يتم التحميل.
3. لا يكتب فوق أي متغير موجود مسبقاً في `process.env` (الأولوية للمتغيرات الحالية).
4. آمن لأنه لا يُرسل للمتصفح (لا توجد استجابة API تعرض القيم السرية)، فقط يستخدم في الجانب الخادمي.

لماذا ليس فقط `.env`؟
- يمكنك الاحتفاظ بـ `.env` لمتغيرات عادية، و `local.secrets.json` للأشياء الحساسة التي لا تريد نسخها بين بيئات أو رفعها.
- التنسيق JSON أسهل للنسخ من أدوات أخرى أو مشاركة مقتطف (بدون رفعه للـ Git).

نصيحة: لا تضع القيم الإنتاجية هنا. ضع فقط مفاتيح تجارب / مفاتيح حساب مطور.

إيقاف التحميل محلياً (اختياري):
```powershell
set DISABLE_LOCAL_SECRETS=1
node server.js
```
أو على PowerShell مؤقتاً داخل نفس الجلسة قبل التشغيل.

فحص تواجد المفاتيح بدون كشفها:
```powershell
node scripts/check-secrets.mjs
```
يعرض فقط (OK / MISSING) لكل مفتاح مهم.

## 3) Common Local Tasks
- Smoke run: uses `scripts/smoke.ps1`
- Test endpoints without shell quoting issues:
  - `node scripts/test-pdf-ai.mjs`
  - `node scripts/test-hello-leads.mjs`

If port conflicts occur on 3037, stop the existing process and re-run. On Windows PowerShell:

```powershell
$port=3037
Get-NetTCPConnection -LocalPort $port -State Listen | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }
```

Then run the smoke task again from VS Code Tasks.

## 4) Admin Overrides
From Admin → الإعدادات الذكية:
- Toggle Auto Approve and manage Allowed Domains for AI URL/media fetching.
- Connectivity card shows OpenAI/Gemini/Resend/HelloLeads readiness, plus email from address.

## 5) Notes
- The catalog and quote pages are bilingual AR/EN and support dark mode.
- The products list and quote pages show a small connectivity banner sourced from `/health`.
- Advanced product enrichment pipeline documented in `docs/ENRICHMENT.md` (stages, new fields, quality scoring).

## 6) Offline Mode & Key Validation

### --offline Flag
تشغيل الأوركستريتور بـ:

```powershell
node rules-engine/scripts/orchestrate.mjs --samples --count=5 --offline
```

يؤدي إلى:
- تفعيل `OFFLINE_MODE=1`
- تفعيل `SKIP_DB=1` (لا اتصال بقاعدة البيانات)
- تخطي مزامنة Algolia تلقائياً (يعادل `--no-sync`)
- إجبار التصنيف و الإثراء على استخدام fallback rule-based (لا استدعاءات لشبكات OpenAI أو Gemini)

مفيد عند:
1. عدم توفر الإنترنت.
2. تجارب سريعة على منطق التصنيف المحلي بدون انتظار الشبكة.
3. رغبة في تجنب استهلاك الحصص (quota) لمفاتيح المزودين.

### التحقق من شكل المفاتيح (Key Format Validation)
الخدمة تتحقق الآن من بنية المفاتيح:
- OpenAI: يجب أن يبدأ بـ `sk-` وطول كافٍ.
- Gemini: يجب أن يبدأ بـ `AIza`.

إذا كان الشكل غير صحيح يتم تجاهل المزود مبكراً لتقليل أخطاء 401/403.

### Circuit Breaker مبسط
في حال تكررت أخطاء المصادقة (401/403 أو رسائل invalid key) لنفس المزود 3 مرات متتالية:
- يتم تعطيله مؤقتاً لمدة 5 دقائق.
- أثناء التعطيل يتم تخطي المحاولات والانتقال للمزود التالي أو fallback.

يمكن تعديل العتبات لاحقاً (threshold / cooldown) عند الحاجة.
