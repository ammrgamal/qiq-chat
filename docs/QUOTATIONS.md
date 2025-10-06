## Quotation Lifecycle & History

This document describes the quotation features: creation, listing, editing, cloning, and revision history.

### Statuses
Current lightweight statuses (Arabic + English synonyms accepted by update rules):
- مسودة / draft: Editable
- قيد المراجعة: Editable (pending review)
- مكتمل / مغلق: Not editable

### Storage
Quotations are stored in a simple JSON file-based storage (`api/storage/quotations.js`). Each quotation includes:
- id (e.g., QT-2024-001)
- projectId (same as id for now)
- projectName
- status
- currency, total, clientName
- payload (raw client submitted structure)
- revision (increments on payload-changing updates)
- history[] (array of prior revisions: up to last 20)

### History Model
When a quotation is updated and its payload changes, the previous snapshot is pushed into `history` with fields:
```
{ ts, payload, status, total, revision }
```
Most recent prior state is at index 0. History trimmed to max 20 entries to bound file growth.

### Endpoints
User endpoints (require Authorization: Bearer qiq_<token>):
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/users/quotations | List user quotations (plus demo mocks) |
| POST | /api/users/quotations | Create new quotation (auto id sequence per year) |
| GET | /api/users/quotation/:id | Fetch single quotation with history |
| PATCH | /api/users/quotation/:id | Update editable quotation (draft / قيد المراجعة) -> creates revision if payload changed |
| POST | /api/users/quotation/:id/clone | Clone existing quotation to a new draft (sequence id) |

### Cloning
Clone generates a new id using same yearly sequential scheme (QT-YYYY-XXX). History is reset, revision=1. Optional overrides can be supplied in request body to adjust cloned payload fields.

### Editing Rules
- Only statuses مسودة (draft) or قيد المراجعة are editable.
- Attempt to PATCH a non-editable quotation returns NOT_EDITABLE.
- Payload diffs trigger history snapshot + revision increment.

### Business Email Validation
Registration and (optionally) quotation update (when changing client email) enforce business domain rules unless `AUTO_APPROVE=1`.
Blocked personal domains (subset): gmail.com, hotmail.com, yahoo.com, outlook.com, protonmail.com, icloud.com, etc.
Environment overrides:
- ALLOW_EMAIL_DOMAINS: comma/space separated allow-list (bypasses block)
- BLOCK_EMAIL_DOMAINS: additional custom blocked domains

Utility located at `api/_lib/email-validation.js` with exported `validateBusinessEmail`.

### Activity Logging
Actions logged to `activityStorage`:
- quotation_save
- quotations_view
- quotation_update
- quotation_clone

### Future Enhancements (Next Steps)
- Add soft-delete & restore
- Add server-side filtering/sorting/pagination
- Introduce status transitions with audit trail
- Add signature / acceptance workflow
- Migrate storage to durable DB (KV, PostgreSQL)
