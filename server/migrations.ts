import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";

const MIGRATIONS_DIR = join(process.cwd(), "drizzle", "migrations");
function migrationFiles(): string[] {
  if (!existsSync(MIGRATIONS_DIR)) throw new Error(`Missing Drizzle migrations directory: ${MIGRATIONS_DIR}`);
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .sort()
    .map((file) => join(MIGRATIONS_DIR, file));
}

function hash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function hasTable(db: DatabaseSync, name: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
}

function recordMigration(db: DatabaseSync, hashValue: string, createdAt: number): void {
  db.prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)").run(hashValue, createdAt);
}

const LEGACY_TABLES = [
  "users", "player_progress", "session_records", "friend_challenges", "friend_challenge_turns", "multiplayer_rooms",
  "tournament_seasons", "matchmaking_queue", "multiplayer_matches", "player_season_rewards",
  "push_tokens", "friendships",
] as const;

const COPY_COLUMNS: Record<string, string> = {
  users: "id, openId, name, email, loginMethod, role, createdAt, updatedAt, lastSignedIn",
  player_progress: "id, userId, totalXp, currentStreak, bestStreak, lastEligibleDate, achievementsJson, updatedAt",
  session_records: "id, userId, mode, score, accuracy, correctAnswers, totalQuestions, xpEarned, completedAt",
  friend_challenges: "id, shareCode, creatorUserId, opponentUserId, mode, status, createdAt, expiresAt",
  friend_challenge_turns: "id, challengeId, userId, sessionId, score, accuracy, completedAt",
  multiplayer_rooms: "id, roomCode, hostUserId, guestUserId, mode, status, currentQuestionIndex, hostReady, guestReady, hostAnsweredIndex, guestAnsweredIndex, hostScore, guestScore, winnerUserId, roundToken, roundDeadline, roomVersion, createdAt, updatedAt",
  tournament_seasons: "id, name, startsAt, endsAt, status, createdAt",
  matchmaking_queue: "id, userId, seasonId, division, rating, status, matchedRoomId, createdAt, expiresAt",
  multiplayer_matches: "id, roomId, seasonId, hostUserId, guestUserId, hostScore, guestScore, winnerUserId, hostXp, guestXp, resultReason, isSuspicious, suspicionReason, completedAt",
  player_season_rewards: "userId, seasonId, rewardId, claimedAt",
  push_tokens: "id, userId, token, platform, dailyReminders, createdAt, updatedAt",
  friendships: "id, requesterId, addresseeId, status, createdAt, updatedAt",
};

function upgradeLegacyRuntimeSchema(db: DatabaseSync, baseline: string): void {
  db.exec("PRAGMA foreign_keys = OFF");
  for (const table of ["privacy_requests", "moderation_flags", "question_reports"]) {
    if (hasTable(db, table)) db.exec(`DROP TABLE "${table}"`);
  }
  for (const table of LEGACY_TABLES) {
    if (hasTable(db, table)) db.exec(`CREATE TABLE "__legacy_data_${table}" AS SELECT * FROM "${table}"`);
  }
  for (const table of [...LEGACY_TABLES].reverse()) if (hasTable(db, table)) db.exec(`DROP TABLE "${table}"`);
  db.exec(baseline.replace(/--> statement-breakpoint/g, ""));
  for (const table of LEGACY_TABLES) {
    const columns = COPY_COLUMNS[table];
    if (hasTable(db, table) && hasTable(db, `__legacy_data_${table}`)) {
      db.exec(`INSERT INTO "${table}" (${columns}) SELECT ${columns} FROM "__legacy_data_${table}"`);
      db.exec(`DROP TABLE "__legacy_data_${table}"`);
    }
  }
  db.exec("PRAGMA foreign_keys = ON");
}

export function applyMigrations(db: DatabaseSync): void {
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    )
  `);

  const applied = new Set(
    (db.prepare("SELECT hash FROM __drizzle_migrations").all() as Array<{ hash: string }>).map((row) => row.hash),
  );
  const now = Date.now();

  const files = migrationFiles();
  if (hasTable(db, "users") && applied.size === 0) {
    const baselineFile = files[0];
    if (!baselineFile) throw new Error("No canonical Drizzle baseline migration found.");
    const baseline = readFileSync(baselineFile, "utf8");
    db.exec("BEGIN IMMEDIATE");
    try {
      upgradeLegacyRuntimeSchema(db, baseline);
      const baselineHash = hash(baseline);
      recordMigration(db, baselineHash, now);
      applied.add(baselineHash);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  for (const file of files) {
    const contents = readFileSync(file, "utf8");
    const migrationHash = hash(contents);
    if (applied.has(migrationHash)) continue;
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(contents.replace(/--> statement-breakpoint/g, ""));
      recordMigration(db, migrationHash, now);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw new Error(`Failed to apply migration ${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
