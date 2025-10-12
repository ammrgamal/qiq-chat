# Enrichment SQL / Hybrid Layer

هذه الوثيقة توضح آلية **الطبقة الهجينة** بين SQL Server و SQLite لعمليات Enrichment.

## الأهداف
- تشغيل محلي سريع بدون إعداد خادم.
- Idempotency (تخطي العناصر المعالجة سابقاً) عبر hash + version.
- تسجيل أداء كل عنصر.
- دعم إعادة المعالجة عند رفع الإصدار `ENRICH_VERSION`.

## الجداول (SQLite)
```
items(id, partNumber, manufacturer, raw_json, enriched_json, ai_version, enrich_hash, updated_at)
enrich_logs(id, item_id, status, ai_version, duration_ms, created_at, error)
```

## المتغيرات البيئية
| متغير | وظيفة | قيمة افتراضية |
|-------|-------|---------------|
| ENRICH_SQLITE_PATH | مسار ملف قاعدة بيانات SQLite | rules-engine/.enrich.db |
| ENRICH_VERSION | وسم الإصدار الحالي | v1.0.0 |
| ENRICH_BATCH_SIZE | حجم الدفعة | 50 |
| ENRICH_MAX_CONCURRENCY | أقصى عدد مهام متوازية | 3 |
| ENRICH_DRY_RUN | تشغيل بدون كتابة | 0 |
| ENRICH_WEBHOOK_URL | يستقبل ملخص الدفعة POST | (فارغ) |
| ENRICH_STORAGE_MODE | فرض sqlite أو mssql | (تلقائي) |

## التدفق المبسط
1. تحميل عناصر (حاليًا عينات – لاحقًا من SQL Server).
2. حساب hash للمدخل (partNumber + name + manufacturer + desc).
3. إذا وُجد نفس hash + نفس الإصدار → skip.
4. تشغيل المراحل (stage1..4) وتسجيل زمن كل مرحلة.
5. حفظ الناتج + سجل حدث.

### طبقة التخزين الموحّدة (storageAdapter)
- تختار تلقائياً SQLite (إن وُجدت الحزمة) أو MSSQL (إذا فُرضت أو لم تتوفر SQLite).
- دوال رئيسية: `getByHash`, `saveItem`, `log`.
- تم تنفيذ دعم MSSQL: إنشاء جدولين تلقائياً `EnrichedItems` و `EnrichLogs` عند الحاجة.
- الحقول في MSSQL:
  - EnrichedItems(ItemID, PartNumber, Manufacturer, RawJson, EnrichedJson, AIVersion, EnrichHash, UpdatedAt)
  - EnrichLogs(LogID, ItemID, Status, AIVersion, DurationMs, CreatedAt, Error)

### التوازي (Concurrency Pool)
- تنفيذ مهام متوازية حسب `ENRICH_MAX_CONCURRENCY`.
- يحافظ على طباعة نتائج كل عنصر بخط مستقل.

### استهداف عناصر محددة
- `--items=PN1,PN2` لمعالجة عناصر فقط.
- يحترم BATCH بعد التصفية.

### إعادة معالجة مرحلة محددة (Partial Stage Re-Enrichment)
- مفعّلة الآن عبر `--stage=stage2` أو قائمة مثل: `--stage=stage2,stage3`.
- تعيد فقط المراحل المطلوبة وتدمجها في الناتج السابق دون فقد بقية الحقول.

### Webhook
- إذا تم ضبط `ENRICH_WEBHOOK_URL` يرسل الملخص + النتائج بعد انتهاء الدُفعة.
- فشل الويب هوك لا يوقف العملية.

### جودة (Quality Score)
- يتم حساب `quality_score` (0-100) وفق: عدد الميزات، طول value_statement، وجود compliance_tags، عدم وجود errors.


## شكل الناتج (enrichmentPipeline.enrich)
```jsonc
{
  "enriched": true,
  "version": "v1.1.0",
  "hash": "ab12cd34",
  "features": ["Network traffic management"],
  "value_statement": "High quality solution.",
  "compliance_tags": ["Security"],
  "risk_score": 40,
  "warnings": ["no_features_extracted"],
  "errors": [],
  "timings": {"stage1": 12, "stage2": 205},
  "durationMs": 230
}
```

## تشغيل سكربت الدُفعات
```
node rules-engine/scripts/run-enrichment.mjs --items=SW-24,SRV-1U
node rules-engine/scripts/run-enrichment.mjs --help
```
مع تعيين المتغيرات حسب الحاجة قبل التشغيل.

## ملاحظات مستقبلية
- تحسين معادلة quality_score لتشمل: use_cases diversity, FAQ richness, timing efficiency.
- استرجاع ملخص MSSQL متقدم (إحصاءات زمن متوسط لكل مرحلة).
- دعم Webhook تقدّم (progress streaming) أثناء التنفيذ.
- دعم إعادة معالجة حسب تغيير AIVersion السابق فقط.
