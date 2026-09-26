import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyMigrations } from "../server/migrations";

const dir = mkdtempSync(join(tmpdir(), "bible-arena-restore-"));
const sourcePath = join(dir, "source.sqlite");
const backupPath = join(dir, "restore.sqlite");
try {
  const source = new DatabaseSync(sourcePath);
  source.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
  applyMigrations(source);
  source.prepare("INSERT INTO users (openId, role, createdAt, updatedAt, lastSignedIn) VALUES (?, ?, ?, ?, ?)").run("restore-smoke", "user", 1, 1, 1);
  source.exec(`VACUUM INTO '${backupPath.replaceAll("'", "''")}'`);
  source.close();

  const restored = new DatabaseSync(backupPath, { readOnly: true });
  const integrity = restored.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
  if (integrity.integrity_check !== "ok") throw new Error(`Integrity check failed: ${integrity.integrity_check}`);
  const user = restored.prepare("SELECT openId FROM users WHERE openId = ?").get("restore-smoke") as { openId: string } | undefined;
  if (user?.openId !== "restore-smoke") throw new Error("Restored user row was not found");
  const requiredTables = ["users", "session_records", "notifications", "fellowship_groups"];
  for (const table of requiredTables) {
    if (!restored.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)) throw new Error(`Missing restored table: ${table}`);
  }
  restored.close();
  console.log(JSON.stringify({ event: "database_restore_drill_passed", sourcePath, backupPath, requiredTables }));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
