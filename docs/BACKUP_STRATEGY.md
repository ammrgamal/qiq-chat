# Backup Strategy

## Objectives
- Protect SQL Server data before enrichment or bulk sync.
- Enable point-in-time style rolling retention (count + age).
- Provide lightweight local dev fallback using SQLite snapshots.

## Current Script
`scripts/backup-db.mjs` performs:
- COPY_ONLY database backup (MSSQL) with timestamped filename.
- CHECKSUM option (integrity) when supported.
- Rotation by count via BACKUP_KEEP_COUNT.

## Proposed Enhancements
| Feature | Env Var | Description |
|---------|---------|-------------|
| Gzip compression | BACKUP_COMPRESS=1 | Compress .bak → .bak.gz after write if file > threshold (e.g. 5MB) |
| Retention days | BACKUP_RETENTION_DAYS=7 | Remove backups older than N days (in addition to count) |
| Webhook notify | BACKUP_WEBHOOK_URL | POST JSON summary { file, size, durationMs, status } |
| SQLite snapshot | BACKUP_SQLITE_SNAPSHOT=1 | Copy `rules-engine/.enrich.db` to backups with same timestamp |
| Dry run | BACKUP_DRY_RUN=1 | Show actions only |

## Scheduling (Production)
- Use SQL Agent or external scheduler (GitHub Action / cron) daily at low load window.
- Run before raising `ENRICH_VERSION` or large re-index.

## Failure Handling
- Non-zero exit code on backup failure.
- Webhook includes error message.
- Optional retry once if transient network / IO.

## Verification
- Weekly: random restore test to staging (manual or automated). Document result.

## Security
- Ensure BACKUP_DIR not publicly exposed.
- Apply OS-level ACL to restrict read access.

## Next Steps
1. Implement env parsing for new flags in script.
2. Add compression + age retention code path.
3. Extend `SECRETS_REFERENCE.md` with new variables.
4. Optional: Prometheus metric push (future).

---
*Keep this document updated when backup workflow changes.*
