import { copyFileSync, unlinkSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { applyMigrations } from "../server/migrations";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Migration smoke failure: ${message}`);
}

const freshPath = `/tmp/bible-arena-migration-fresh-${randomUUID()}.sqlite`;
const legacyPath = `/tmp/bible-arena-migration-legacy-${randomUUID()}.sqlite`;
try {
  const fresh = new DatabaseSync(freshPath);
  applyMigrations(fresh);
  applyMigrations(fresh);
  assert(Number((fresh.prepare("SELECT count(*) AS count FROM __drizzle_migrations").get() as any).count) === 2, "fresh migrations should be recorded once each");
  assert(Number((fresh.prepare("PRAGMA foreign_keys").get() as any).foreign_keys) === 1, "foreign keys should be enabled");
  fresh.close();

  copyFileSync(freshPath, legacyPath);
  const legacy = new DatabaseSync(legacyPath);
  legacy.exec("DELETE FROM __drizzle_migrations");
  legacy.prepare("INSERT INTO users (openId,name,role,createdAt,updatedAt,lastSignedIn) VALUES (?,?,?,?,?,?)").run("migration-legacy", "Migration Legacy", "user", 1, 1, 1);
  legacy.close();

  const upgraded = new DatabaseSync(legacyPath);
  applyMigrations(upgraded);
  applyMigrations(upgraded);
  const user = upgraded.prepare("SELECT openId,name FROM users WHERE openId = ?").get("migration-legacy") as any;
  assert(user?.openId === "migration-legacy", "legacy user data should survive upgrade");
  assert(Number((upgraded.prepare("SELECT count(*) AS count FROM __drizzle_migrations").get() as any).count) === 2, "upgrade should record each canonical migration once");
  upgraded.close();
  console.log("Migration smoke passed: fresh, idempotent, and legacy upgrade paths.");
} finally {
  for (const path of [freshPath, legacyPath]) {
    try { unlinkSync(path); } catch { /* already removed */ }
  }
}
