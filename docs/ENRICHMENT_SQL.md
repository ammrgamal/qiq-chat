# Enrichment SQL / Hybrid Layer

هذه الوثيقة توضّح طبقة التخزين والتنفيذ الهجينة بين SQL Server و SQLite بعد الانتقال إلى نموذج `sections.*` الهيكلي.

## الأهداف
- تشغيل محلي سريع (SQLite) + إمكانية التوسّع (MSSQL).
- Idempotency عبر (hash + ENRICH_VERSION).
- تسجيل أداء كل عنصر وزمن المراحل.
- دعم إعادة المعالجة الجزئية (Partial Stage Re-Enrichment).

## الجداول (SQLite)
```
items(id, partNumber, manufacturer, raw_json, enriched_json, ai_version, enrich_hash, updated_at)
enrich_logs(id, item_id, status, ai_version, duration_ms, created_at, error)
```

## المتغيرات البيئية
| متغير | وظيفة | قيمة افتراضية |
|-------|-------|---------------|
| ENRICH_SQLITE_PATH | مسار ملف SQLite | rules-engine/.enrich.db |
| ENRICH_VERSION | إصدار الإنريتش الحالي | v1.0.0 |
| ENRICH_BATCH_SIZE | حجم الدُفعة | 50 |
| ENRICH_MAX_CONCURRENCY | حد التوازي | 3 |
| ENRICH_DRY_RUN | تشغيل دون حفظ | 0 |
| ENRICH_WEBHOOK_URL | Webhook ملخص | (فارغ) |
| ENRICH_STORAGE_MODE | فرض sqlite/mssql | (تلقائي) |

## التدفق المبسّط
1. تحميل العناصر (أو seed fallback عند فشل الجدول المصدر).
2. حساب hash = checksum(name+part+manufacturer+desc).
3. البحث عن hash + الإصدار؛ إذا موجود → skip.
4. تنفيذ المراحل (1..4) مع تجميع timings.
5. حفظ enriched_json (يحوي الجذر + sections) و تسجيل log.

### طبقة التخزين الموحّدة (storageAdapter)
- اختيار تلقائي: SQLite أولاً، وإلا MSSQL إذا تم تهيئته أو فُرض.
- دوال: `getByHash`, `saveItem`, `log`.
- MSSQL ينشئ: `EnrichedItems`, `EnrichLogs` عند الحاجة.
  - EnrichedItems(ItemID, PartNumber, Manufacturer, RawJson, EnrichedJson, AIVersion, EnrichHash, UpdatedAt)
  - EnrichLogs(LogID, ItemID, Status, AIVersion, DurationMs, CreatedAt, Error)

### التوازي (Concurrency Pool)
- احترام `ENRICH_MAX_CONCURRENCY`.
- طباعة سطر حالة لكل عنصر (part, status, ms).

### استهداف عناصر محددة
- `--items=PN1,PN2` بعدد محدود.
- يطبّق مرشح BATCH بعد التصفية.

### إعادة معالجة مرحلة محددة
- `--stage=stage2` أو `--stage=stage2,stage3` لتحديث أقسام محددة ودمج الناتج مع السابق.
- يبقى hash نفسه ما لم تتغير مدخلات الهوية.

### Webhook
- إرسال ملخص JSON بعد انتهاء الدُفعة (إذا تم ضبط المتغير).
- فشل الطلب لا يوقف التنفيذ.

### Quality Score
- حالي: حساب بسيط (عدد features، وجود value_statement، compliance_tags، عدم errors) — سيتم تحسينه.

## شكل الناتج (enrichmentPipeline.enrich) — نموذج Sections
```jsonc
{
  "enriched": true,
  "version": "v1.0.0",
  "hash": "18e11f1c",
  "sections": {
    "identity": { "features": ["Fiber patch panel"], "keywords": ["fiber"], "short_description": "CommScope fiber patch panel 24-port" },
    "specs": { "manufacturer": "CommScope", "baseName": "CommScope Fiber Patch Panel 24 Port" },
    "marketing": { "value_statement": "Reliable structured cabling component.", "short_benefit_bullets": ["High-density"], "use_cases": ["General"] },
    "compliance": { "compliance_tags": ["Datacenter"], "risk_score": 40 },
    "embeddings": { "embedding_ref": null }
  },
  "quality_score": 72,
  "warnings": [],
  "errors": [],
  "timings": { "stage1": 2, "stage2": 0, "stage3": 0 },
  "durationMs": 6
}
```

ملاحظات:
- الحقول الجذرية (enriched, version, hash, timings...) تبقى مسطّحة ليسهل الفرز.
- أي مرحلة جديدة تضاف تحت `sections.<stageName>`.

## تشغيل سكربت الدُفعات
```
node rules-engine/scripts/run-enrichment.mjs --items=SW-24,SRV-1U
node rules-engine/scripts/run-enrichment.mjs --help
```
أو سكربت العلامة التجارية: `node rules-engine/scripts/run-enrichment-db.mjs --brand=CommScope` (يعتمد على وجود الجدول المصدر وإلا يستخدم seed).

## ملاحظات مستقبلية
- تحسين معادلة quality_score (diversity, length weighting, penalties).
- إحصاءات تجميع MSSQL (AVG timings لكل مرحلة).
- Webhook تدرجي (progress streaming).
- إعادة معالجة مشروطة بتغيّر `ai_version` فقط.

---
تم التحديث ليتوافق مع نموذج الأقسام (أكتوبر 2025).
