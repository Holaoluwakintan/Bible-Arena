// Durable storage for the legacy SQLite database (users, friends, rooms, challenges, sessions).
// Render's free plan wipes the local disk on every deploy/restart, so the SQLite file is a working
// copy: it is restored from Postgres (Supabase, schema bible_arena) at boot and snapshotted back
// whenever it changes (every 15 s when dirty, and on SIGTERM). Uploads stay off until a restore check
// has succeeded, so a database outage at boot can never overwrite good data with an empty file.
import fs from "node:fs";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { getDb, resetDbConnection } from "./db";
import { ENV } from "./_core/env";
import { logger } from "./_core/logger";
import { baPool, SCH } from "./v3/pg";

/** Extra async work to finish before the process exits on SIGTERM (e.g. Live quiz rooms). */
export const shutdownHooks: Array<() => Promise<void>> = [];
const INSTANCE = (process.env.RENDER_INSTANCE_ID || process.env.HOSTNAME || "local") + ":" + process.pid;
const KEEP = 40;
let restoreOk = false;
let restoredId = 0;
let baseline = -1;
let lastSha = "";
let uploading = false;

function totalChanges(): number {
  try {
    const row = getDb().prepare("SELECT total_changes() AS n").get() as { n: number };
    return Number(row?.n ?? 0);
  } catch {
    return -1;
  }
}

async function latestRemote(): Promise<{ id: number; data: Buffer; sha256: string } | null> {
  const pool = baPool();
  if (!pool) return null;
  const r = await pool.query(`select id, data, sha256 from ${SCH}.sqlite_snapshots order by id desc limit 1`);
  if (!r.rows.length) return null;
  return { id: Number(r.rows[0].id), data: r.rows[0].data as Buffer, sha256: r.rows[0].sha256 };
}

function writeLocal(gz: Buffer) {
  resetDbConnection();
  const file = ENV.sqlitePath;
  for (const f of [file, file + "-wal", file + "-shm"]) { try { fs.unlinkSync(f); } catch {} }
  fs.writeFileSync(file, zlib.gunzipSync(gz));
}

export async function restoreSnapshot(): Promise<void> {
  if (!baPool()) {
    logger.warn("persist_disabled", { reason: "BA_DATABASE_URL not set" });
    return;
  }
  try {
    const snap = await latestRemote();
    if (snap) {
      writeLocal(snap.data);
      restoredId = snap.id;
      lastSha = snap.sha256;
    }
    restoreOk = true;
    getDb();
    baseline = totalChanges();
    logger.info("persist_restored", { snapshotId: restoredId, bytes: snap ? snap.data.length : 0 });
  } catch (error) {
    restoreOk = false;
    logger.error("persist_restore_failed", { error: error instanceof Error ? error.message : String(error) });
  }
}

export async function snapshotNow(reason: string): Promise<boolean> {
  if (!restoreOk || uploading || !baPool()) return false;
  uploading = true;
  const tmp = `/tmp/ba-snap-${process.pid}.db`;
  try {
    try { fs.unlinkSync(tmp); } catch {}
    getDb().exec(`VACUUM INTO '${tmp}'`);
    const raw = fs.readFileSync(tmp);
    const sha = crypto.createHash("sha256").update(raw).digest("hex");
    if (sha === lastSha) return true;
    const gz = zlib.gzipSync(raw, { level: 9 });
    const pool = baPool()!;
    const r = await pool.query(
      `insert into ${SCH}.sqlite_snapshots(instance, bytes, sha256, data) values ($1,$2,$3,$4) returning id`,
      [INSTANCE, raw.length, sha, gz],
    );
    lastSha = sha;
    restoredId = Math.max(restoredId, Number(r.rows[0].id));
    await pool.query(
      `delete from ${SCH}.sqlite_snapshots where id < (select min(id) from (select id from ${SCH}.sqlite_snapshots order by id desc limit $1) k)`,
      [KEEP],
    ).catch(() => {});
    logger.info("persist_snapshot", { reason, bytes: raw.length, gz: gz.length, id: restoredId });
    return true;
  } catch (error) {
    logger.error("persist_snapshot_failed", { reason, error: error instanceof Error ? error.message : String(error) });
    return false;
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
    uploading = false;
  }
}

export function startPersistence(): void {
  if (!baPool()) return;
  const bootAt = Date.now();
  let lastChanges = totalChanges();
  setInterval(async () => {
    try {
      // A failed boot restore is retried while this instance has written nothing of its own.
      if (!restoreOk) {
        if (totalChanges() === baseline || baseline < 0) await restoreSnapshot();
        return;
      }
      const now = totalChanges();
      // During a zero-downtime deploy the old instance flushes its last writes after this one booted:
      // pick those up while this instance has made no writes of its own.
      if (Date.now() - bootAt < 5 * 60_000 && now === baseline) {
        const pool = baPool()!;
        const r = await pool.query(`select max(id) as id from ${SCH}.sqlite_snapshots`);
        const remoteId = Number(r.rows[0]?.id || 0);
        if (remoteId > restoredId) {
          const snap = await latestRemote();
          if (snap && snap.sha256 !== lastSha) {
            writeLocal(snap.data);
            restoredId = snap.id;
            lastSha = snap.sha256;
            getDb();
            baseline = totalChanges();
            lastChanges = baseline;
            logger.info("persist_repulled", { snapshotId: snap.id });
          } else if (snap) restoredId = snap.id;
        }
        return;
      }
      if (now !== lastChanges) {
        const ok = await snapshotNow("interval");
        if (ok) lastChanges = now;
      }
    } catch (error) {
      logger.warn("persist_tick_failed", { error: error instanceof Error ? error.message : String(error) });
    }
  }, 15_000).unref();

  const onSignal = (signal: string) => {
    logger.info("persist_shutdown", { signal });
    const done = () => process.exit(0);
    const timer = setTimeout(done, 20_000);
    Promise.allSettled([snapshotNow("shutdown:" + signal), ...shutdownHooks.map((h) => h())]).finally(() => { clearTimeout(timer); done(); });
  };
  process.once("SIGTERM", () => onSignal("SIGTERM"));
  process.once("SIGINT", () => onSignal("SIGINT"));
}

export function persistenceStatus() {
  return { enabled: !!baPool(), restoreOk, snapshotId: restoredId };
}
