# Bible Arena Production Runbook

## Release readiness

- The repository uses npm (`packageManager: npm@10.9.2`) with `package-lock.json`; run `npm ci` from a clean checkout before an EAS build.
- Set production `COOKIE_SECRET`, `EXPO_PUBLIC_APP_ID`, `ALLOWED_ORIGINS`, OAuth values, and `EXPO_PUBLIC_WEB_ORIGIN` in the deployment secret/configuration store.
- Verify `npm run release:check` and a clean EAS Android/iOS build before release.
- SQLite connections enable WAL, a 5-second busy timeout, and foreign keys. Include the SQLite `-wal`/`-shm` behavior in backup and restore drills.

## Health and logs

Use `GET /api/health` for liveness plus database connectivity and `GET /api/ready` for readiness. Both responses are non-cacheable and return HTTP 503 when SQLite cannot be opened. Application request and lifecycle events are emitted as JSON with timestamps, service name, status, path, and duration so a platform log collector can index them.

Set `OPS_METRICS_TOKEN` in the deployment secret store to enable the protected `GET /api/ops/metrics` endpoint. Query it with `Authorization: Bearer <token>`; without the token the endpoint returns 404. The response contains bounded in-process counters and request p50/p95/p99 latency samples. Export or scrape it periodically; it is not a replacement for durable monitoring. Alert initially on HTTP 5xx rate above 2% for 5 minutes, p95 latency above 750ms for 5 minutes, database health failures, or realtime rejection/disconnect spikes.

## Backups

Run `npm run db:backup` from the application host. The command creates a consistent SQLite snapshot with `VACUUM INTO`, stores it under `BACKUP_DIR`, and retains the newest `BACKUP_RETENTION` snapshots. Production operators should schedule this command outside the application process, copy snapshots to encrypted durable storage, and periodically test restoration with `npm run db:restore-smoke` plus `npm run db:migrate` against a copy. The target recovery objective is **RPO ≤ 15 minutes** when backups run every 15 minutes and **RTO ≤ 30 minutes** for restoring the latest verified snapshot and restarting one instance. Record the last successful backup, restore-drill result, and WAL/shm handling in deployment operations.

The restore drill checks SQLite integrity, required tables, and a persisted user row. It uses `VACUUM INTO`, which produces a transactionally consistent snapshot while the source database is in WAL mode; never copy only the main `.sqlite` file with `cp` while the service is live.

## Realtime deployment boundary

The current realtime adapter is intentionally local to the modular monolith. It has bounded payloads, heartbeat cleanup, authenticated room subscriptions, and a configurable per-IP connection cap. `REALTIME_BACKPLANE=local` is explicit. Before running multiple API instances, replace the local room subscriber map with a Redis or managed pub/sub adapter and route WebSocket upgrades consistently; do not assume the in-memory map synchronizes between instances.

Do not scale horizontally based on guesses. First collect at least seven days of request, lock, backup, and realtime metrics. Evaluate a shared backplane only if sustained p95 latency exceeds 750ms, SQLite lock failures exceed 1% of writes, or one instance exceeds its tested CPU/memory/concurrency envelope.

## Web delivery

Set `EXPO_PUBLIC_WEB_ORIGIN` to the real HTTPS origin at build time. The web document emits a title, description, Open Graph metadata, Twitter card, canonical URL, and sitemap link. `public/robots.txt`, `public/sitemap.xml`, and the Expo Router not-found route are included in the static web output. Verify the generated HTML and absolute sitemap URL after deployment because the repository intentionally does not invent a production hostname.
