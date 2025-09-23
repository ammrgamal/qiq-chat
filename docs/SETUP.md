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
