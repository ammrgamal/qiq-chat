# Project Index — qiq-chat
Generated: 2025-09-23T08:28:46.439Z

- Root: C:\GitHub\qiq-chat\qiq-chat
- Total size: 859.5 KB
- Files: 88
- Directories: 16
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
- api/quote.js
- api/search-health.js
- api/search.js
- api/special-quote.js

## Tree (truncated)

```
qiq-chat/
├── __tests__/
│   └── algoliaMapper.spec.ts (525 B)
├── .storage/
│   ├── activity.json (9.5 KB)
│   └── quotations.json (672 B)
├── api/
│   ├── _lib/
│   │   ├── email.js (3.2 KB)
│   │   └── jwt.js (1.5 KB)
│   ├── admin/
│   │   ├── activity.js (335 B)
│   │   ├── admin.js (8.2 KB)
│   │   ├── config.js (3.1 KB)
│   │   ├── delete-quotation.js (346 B)
│   │   ├── delete-user.js (336 B)
│   │   ├── login.js (236 B)
│   │   ├── quotation-details.js (791 B)
│   │   ├── quotation-notes.js (1.3 KB)
│   │   ├── quotation-resend.js (2.0 KB)
│   │   ├── quotations.js (339 B)
│   │   ├── stats.js (347 B)
│   │   └── users.js (329 B)
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
│   ├── chat.js (8.6 KB)
│   ├── compare.js (2.8 KB)
│   ├── hello-leads.js (3.0 KB)
│   ├── maintenance.js (3.9 KB)
│   ├── pdf-ai.js (10.2 KB)
│   ├── quote.js (741 B)
│   ├── search-health.js (1.2 KB)
│   ├── search.js (2.7 KB)
│   └── special-quote.js (797 B)
├── docs/
│   ├── algolia_index_reference.md (2.7 KB)
│   ├── COPILOT_INSTRUCTIONS.md (3.7 KB)
│   └── SETUP.md (2.2 KB)
├── public/
│   ├── css/
│   │   └── styles.css (14.2 KB)
│   ├── fonts/
│   │   └── README.txt (361 B)
│   ├── js/
│   │   ├── account.js (23.0 KB)
│   │   ├── admin-quotes.js (11.4 KB)
│   │   ├── admin.js (24.7 KB)
│   │   ├── analytics.js (19.2 KB)
│   │   ├── api.js (1.8 KB)
│   │   ├── experimental-banner.js (2.3 KB)
│   │   ├── modal.js (6.3 KB)
│   │   ├── pdf-admin.js (10.8 KB)
│   │   ├── pdf-arabic-fonts.js (1.8 KB)
│   │   ├── performance.js (5.6 KB)
│   │   ├── products-search-enhanced.js (22.1 KB)
│   │   ├── products-search.js (6.7 KB)
│   │   ├── quote-actions.js (36.0 KB)
│   │   ├── quote-form.js (3.0 KB)
│   │   ├── quote.js (64.7 KB)
│   │   ├── security.js (7.6 KB)
│   │   ├── toast.js (4.4 KB)
│   │   ├── ui-chat.js (14.0 KB)
│   │   ├── ui-enhancements.js (25.1 KB)
│   │   └── user-features.js (11.8 KB)
│   ├── account.html (2.2 KB)
│   ├── admin-quotes.html (4.2 KB)
│   ├── admin.html (12.3 KB)
│   ├── index.html (8.1 KB)
│   ├── logo.png (15.7 KB)
│   ├── products-list.html (20.3 KB)
│   └── quote.html (21.6 KB)
├── scripts/
│   ├── generate-index.mjs (5.3 KB)
│   ├── smoke.ps1 (1.8 KB)
│   ├── test-hello-leads.mjs (1.1 KB)
│   └── test-pdf-ai.mjs (1.2 KB)
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
├── package-lock.json (282.7 KB)
├── package.json (854 B)
├── PROJECT_INDEX.md (15.2 KB)
├── project-instructions.md (4.1 KB)
├── quote.html (12.8 KB)
├── server.js (6.4 KB)
└── test-flow.html (6.0 KB)
```

## Setup notes

# QuickITQuote Local Setup Notes

This repo has integrations that depend on local assets (Arabic fonts) and environment variables. Use this as a short checklist.

## 1) Arabic PDF Fonts (pdfmake)
Place the following TTFs under `public/fonts/` so Arabic text renders/shapes correctly in PDFs:
- `NotoNaskhArabic-Regular.ttf`
- `NotoKufiArabic-Regular.ttf`

If you don’t have them, download from Google Fonts (Noto Naskh Arabic, Noto Kufi Arabic) and drop the `.ttf` files as-is. The loader `public/js/pdf-arabic-fonts.js` will pick them up automatically.

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


## Project instructions

# QuickITQuote — Project Instructions-For Chat GPT refernace

## 1. Project Title
QuickITQuote – AI-assisted Quoting & Product Catalog (Arabic/English)

## 2. Goal of the Project
Deliver a bilingual (AR/EN) quoting and catalog system that enables: secure backend-only search, presales chat, AI-assisted comparison and PDF generation, and an admin suite for users/quotes/activity/config, with professional, branded multi-page PDF export.

## 3. Main Features
- Product catalog with fast filters and multiple layouts (grid/list/table/lines)
- Compare products with AI summary and Attach-to-Quote action
- Quote builder with thumbnails, currency, terms, and totals
- AI-assisted PDF content (/api/pdf-ai) with Arabic font shaping support
- CRM integration (HelloLeads) on request/submit
- Email via Resend + Admin resend option
- Admin dashboard: users, quotations, activity, smart config (AI & approval overrides)
- Security: helmet, CORS, rate limiting; unified BOQ ingest/validation
- Connectivity transparency via /health (OpenAI, Gemini, Resend, HelloLeads, AUTO_APPROVE)

## 4. Technologies Used
- Backend: Node.js (ESM) + Express, helmet, CORS, express-rate-limit, dotenv
- Frontend: Vanilla JS, pdfmake, SheetJS (XLSX), custom Toast/Modal
- AI Providers: OpenAI (text), Gemini (media/links) with admin AUTO_APPROVE & allowlist
- Email: Resend (default)
- CRM: HelloLeads
- Tests: Jest + ts-jest for search mapping

## 5. Directory Structure (top-level)
```
qiq-chat/
  api/            # Express route handlers (users/admin/pdf-ai/...) 
  public/         # Static assets (html/css/js)
  docs/           # Setup + Copilot instructions
  scripts/        # Utility scripts (generate index, tests)
  __tests__/      # Unit tests (search)
  server.js       # Express app entry
  package.json    # Scripts & dependencies
  PROJECT_INDEX.md
```

## 6. Important Files
- `server.js`: Express server, route registry, /health
- `api/pdf-ai.js`: AI-assisted headings/letter/bullets with provider specializations
- `api/hello-leads.js`: HelloLeads lead creation
- `api/admin/config.js`: Admin config (AUTO_APPROVE override, allowedDomains)
- `public/js/pdf-arabic-fonts.js`: Loads Noto Arabic fonts for pdfmake
- `public/quote.html` + `public/js/quote.js`: Quote UI and logic
- `public/products-list.html`: Catalog with comparison modal; Copy/Attach + sanitize Unknown
- `docs/SETUP.md`: Fonts + environment setup
- `docs/COPILOT_INSTRUCTIONS.md`: Copilot tasks/instructions
- `scripts/generate-index.mjs`: Generates `PROJECT_INDEX.md`

## 7. API Endpoints (selected)
- `GET /health` — environment capability flags (OpenAI/Gemini/Resend/HelloLeads, autoApprove)
- `POST /api/pdf-ai` — AI content for PDF (headings/letter/bullets)
- `POST /api/hello-leads` — send lead to HelloLeads
- `POST /api/users/register|login|verify|...` — user flows
- `GET /api/admin/quotations` — admin list; other admin routes for details/notes/resend

## 8. How to Run the Project
- Prereqs: Node >= 18
- Install dependencies: `npm install`
- Local dev server: `npm start` (or VS Code task: qiq-chat smoke)
- Optional tests: `npm test`
- Generate index: `npm run index`
- Place Arabic fonts in `public/fonts/`: `NotoNaskhArabic-Regular.ttf`, `NotoKufiArabic-Regular.ttf`
- Set environment variables (see docs/SETUP.md)

## 9. Pending Tasks / To-Do List
- Provide TTFs under `public/fonts/`
- Configure environment keys for Resend, OpenAI/Gemini, HelloLeads (local + deploy)
- PDF polish toward QuoteWerks layout (Open Sans/Roboto; product images in BOQ)
- Improve product comparison prompts and Unknown filtering upstream

## 10. Changelog (Optional)
- 2025-09-23: Added persistent modal notice, Copy/Attach actions, sanitization on products modal
- 2025-09-23: Added generator `scripts/generate-index.mjs` and Husky hook to auto-update index

## 11. Contributors
- Ammr Gamal (Owner)
- Copilot Assistant

## 12. Notes
- Admin can force AUTO_APPROVE and set allowed domains for AI media fetching.
- The products list and quote pages render a small connectivity banner from `/health`.
- `PROJECT_INDEX.md` is auto-generated; run `npm run index` to refresh.


