# Project Index — qiq-chat
Generated: 2025-09-25T14:53:16.572Z

- Root: C:\GitHub\qiq-chat\qiq-chat
- Total size: 1006.9 KB
- Files: 93
- Directories: 19
- Max depth: 6
- Excluded dirs: node_modules, .git, .next, dist, build, out, .vercel, .cache, coverage, .vscode, .idea, tmp, temp, .turbo, .husky, logs

This file is auto-generated. Share it with ChatGPT for context.

## API overview (by files)

- _lib/
  - api/_lib/email.js
  - api/_lib/jwt.js
- admin/
  - api/admin/activity.js
  - api/admin/admin.js
  - api/admin/config.js
  - api/admin/delete-quotation.js
  - api/admin/delete-user.js
  - api/admin/login.js
  - api/admin/quotation-details.js
  - api/admin/quotation-notes.js
  - api/admin/quotation-resend.js
  - api/admin/quotations.js
  - api/admin/stats.js
  - api/admin/users.js
- assets/
  - fonts/
- storage/
  - api/storage/quotations.js
- users/
  - api/users/login.js
  - api/users/logout.js
  - api/users/me.js
  - api/users/quotations.js
  - api/users/register.js
  - api/users/send-verification.js
  - api/users/verify.js
- api/agent.js
- api/boq-parse.js
- api/chat.js
- api/compare.js
- api/hello-leads.js
- api/maintenance.js
- api/pdf-ai.js
- api/quote-email.js
- api/quote.js
- api/search-health.js
- api/search.js
- api/special-quote.js

## Tree (truncated)

```
qiq-chat/
├── __tests__/
│   ├── algoliaMapper.spec.ts (525 B)
│   └── pdfTotals.spec.ts (1.3 KB)
├── .storage/
│   ├── activity.json (18.2 KB)
│   └── quotations.json (672 B)
├── ai/
│   └── ai-instructions.txt (3.5 KB)
├── api/
│   ├── _lib/
│   │   ├── email.js (5.4 KB)
│   │   └── jwt.js (1.5 KB)
│   ├── admin/
│   │   ├── activity.js (335 B)
│   │   ├── admin.js (8.2 KB)
│   │   ├── config.js (3.9 KB)
│   │   ├── delete-quotation.js (346 B)
│   │   ├── delete-user.js (336 B)
│   │   ├── login.js (236 B)
│   │   ├── quotation-details.js (791 B)
│   │   ├── quotation-notes.js (1.3 KB)
│   │   ├── quotation-resend.js (2.0 KB)
│   │   ├── quotations.js (339 B)
│   │   ├── stats.js (347 B)
│   │   └── users.js (329 B)
│   ├── assets/
│   │   └── fonts/
│   ├── storage/
│   │   └── quotations.js (4.9 KB)
│   ├── users/
│   │   ├── login.js (1.8 KB)
│   │   ├── logout.js (300 B)
│   │   ├── me.js (1.4 KB)
│   │   ├── quotations.js (6.3 KB)
│   │   ├── register.js (3.6 KB)
│   │   ├── send-verification.js (1.2 KB)
│   │   └── verify.js (1.6 KB)
│   ├── agent.js (1.5 KB)
│   ├── boq-parse.js (4.5 KB)
│   ├── chat.js (9.3 KB)
│   ├── compare.js (2.8 KB)
│   ├── hello-leads.js (3.0 KB)
│   ├── maintenance.js (3.9 KB)
│   ├── pdf-ai.js (14.4 KB)
│   ├── quote-email.js (46.6 KB)
│   ├── quote.js (741 B)
│   ├── search-health.js (1.2 KB)
│   ├── search.js (2.7 KB)
│   └── special-quote.js (4.0 KB)
├── docs/
│   ├── algolia_index_reference.md (2.7 KB)
│   ├── COPILOT_INSTRUCTIONS.md (3.7 KB)
│   └── SETUP.md (3.1 KB)
├── public/
│   ├── css/
│   │   └── styles.css (14.3 KB)
│   ├── fonts/
│   │   └── README.txt (361 B)
│   ├── js/
│   │   ├── account.js (22.9 KB)
│   │   ├── admin-quotes.js (11.3 KB)
│   │   ├── admin.js (25.5 KB)
│   │   ├── analytics.js (19.2 KB)
│   │   ├── api.js (1.8 KB)
│   │   ├── experimental-banner.js (2.3 KB)
│   │   ├── modal.js (7.5 KB)
│   │   ├── pdf-admin.js (16.6 KB)
│   │   ├── pdf-arabic-fonts.js (1.8 KB)
│   │   ├── performance.js (5.6 KB)
│   │   ├── products-search-enhanced.js (23.7 KB)
│   │   ├── products-search.js (6.7 KB)
│   │   ├── quote-actions.js (41.7 KB)
│   │   ├── quote-form.js (3.0 KB)
│   │   ├── quote-wizard.js (16.6 KB)
│   │   ├── quote.js (75.2 KB)
│   │   ├── security.js (7.6 KB)
│   │   ├── toast.js (4.3 KB)
│   │   ├── ui-chat.js (14.3 KB)
│   │   ├── ui-enhancements.js (25.0 KB)
│   │   └── user-features.js (11.8 KB)
│   ├── account.html (2.2 KB)
│   ├── admin-quotes.html (4.2 KB)
│   ├── admin.html (13.4 KB)
│   ├── index.html (9.3 KB)
│   ├── logo.png (15.7 KB)
│   ├── products-list.html (21.5 KB)
│   ├── project-instructions.md (4.1 KB)
│   └── quote.html (21.7 KB)
├── scripts/
│   ├── generate-index.mjs (5.3 KB)
│   ├── smoke.ps1 (1.8 KB)
│   ├── test-hello-leads.mjs (1.1 KB)
│   ├── test-pdf-ai.mjs (1.2 KB)
│   └── test-quote-email.mjs (2.2 KB)
├── src/
│   └── search/
│       ├── algoliaSettings.ts (791 B)
│       ├── applySettings.ts (756 B)
│       └── indexSchema.ts (1.5 KB)
├── .env (76 B)
├── .gitignore (71 B)
├── demo-table.html (5.8 KB)
├── index.html (8.4 KB)
├── index.js (956 B)
├── jest.config.cjs (154 B)
├── package-lock.json (312.3 KB)
├── package.json (922 B)
├── PROJECT_INDEX.md (12.3 KB)
├── quote.html (12.8 KB)
├── server.js (6.5 KB)
└── test-flow.html (6.0 KB)
```

## Setup notes

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


## Copilot instructions / tasks

## GitHub Copilot Instructions – Fix PDF Export for Professional Quote (QuickITQuote)

Goal: Generate a professional PDF quote that mimics the QuoteWerks layout, includes product images, avoids Arabic unless user-provided, and uses proper fonts.

### 1) PDF Font & Unicode Fix
- Replace default fonts with a clean, Unicode-complete font (Roboto/Open Sans/Arial) via pdfmake.
- Example:

```
fonts: {
  Roboto: {
    normal: 'fonts/Roboto-Regular.ttf',
    bold: 'fonts/Roboto-Bold.ttf',
    italics: 'fonts/Roboto-Italic.ttf',
    bolditalics: 'fonts/Roboto-BoldItalic.ttf'
  }
}
```

- Ensure the chosen font supports English, numbers, and provides light Arabic fallback.
- Remove or convert Arabic strings automatically if not client-provided.

### 2) Show Product Images in Quote Table
- Display product thumbnail in BOQ table.
- Source: `product.image` or `product.thumbnail`.
- Add a new column or include image inside Description cell.
- Suggested size: width 60px, height 60px, objectFit: contain.

### 3) Sanitize All Text for Non-Arabic PDF
- Auto-translate any Arabic user input into English (Google Translate API if available) or strip Arabic characters using `/[\u0600-\u06FF]/` detection.
- Rules:
  - If client_name or project_name contains Arabic → keep + translate.
  - If any table row contains Arabic → translate or discard Arabic text from output.

### 4) PDF Layout (Structure & Styling)
Order:
1. Cover Page (Logo, Quote Number/Date, Currency, Client & Project Details)
2. Table of Contents (clean list + page numbers)
3. Cover Letter (English only) with summary prices
4. BOQ Table: Image | Description | PN | Qty | Unit Price | Line Total (alternating row color)
5. Product Details (bullets)
6. Terms & Conditions (payment, delivery, FX/tax remarks)

### 5) Remove Common Errors
- Avoid undefined values; replace missing with '-' or 'Not provided'.
- Remove placeholders (e.g., "Project s").
- Keep ToC clean (no extra dots/corrupted formatting).

### Assets / Design Notes
- Use Roboto or Open Sans fonts.
- Dynamic logo path: `customerBrand.logo` or default.
- If quote has no products → prevent PDF generation with a warning.

---

## Issue: تحسين عرض معلومات المنتج في Modal + إصلاح الأزرار

### 1) إزالة القيم Unknown
- عند بناء الجدول داخل المودال: استثنِ أي صف قيمةُه "Unknown" أو فارغ/null.
```js
const cleanedRows = features.filter(row => row.value && row.value.toLowerCase() !== 'unknown');
```

### 2) إصلاح زر "نسخ" Copy
```js
document.getElementById('copyButton').addEventListener('click', () => {
  const text = document.getElementById('modalContent').innerText;
  navigator.clipboard.writeText(text).then(() => {
    alert('Copied to clipboard!');
  });
});
```

### 3) إصلاح زر "إرفاق في عرض السعر" (Attach to Quote)
```js
document.getElementById('attachToQuote').addEventListener('click', () => {
  const partNumber = currentProduct.partNumber || currentProduct.mpn;
  if (!partNumber) return;
  addToQuote(partNumber, 1); // default qty = 1
  closeModal();
  alert('Item attached to quote!');
});
```

### 4) تنظيف المحتوى قبل التصدير/النسخ/الإرفاق
```js
function sanitizeProductDetails(rawText) {
  return rawText
    .split('\n')
    .filter(line => !line.includes('Unknown') && line.trim() !== '**Cons:**' && line.trim() !== '')
    .join('\n');
}
```

### مطلوب تفعيله
- تنظيف بيانات الجدول من "Unknown".
- تفعيل زر نسخ المحتوى.
- تفعيل زر إرفاق في عرض السعر (يضيف البند مباشرة للـ Quote).
- عرض Toast/Alert لتأكيد الإجراء.


