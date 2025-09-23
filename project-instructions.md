# QuickITQuote — Project Instructions

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
