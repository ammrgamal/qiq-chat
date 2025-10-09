# Secrets / Environment Variables Reference

IMPORTANT: لا تضع القيم الفعلية للمفاتيح داخل المستودع. استخدم هذا الملف كمرجع أسماء فقط.

| Variable | Purpose | Notes / Rotation |
|----------|---------|------------------|
| ALGOLIA_APP_ID | Algolia App Identifier | Rotate yearly or if leaked |
| ALGOLIA_ADMIN_API_KEY | Full admin (write/settings) – استخدم فقط في CI الآمن | Prefer limiting scope; rotate ASAP if exposed |
| ALGOLIA_API_KEY / ALGOLIA_SEARCH_KEY | Search-only key للواجهة | Minimum scope (search) |
| ALGOLIA_INDEX | Primary products index name | e.g. `woocommerce_products` |
| ALGOLIA_USAGE_API_KEY | Usage metrics API access | Optional; read analytics |
| ALGOLIA_MONITORING_API_KEY | Monitoring endpoints (health) | Optional |
| ENRICH_VERSION | Pipeline output semantic version | Increment on structural change |
| ENRICH_STORAGE_MODE | Force `sqlite` أو `mssql` | Default auto-detect |
| ENRICH_SQLITE_PATH | Local SQLite path | Default `rules-engine/.enrich.db` |
| ENRICH_BATCH_SIZE | Batch size for enrichment scripts | 50 default |
| ENRICH_MAX_CONCURRENCY | Parallel enrichment workers | 3 default |
| ENRICH_DRY_RUN | Skip persistence if `1` | Safe test mode |
| SQL_SERVER | MSSQL server (HOST or HOST\\INSTANCE) | Required for MSSQL mode |
| SQL_DB | MSSQL database name | Required |
| SQL_USER | SQL auth user | Secure storage (Azure Key Vault etc.) |
| SQL_PASSWORD | SQL auth password | Mark for rotation policy |
| BACKUP_DIR | Folder to write DB backups | Ensure write permissions |
| BACKUP_KEEP_COUNT | How many backup files to retain | e.g. 7 |
| BACKUP_COMPRESS | If set (1/true) compress .bak to .gz | Reduces storage cost |
| BACKUP_RETENTION_DAYS | Delete backups older than N days (if KEEP_COUNT not set) | One of keep-count OR retention-days |
| BACKUP_WEBHOOK_URL | POST JSON after successful backup | For monitoring/chatops |
| BACKUP_DRY_RUN | Skip actual DB backup for pipeline testing | Do not use in prod |
| AI_OPENAI_API_KEY | (Future) AI generation key | Optional offline mode supported |
| AI_TRANSLATE_PROVIDER | Which translation provider (openai/none) | Default none |
| ALGOLIA_INDEX_NAME | Legacy alt variable (mapped) | Prefer ALGOLIA_INDEX |
| ENRICHMENT_AWAIT | If `1` pipeline awaited during sync | Adds latency but deterministic |
| ARABIC_QUERY_EXPANSION | If `1` enable synonym expansion optionalWords | Requires arabicNLP module |

## Rotation Guidelines
- Admin / Write keys: rotate كل 90 يوم أو فور الشك في تسريب.
- Read/Search keys: يمكن تمديد الدورة (180 يوم) لكن أنشئ مفاتيح فرعية لكل بيئة.
- سجل أي تدوير في سجل داخلي (DEVOPS_SECRETS_LOG.md) خارج المستودع العام.

## Storage Recommendations
- Local dev: `.env` (never commit) + `.env.example` placeholders.
- Production: Injector (Kubernetes Secrets / Azure Key Vault / AWS Secrets Manager).
- CI: Use pipeline-level secret store; inject only minimal required keys.

## Leakage Response
1. إلغاء المفتاح فوراً في لوحة Algolia / DB.
2. تدوير القيمة وإعادة نشر الخدمات.
3. تحليل سجلات الاستخدام لمعرفة أي نشاط غير معتاد.
4. توثيق الحادث داخلياً.

---
*هذا الملف لا يحتوي أي قيم فعلية – فقط أسماء وشرح.*
