import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { ENV } from "./_core/env";
import type { InsertUser, User, FriendChallenge, MultiplayerRoom, SessionRecord } from "../drizzle/schema";
import { VERIFIED_BIBLE_QUIZ_QUESTIONS, type GameMode } from "../domain/questions";
import {
  getMatchXp,
  getRematchPatch,
  getRoomReadyPatch,
  getTimeoutPatch,
  resolveRoomAnswer,
  MULTIPLAYER_ROUND_DURATION_MS,
} from "../domain/multiplayer";
import { broadcastRoom } from "./realtime";
import { aggregateMultiplayerRankings, type MultiplayerRankingScope } from "../domain/multiplayer-rankings";
import { findQueueMatch, MATCHMAKING_QUEUE_TTL_MS, ratingFromRanking } from "../domain/ranked-competition";
import {
  AUTUMN_ASCENSION_REWARDS,
  calculateSeasonTier,
  isRewardEligible,
  SEASON_TIERS,
} from "../domain/seasons";

let _sqlite: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!_sqlite) {
    _sqlite = new DatabaseSync(ENV.sqlitePath);
    initSchema(_sqlite);
  }
  return _sqlite;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openId TEXT NOT NULL UNIQUE,
      name TEXT,
      email TEXT,
      loginMethod TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      lastSignedIn INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS player_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL UNIQUE,
      totalXp INTEGER NOT NULL DEFAULT 0,
      currentStreak INTEGER NOT NULL DEFAULT 0,
      bestStreak INTEGER NOT NULL DEFAULT 0,
      lastEligibleDate TEXT,
      achievementsJson TEXT NOT NULL DEFAULT '[]',
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS session_records (
      id TEXT PRIMARY KEY,
      userId INTEGER NOT NULL,
      mode TEXT NOT NULL,
      score INTEGER NOT NULL,
      accuracy INTEGER NOT NULL,
      correctAnswers INTEGER NOT NULL,
      totalQuestions INTEGER NOT NULL,
      xpEarned INTEGER NOT NULL,
      completedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS friend_challenges (
      id TEXT PRIMARY KEY,
      shareCode TEXT NOT NULL UNIQUE,
      creatorUserId INTEGER NOT NULL,
      opponentUserId INTEGER,
      mode TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      createdAt INTEGER NOT NULL,
      expiresAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS multiplayer_rooms (
      id TEXT PRIMARY KEY,
      roomCode TEXT NOT NULL UNIQUE,
      hostUserId INTEGER NOT NULL,
      guestUserId INTEGER,
      mode TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'lobby',
      currentQuestionIndex INTEGER NOT NULL DEFAULT 0,
      hostReady INTEGER NOT NULL DEFAULT 0,
      guestReady INTEGER NOT NULL DEFAULT 0,
      hostAnsweredIndex INTEGER NOT NULL DEFAULT -1,
      guestAnsweredIndex INTEGER NOT NULL DEFAULT -1,
      hostScore INTEGER NOT NULL DEFAULT 0,
      guestScore INTEGER NOT NULL DEFAULT 0,
      winnerUserId INTEGER,
      roundToken TEXT NOT NULL DEFAULT '',
      roundDeadline INTEGER,
      roomVersion INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tournament_seasons (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      startsAt INTEGER NOT NULL,
      endsAt INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS matchmaking_queue (
      id TEXT PRIMARY KEY,
      userId INTEGER NOT NULL UNIQUE,
      seasonId TEXT NOT NULL,
      division TEXT NOT NULL,
      rating INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'waiting',
      matchedRoomId TEXT,
      createdAt INTEGER NOT NULL,
      expiresAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS multiplayer_matches (
      id TEXT PRIMARY KEY,
      roomId TEXT NOT NULL,
      seasonId TEXT NOT NULL DEFAULT 'season-legacy',
      hostUserId INTEGER NOT NULL,
      guestUserId INTEGER NOT NULL,
      hostScore INTEGER NOT NULL,
      guestScore INTEGER NOT NULL,
      winnerUserId INTEGER,
      hostXp INTEGER NOT NULL,
      guestXp INTEGER NOT NULL,
      resultReason TEXT NOT NULL,
      isSuspicious INTEGER NOT NULL DEFAULT 0,
      suspicionReason TEXT,
      completedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS player_season_rewards (
      userId INTEGER NOT NULL,
      seasonId TEXT NOT NULL,
      rewardId TEXT NOT NULL,
      claimedAt INTEGER NOT NULL,
      PRIMARY KEY (userId, seasonId, rewardId)
    );

    CREATE TABLE IF NOT EXISTS push_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      token TEXT NOT NULL UNIQUE,
      platform TEXT,
      dailyReminders INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS friendships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requesterId INTEGER NOT NULL,
      addresseeId INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      UNIQUE (requesterId, addresseeId)
    );

    CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships (requesterId);
    CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships (addresseeId);
  `);
}

function toUnix(date?: Date | null): number {
  return date ? Math.floor(date.getTime() / 1000) : Math.floor(Date.now() / 1000);
}

function fromUnix(unix: number | null | undefined): Date | null {
  return unix ? new Date(unix * 1000) : null;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = getDb();
  const now = toUnix();
  const existing = await getUserByOpenId(user.openId);

  if (existing) {
    db.prepare(`
      UPDATE users SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        loginMethod = COALESCE(?, loginMethod),
        role = COALESCE(?, role),
        lastSignedIn = ?,
        updatedAt = ?
      WHERE openId = ?
    `).run(
      user.name ?? null,
      user.email ?? null,
      user.loginMethod ?? null,
      user.role ?? null,
      user.lastSignedIn ? toUnix(user.lastSignedIn) : now,
      now,
      user.openId
    );
  } else {
    db.prepare(`
      INSERT INTO users (openId, name, email, loginMethod, role, createdAt, updatedAt, lastSignedIn)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.openId,
      user.name ?? null,
      user.email ?? null,
      user.loginMethod ?? null,
      user.role ?? "user",
      user.createdAt ? toUnix(user.createdAt) : now,
      now,
      user.lastSignedIn ? toUnix(user.lastSignedIn) : now
    );
  }
}

export async function getUserByOpenId(openId: string): Promise<User | null> {
  const db = getDb();
  const row = db.prepare("SELECT * FROM users WHERE openId = ? LIMIT 1").get(openId) as any;
  if (!row) return null;
  return {
    ...row,
    createdAt: fromUnix(row.createdAt),
    updatedAt: fromUnix(row.updatedAt),
    lastSignedIn: fromUnix(row.lastSignedIn),
  };
}

export async function getCloudProgress(userId: number) {
  const db = getDb();
  const progress = db.prepare("SELECT * FROM player_progress WHERE userId = ? LIMIT 1").get(userId) as any;
  const sessions = db.prepare("SELECT * FROM session_records WHERE userId = ? ORDER BY completedAt DESC LIMIT 50").all(userId) as any[];

  return {
    progress: progress ? {
      ...progress,
      updatedAt: fromUnix(progress.updatedAt),
    } : null,
    sessions: sessions.map((s) => ({
      ...s,
      completedAt: fromUnix(s.completedAt),
    })),
  };
}

export async function saveCloudProgress(input: {
  userId: number;
  totalXp: number;
  currentStreak: number;
  bestStreak: number;
  lastEligibleDate: string | null;
  achievementsJson: string;
}) {
  const db = getDb();
  const now = toUnix();
  const existing = db.prepare("SELECT id FROM player_progress WHERE userId = ?").get(input.userId);

  if (existing) {
    db.prepare(`
      UPDATE player_progress SET
        totalXp = ?, currentStreak = ?, bestStreak = ?, lastEligibleDate = ?, achievementsJson = ?, updatedAt = ?
      WHERE userId = ?
    `).run(
      input.totalXp,
      input.currentStreak,
      input.bestStreak,
      input.lastEligibleDate,
      input.achievementsJson,
      now,
      input.userId
    );
  } else {
    db.prepare(`
      INSERT INTO player_progress (userId, totalXp, currentStreak, bestStreak, lastEligibleDate, achievementsJson, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.userId,
      input.totalXp,
      input.currentStreak,
      input.bestStreak,
      input.lastEligibleDate,
      input.achievementsJson,
      now
    );
  }
}

export async function saveSessionRecord(input: {
  id: string;
  userId: number;
  mode: string;
  score: number;
  accuracy: number;
  correctAnswers: number;
  totalQuestions: number;
  xpEarned: number;
  completedAt: Date;
}) {
  const db = getDb();
  const completedAt = toUnix(input.completedAt);
  db.prepare(`
    INSERT OR REPLACE INTO session_records (id, userId, mode, score, accuracy, correctAnswers, totalQuestions, xpEarned, completedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.id,
    input.userId,
    input.mode,
    input.score,
    input.accuracy,
    input.correctAnswers,
    input.totalQuestions,
    input.xpEarned,
    completedAt
  );
}

export async function listUserChallenges(userId: number) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM friend_challenges
    WHERE creatorUserId = ? OR opponentUserId = ?
    ORDER BY createdAt DESC LIMIT 50
  `).all(userId, userId) as any[];

  return rows.map((r) => ({
    ...r,
    createdAt: fromUnix(r.createdAt),
    expiresAt: fromUnix(r.expiresAt),
  }));
}

export async function createCloudChallenge(input: {
  id: string;
  shareCode: string;
  creatorUserId: number;
  mode: string;
  expiresAt: Date;
  createdAt: Date;
}) {
  const db = getDb();
  const challenge = {
    ...input,
    status: "open" as const,
  };
  db.prepare(`
    INSERT INTO friend_challenges (id, shareCode, creatorUserId, mode, status, createdAt, expiresAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    challenge.id,
    challenge.shareCode,
    challenge.creatorUserId,
    challenge.mode,
    challenge.status,
    toUnix(challenge.createdAt),
    toUnix(challenge.expiresAt)
  );
  return challenge;
}

export async function joinCloudChallenge(shareCode: string, opponentUserId: number) {
  const db = getDb();
  const challenge = db.prepare("SELECT * FROM friend_challenges WHERE shareCode = ? LIMIT 1").get(shareCode) as any;
  if (!challenge) throw new Error("Challenge not found.");
  if (challenge.status !== "open") throw new Error("Challenge is no longer open.");
  if (challenge.expiresAt <= toUnix()) throw new Error("Challenge has expired.");

  db.prepare("UPDATE friend_challenges SET opponentUserId = ?, status = 'completed' WHERE id = ?").run(
    opponentUserId,
    challenge.id
  );

  return {
    ...challenge,
    createdAt: fromUnix(challenge.createdAt)!,
    expiresAt: fromUnix(challenge.expiresAt)!,
    opponentUserId,
    status: "completed" as const,
  };
}

export async function getLeaderboardRows(scope: "weekly" | "all_time", now: Date) {
  const db = getDb();
  const weekStart = new Date(now);
  const day = weekStart.getDay();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((day + 6) % 7));
  const weekStartUnix = toUnix(weekStart);

  let query = `
    SELECT
      s.userId,
      u.name as displayName,
      SUM(s.score) as score,
      ROUND(AVG(s.accuracy)) as averageAccuracy,
      COUNT(*) as sessions
    FROM session_records s
    LEFT JOIN users u ON s.userId = u.id
  `;

  if (scope === "weekly") {
    query += ` WHERE s.completedAt >= ${weekStartUnix} `;
  }

  query += ` GROUP BY s.userId, u.name ORDER BY score DESC LIMIT 50 `;

  const rows = db.prepare(query).all() as any[];
  return rows.map((r) => ({
    userId: r.userId,
    displayName: r.displayName || "Bible Arena Player",
    score: Number(r.score ?? 0),
    sessions: Number(r.sessions ?? 0),
    averageAccuracy: Number(r.averageAccuracy ?? 0),
  }));
}

export async function listUserMatches(userId: number) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM multiplayer_matches
    WHERE hostUserId = ? OR guestUserId = ?
    ORDER BY completedAt DESC LIMIT 50
  `).all(userId, userId) as any[];

  return rows.map((r) => ({
    ...r,
    completedAt: fromUnix(r.completedAt),
  }));
}

export function getSeasonDescriptor(now: Date) {
  const startsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const endsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const id = `season-${startsAt.getUTCFullYear()}-${String(startsAt.getUTCMonth() + 1).padStart(2, "0")}`;
  return { id, name: `Season ${startsAt.getUTCFullYear()}-${String(startsAt.getUTCMonth() + 1).padStart(2, "0")}`, startsAt, endsAt };
}

export async function getMultiplayerRankingRows(scope: MultiplayerRankingScope, now: Date) {
  const db = getDb();
  const weekStart = new Date(now);
  const day = weekStart.getDay();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((day + 6) % 7));
  const season = getSeasonDescriptor(now);

  let whereClause = "";
  if (scope === "weekly") {
    whereClause = `WHERE completedAt >= ${toUnix(weekStart)}`;
  } else if (scope === "season") {
    whereClause = `WHERE seasonId = '${season.id}'`;
  }

  const matchesRaw = db.prepare(`SELECT * FROM multiplayer_matches ${whereClause} ORDER BY completedAt DESC LIMIT 10000`).all() as any[];
  const matches = matchesRaw.map((m) => ({
    ...m,
    completedAt: fromUnix(m.completedAt)!,
  }));

  const ids = Array.from(new Set(matches.flatMap((m) => [m.hostUserId, m.guestUserId])));
  const names = new Map<number, string>();

  if (ids.length) {
    const placeholders = ids.map(() => "?").join(",");
    const people = db.prepare(`SELECT id, name FROM users WHERE id IN (${placeholders})`).all(...ids) as any[];
    for (const p of people) {
      names.set(p.id, p.name || "Bible Arena Player");
    }
  }

  return aggregateMultiplayerRankings(matches, names as any);
}

export async function rolloverExpiredSeasons(now = new Date()) {
  const db = getDb();
  const current = getSeasonDescriptor(now);
  const nowUnix = toUnix(now);

  db.prepare("UPDATE tournament_seasons SET status = 'completed' WHERE status = 'active' AND endsAt <= ?").run(nowUnix);

  const existing = db.prepare("SELECT id FROM tournament_seasons WHERE id = ?").get(current.id);
  if (!existing) {
    db.prepare(`
      INSERT INTO tournament_seasons (id, name, startsAt, endsAt, status, createdAt)
      VALUES (?, ?, ?, ?, 'active', ?)
    `).run(current.id, current.name, toUnix(current.startsAt), toUnix(current.endsAt), nowUnix);
  }

  return { completed: 0, activeSeasonId: current.id };
}

export async function getClaimedSeasonRewards(userId: number, seasonId: string): Promise<string[]> {
  const db = getDb();
  const rows = db.prepare("SELECT rewardId FROM player_season_rewards WHERE userId = ? AND seasonId = ?").all(userId, seasonId) as any[];
  return rows.map((r) => r.rewardId);
}

export async function getSeasonProgress(userId: number, now = new Date()) {
  const db = getDb();
  await rolloverExpiredSeasons(now);
  const season = getSeasonDescriptor(now);

  const matchXpRow = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN hostUserId = ? THEN hostXp WHEN guestUserId = ? THEN guestXp ELSE 0 END), 0) as totalMatchXp
    FROM multiplayer_matches
    WHERE seasonId = ? AND (hostUserId = ? OR guestUserId = ?)
  `).get(userId, userId, season.id, userId, userId) as any;

  const sessionXpRow = db.prepare(`
    SELECT COALESCE(SUM(xpEarned), 0) as totalSessionXp
    FROM session_records
    WHERE userId = ? AND completedAt >= ?
  `).get(userId, toUnix(season.startsAt)) as any;

  const points = Number(matchXpRow?.totalMatchXp ?? 0) + Number(sessionXpRow?.totalSessionXp ?? 0);
  const tierInfo = calculateSeasonTier(points);
  const claimedRewardIds = await getClaimedSeasonRewards(userId, season.id);

  const rankings = await getMultiplayerRankingRows("season", now);
  const myRank = rankings.find((r) => r.playerId === String(userId));
  const division = myRank?.division ?? "Bronze";

  return {
    season: {
      id: season.id,
      name: season.name,
      startsAt: season.startsAt,
      endsAt: season.endsAt,
    },
    points,
    division,
    ...tierInfo,
    claimedRewardIds,
    catalog: AUTUMN_ASCENSION_REWARDS,
    tiers: SEASON_TIERS,
  };
}

export async function claimSeasonReward(userId: number, seasonId: string, rewardId: string, now = new Date()) {
  const reward = AUTUMN_ASCENSION_REWARDS.find((r) => r.id === rewardId);
  if (!reward) throw new Error("Reward not found in catalog.");

  const progress = await getSeasonProgress(userId, now);
  if (!isRewardEligible(progress.currentTier, reward.requiredTier)) {
    throw new Error(`You must reach the ${reward.requiredTier} tier to claim this reward.`);
  }

  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO player_season_rewards (userId, seasonId, rewardId, claimedAt)
    VALUES (?, ?, ?, ?)
  `).run(userId, seasonId, rewardId, toUnix(now));

  return { success: true as const, rewardId };
}

export async function joinMatchmakingQueue(userId: number, now = new Date()) {
  const db = getDb();
  await rolloverExpiredSeasons(now);
  const season = getSeasonDescriptor(now);
  const rows = await getMultiplayerRankingRows("season", now);
  const profile = rows.find((r) => r.playerId === String(userId));
  const division = profile?.division ?? "Bronze";
  const rating = profile ? ratingFromRanking(profile) : 0;
  const nowUnix = toUnix(now);
  const expiresAt = new Date(now.getTime() + MATCHMAKING_QUEUE_TTL_MS);

  const entry = {
    id: `queue-${userId}`,
    userId,
    seasonId: season.id,
    division,
    rating,
    status: "waiting" as const,
    matchedRoomId: null as string | null,
    createdAt: now,
    expiresAt,
  };

  db.prepare(`
    INSERT OR REPLACE INTO matchmaking_queue (id, userId, seasonId, division, rating, status, matchedRoomId, createdAt, expiresAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.id,
    entry.userId,
    entry.seasonId,
    entry.division,
    entry.rating,
    entry.status,
    entry.matchedRoomId,
    nowUnix,
    toUnix(expiresAt)
  );

  const candidatesRaw = db.prepare(`
    SELECT * FROM matchmaking_queue
    WHERE status = 'waiting' AND seasonId = ? AND userId != ? AND expiresAt > ?
    ORDER BY createdAt ASC LIMIT 50
  `).all(season.id, userId, nowUnix) as any[];

  const candidates = candidatesRaw.map((c) => ({
    ...c,
    createdAt: fromUnix(c.createdAt)!,
    expiresAt: fromUnix(c.expiresAt)!,
  }));

  const opponent = findQueueMatch(entry as any, candidates as any, now);
  if (!opponent) {
    return { status: "waiting" as const, queueId: entry.id, seasonId: season.id, division, rating, expiresAt: entry.expiresAt, roomId: null };
  }

  const room = await createMultiplayerRoom(userId, "bible_quiz");
  db.prepare("UPDATE matchmaking_queue SET status = 'matched', matchedRoomId = ? WHERE userId = ?").run(room.id, opponent.userId);
  db.prepare("UPDATE matchmaking_queue SET status = 'matched', matchedRoomId = ? WHERE userId = ?").run(room.id, userId);
  await joinMultiplayerRoom(room.roomCode, opponent.userId);

  return { status: "matched" as const, queueId: entry.id, seasonId: season.id, division, rating, expiresAt: entry.expiresAt, roomId: room.id };
}

export async function getMatchmakingQueueStatus(userId: number, now = new Date()) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM matchmaking_queue WHERE userId = ? LIMIT 1").get(userId) as any;
  if (!row) return null;

  const entry = {
    ...row,
    createdAt: fromUnix(row.createdAt)!,
    expiresAt: fromUnix(row.expiresAt)!,
  };

  if (entry.status === "waiting" && entry.expiresAt <= now) {
    db.prepare("UPDATE matchmaking_queue SET status = 'expired' WHERE id = ?").run(entry.id);
    return { ...entry, status: "expired" as const };
  }
  return entry;
}

export async function leaveMatchmakingQueue(userId: number) {
  const db = getDb();
  db.prepare("UPDATE matchmaking_queue SET status = 'expired' WHERE userId = ? AND status = 'waiting'").run(userId);
  return { success: true as const };
}

export async function expireMatchmakingQueue(now = new Date()) {
  const db = getDb();
  const result = db.prepare("UPDATE matchmaking_queue SET status = 'expired' WHERE status = 'waiting' AND expiresAt <= ?").run(toUnix(now));
  return { expired: Number(result.changes ?? 0) };
}

const ROOM_QUESTION_COUNT = 5;
function roomCode(seed: string): string {
  let value = 13;
  for (const character of seed) value = (value * 31 + character.charCodeAt(0)) % 1_000_000;
  return String(value).padStart(6, "0");
}
function nextRound() {
  return { roundToken: randomUUID(), roundDeadline: new Date(Date.now() + MULTIPLAYER_ROUND_DURATION_MS) };
}

async function awardMatch(
  db: DatabaseSync,
  room: any,
  reason: "answers" | "timeout",
  hostScore: number,
  guestScore: number,
  winnerUserId: number | null
) {
  if (!room || !room.guestUserId) throw new Error("A complete match needs two players.");
  const guestUserId = room.guestUserId;
  const hostXp = winnerUserId === null ? 75 : winnerUserId === room.hostUserId ? 100 : 50;
  const guestXp = winnerUserId === null ? 75 : winnerUserId === room.guestUserId ? 100 : 50;
  const id = `match-${room.id}-${room.currentQuestionIndex}-${reason}`;
  const now = new Date();
  const season = getSeasonDescriptor(now);

  const existing = db.prepare("SELECT id FROM multiplayer_matches WHERE id = ? LIMIT 1").get(id);
  if (existing) return { hostXp, guestXp };

  db.prepare(`
    INSERT INTO multiplayer_matches (id, roomId, seasonId, hostUserId, guestUserId, hostScore, guestScore, winnerUserId, hostXp, guestXp, resultReason, completedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    room.id,
    season.id,
    room.hostUserId,
    guestUserId,
    hostScore,
    guestScore,
    winnerUserId,
    hostXp,
    guestXp,
    reason,
    toUnix(now)
  );

  for (const [userId, xp] of [[room.hostUserId, hostXp], [guestUserId, guestXp]] as const) {
    const prog = db.prepare("SELECT totalXp FROM player_progress WHERE userId = ?").get(userId) as any;
    if (prog) {
      db.prepare("UPDATE player_progress SET totalXp = totalXp + ?, updatedAt = ? WHERE userId = ?").run(xp, toUnix(now), userId);
    } else {
      db.prepare("INSERT INTO player_progress (userId, totalXp, currentStreak, bestStreak, achievementsJson, updatedAt) VALUES (?, ?, 0, 0, '[]', ?)").run(userId, xp, toUnix(now));
    }
  }

  return { hostXp, guestXp };
}

export async function createMultiplayerRoom(hostUserId: number, mode: GameMode) {
  const db = getDb();
  const createdAt = new Date();
  const id = `room-${hostUserId}-${createdAt.getTime()}-${randomUUID().slice(0, 8)}`;
  const room = {
    id,
    roomCode: roomCode(id),
    hostUserId,
    guestUserId: null,
    mode,
    status: "lobby" as const,
    currentQuestionIndex: 0,
    hostReady: 0,
    guestReady: 0,
    hostAnsweredIndex: -1,
    guestAnsweredIndex: -1,
    hostScore: 0,
    guestScore: 0,
    winnerUserId: null,
    roundToken: "",
    roundDeadline: null,
    roomVersion: 0,
    createdAt,
    updatedAt: createdAt,
  };

  db.prepare(`
    INSERT INTO multiplayer_rooms (id, roomCode, hostUserId, guestUserId, mode, status, currentQuestionIndex, hostReady, guestReady, hostAnsweredIndex, guestAnsweredIndex, hostScore, guestScore, winnerUserId, roundToken, roundDeadline, roomVersion, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    room.id,
    room.roomCode,
    room.hostUserId,
    room.guestUserId,
    room.mode,
    room.status,
    room.currentQuestionIndex,
    room.hostReady,
    room.guestReady,
    room.hostAnsweredIndex,
    room.guestAnsweredIndex,
    room.hostScore,
    room.guestScore,
    room.winnerUserId,
    room.roundToken,
    null,
    room.roomVersion,
    toUnix(room.createdAt),
    toUnix(room.updatedAt)
  );

  return room;
}

export async function getMultiplayerRoom(roomId: string): Promise<MultiplayerRoom | undefined> {
  const db = getDb();
  const row = db.prepare("SELECT * FROM multiplayer_rooms WHERE id = ? LIMIT 1").get(roomId) as any;
  if (!row) return undefined;
  return {
    ...row,
    roundDeadline: fromUnix(row.roundDeadline),
    createdAt: fromUnix(row.createdAt)!,
    updatedAt: fromUnix(row.updatedAt)!,
  };
}

export async function joinMultiplayerRoom(roomCodeValue: string, guestUserId: number) {
  const db = getDb();
  const room = db.prepare("SELECT * FROM multiplayer_rooms WHERE roomCode = ? LIMIT 1").get(roomCodeValue) as any;
  if (!room) throw new Error("Room not found.");
  if (room.status !== "lobby" || room.guestUserId) throw new Error("Room is no longer available.");
  if (room.hostUserId === guestUserId) throw new Error("You cannot join your own room.");

  const now = toUnix();
  const result = db.prepare("UPDATE multiplayer_rooms SET guestUserId = ?, roomVersion = roomVersion + 1, updatedAt = ? WHERE id = ? AND roomVersion = ?").run(
    guestUserId,
    now,
    room.id,
    room.roomVersion
  );
  if (!result.changes) throw new Error("Room changed. Please reload and try again.");

  const joined = {
    ...room,
    guestUserId,
    roomVersion: room.roomVersion + 1,
    createdAt: fromUnix(room.createdAt)!,
    updatedAt: new Date(now * 1000),
    roundDeadline: fromUnix(room.roundDeadline),
  };
  broadcastRoom(room.id, joined);
  return joined;
}

export async function setRoomReady(roomId: string, userId: number, ready: boolean, expectedVersion: number) {
  const db = getDb();
  const room = await getMultiplayerRoom(roomId);
  if (!room) throw new Error("Room not found.");
  if (room.roomVersion !== expectedVersion) throw new Error("Room changed. Please reload and try again.");

  const next = getRoomReadyPatch(room, userId, ready);
  const start = next.status === "playing" && room.status !== "playing";
  const started = start ? nextRound() : {};
  const nextDeadline = (started as any).roundDeadline ? toUnix((started as any).roundDeadline) : null;
  const nextToken = (started as any).roundToken ?? "";
  const now = toUnix();

  const result = db.prepare(`
    UPDATE multiplayer_rooms SET
      status = COALESCE(?, status),
      hostReady = COALESCE(?, hostReady),
      guestReady = COALESCE(?, guestReady),
      roundToken = CASE WHEN ? != '' THEN ? ELSE roundToken END,
      roundDeadline = CASE WHEN ? IS NOT NULL THEN ? ELSE roundDeadline END,
      roomVersion = ? + 1,
      updatedAt = ?
    WHERE id = ? AND roomVersion = ?
  `).run(
    (next as any).status ?? null,
    (next as any).hostReady ?? null,
    (next as any).guestReady ?? null,
    nextToken,
    nextToken,
    nextDeadline,
    nextDeadline,
    expectedVersion,
    now,
    roomId,
    expectedVersion
  );

  if (!result.changes) throw new Error("Room changed. Please reload and try again.");

  const updated = {
    ...room,
    ...next,
    ...started,
    roomVersion: expectedVersion + 1,
    updatedAt: new Date(now * 1000),
  };
  broadcastRoom(roomId, updated);
  return updated;
}

export async function submitRoomAnswer(
  roomId: string,
  userId: number,
  questionIndex: number,
  answerId: string | null,
  roundToken: string,
  expectedVersion: number
) {
  const db = getDb();
  const room = await getMultiplayerRoom(roomId);
  if (!room) throw new Error("Room not found.");
  if (room.roomVersion !== expectedVersion) throw new Error("Room changed. Please reload and try again.");

  const question = VERIFIED_BIBLE_QUIZ_QUESTIONS[questionIndex % VERIFIED_BIBLE_QUIZ_QUESTIONS.length];
  const next = nextRound();
  const result = resolveRoomAnswer(
    room,
    userId,
    questionIndex,
    answerId,
    question.correctAnswer,
    ROOM_QUESTION_COUNT,
    roundToken,
    new Date(),
    next.roundToken,
    next.roundDeadline
  );

  const p = result.patch as any;
  const now = toUnix();
  const res = db.prepare(`
    UPDATE multiplayer_rooms SET
      status = COALESCE(?, status),
      currentQuestionIndex = COALESCE(?, currentQuestionIndex),
      hostAnsweredIndex = COALESCE(?, hostAnsweredIndex),
      guestAnsweredIndex = COALESCE(?, guestAnsweredIndex),
      hostScore = COALESCE(?, hostScore),
      guestScore = COALESCE(?, guestScore),
      winnerUserId = COALESCE(?, winnerUserId),
      roundToken = COALESCE(?, roundToken),
      roundDeadline = ?,
      roomVersion = ? + 1,
      updatedAt = ?
    WHERE id = ? AND roomVersion = ?
  `).run(
    p.status ?? null,
    p.currentQuestionIndex ?? null,
    p.hostAnsweredIndex ?? null,
    p.guestAnsweredIndex ?? null,
    p.hostScore ?? null,
    p.guestScore ?? null,
    p.winnerUserId ?? null,
    p.roundToken ?? null,
    p.roundDeadline ? toUnix(p.roundDeadline) : null,
    expectedVersion,
    now,
    roomId,
    expectedVersion
  );

  if (!res.changes) throw new Error("Room changed. Please reload and try again.");

  const updated = {
    ...room,
    ...result.patch,
    roomVersion: expectedVersion + 1,
    isCorrect: result.isCorrect,
    questionCount: ROOM_QUESTION_COUNT,
    updatedAt: new Date(now * 1000),
  };

  if (result.completed) {
    const hostScore = "hostScore" in result.patch ? result.patch.hostScore : room.hostScore;
    const guestScore = "guestScore" in result.patch ? result.patch.guestScore : room.guestScore;
    await awardMatch(db, { ...room, ...result.patch }, "answers", hostScore, guestScore, (result.patch as any).winnerUserId ?? null);
  }

  broadcastRoom(roomId, updated);
  return updated;
}

export async function timeoutRoomRound(
  roomId: string,
  userId: number,
  roundToken: string,
  expectedVersion: number
) {
  const db = getDb();
  const room = await getMultiplayerRoom(roomId);
  if (!room) throw new Error("Room not found.");
  if (room.roomVersion !== expectedVersion) throw new Error("Room changed. Please reload and try again.");
  if (room.hostUserId !== userId && room.guestUserId !== userId) throw new Error("You are not in this room.");

  const next = nextRound();
  const result = getTimeoutPatch(room, next.roundToken, next.roundDeadline, ROOM_QUESTION_COUNT, new Date(), roundToken);
  const p = result.patch as any;
  const now = toUnix();

  const res = db.prepare(`
    UPDATE multiplayer_rooms SET
      status = COALESCE(?, status),
      currentQuestionIndex = COALESCE(?, currentQuestionIndex),
      hostAnsweredIndex = COALESCE(?, hostAnsweredIndex),
      guestAnsweredIndex = COALESCE(?, guestAnsweredIndex),
      winnerUserId = COALESCE(?, winnerUserId),
      roundToken = COALESCE(?, roundToken),
      roundDeadline = ?,
      roomVersion = ? + 1,
      updatedAt = ?
    WHERE id = ? AND roomVersion = ?
  `).run(
    p.status ?? null,
    p.currentQuestionIndex ?? null,
    p.hostAnsweredIndex ?? null,
    p.guestAnsweredIndex ?? null,
    p.winnerUserId ?? null,
    p.roundToken ?? null,
    p.roundDeadline ? toUnix(p.roundDeadline) : null,
    expectedVersion,
    now,
    roomId,
    expectedVersion
  );

  if (!res.changes) throw new Error("Room changed. Please reload and try again.");

  const updated = {
    ...room,
    ...result.patch,
    roomVersion: expectedVersion + 1,
    questionCount: ROOM_QUESTION_COUNT,
    updatedAt: new Date(now * 1000),
  };

  if (result.completed) {
    await awardMatch(db, { ...room, ...result.patch }, "timeout", room.hostScore, room.guestScore, (result.patch as any).winnerUserId ?? null);
  }

  broadcastRoom(roomId, updated);
  return updated;
}

export async function rematchMultiplayerRoom(roomId: string, userId: number, expectedVersion: number) {
  const db = getDb();
  const room = await getMultiplayerRoom(roomId);
  if (!room) throw new Error("Room not found.");
  if (room.roomVersion !== expectedVersion) throw new Error("Room changed. Please reload and try again.");

  const next = getRematchPatch(room, userId) as any;
  const now = toUnix();

  const res = db.prepare(`
    UPDATE multiplayer_rooms SET
      status = ?,
      currentQuestionIndex = ?,
      hostReady = ?,
      guestReady = ?,
      hostAnsweredIndex = ?,
      guestAnsweredIndex = ?,
      hostScore = ?,
      guestScore = ?,
      winnerUserId = ?,
      roundToken = '',
      roundDeadline = NULL,
      roomVersion = ? + 1,
      updatedAt = ?
    WHERE id = ? AND roomVersion = ?
  `).run(
    next.status,
    next.currentQuestionIndex,
    next.hostReady,
    next.guestReady,
    next.hostAnsweredIndex,
    next.guestAnsweredIndex,
    next.hostScore,
    next.guestScore,
    next.winnerUserId ?? null,
    expectedVersion,
    now,
    roomId,
    expectedVersion
  );

  if (!res.changes) throw new Error("Room changed. Please reload and try again.");

  const updated = {
    ...room,
    ...next,
    roomVersion: expectedVersion + 1,
    updatedAt: new Date(now * 1000),
  };
  broadcastRoom(roomId, updated);
  return updated;
}

export function registerPushToken(
  token: string,
  userId?: number | null,
  platform?: string,
): { success: boolean } {
  const db = getDb();
  const now = Date.now();
  db.prepare(`
    INSERT INTO push_tokens (userId, token, platform, dailyReminders, createdAt, updatedAt)
    VALUES (?, ?, ?, 1, ?, ?)
    ON CONFLICT(token) DO UPDATE SET
      userId = COALESCE(excluded.userId, push_tokens.userId),
      platform = COALESCE(excluded.platform, push_tokens.platform),
      updatedAt = excluded.updatedAt
  `).run(userId ?? null, token, platform ?? "unknown", now, now);
  return { success: true };
}

export function updateNotificationPreferences(
  token: string,
  dailyReminders: boolean,
): { success: boolean } {
  const db = getDb();
  const now = Date.now();
  db.prepare(`
    UPDATE push_tokens
    SET dailyReminders = ?, updatedAt = ?
    WHERE token = ?
  `).run(dailyReminders ? 1 : 0, now, token);
  return { success: true };
}

// ──────────────────────────────────────────────────────────────────
// Social Graph: Friends
// ──────────────────────────────────────────────────────────────────

export interface FriendRow {
  id: number;
  requesterId: number;
  addresseeId: number;
  status: "pending" | "accepted";
  createdAt: number;
  updatedAt: number;
  // joined from users
  friendId: number;
  friendName: string | null;
  friendOpenId: string;
}

export function sendFriendRequest(requesterId: number, addresseeId: number): { success: boolean; error?: string } {
  if (requesterId === addresseeId) return { success: false, error: "Cannot befriend yourself" };
  const db = getDb();
  const now = Date.now();
  // Check reverse direction already exists
  const existing = db.prepare(
    `SELECT id, status FROM friendships WHERE (requesterId = ? AND addresseeId = ?) OR (requesterId = ? AND addresseeId = ?)`
  ).get(requesterId, addresseeId, addresseeId, requesterId) as { id: number; status: string } | undefined;
  if (existing) {
    if (existing.status === "accepted") return { success: false, error: "Already friends" };
    return { success: false, error: "Request already sent" };
  }
  db.prepare(
    `INSERT INTO friendships (requesterId, addresseeId, status, createdAt, updatedAt) VALUES (?, ?, 'pending', ?, ?)`
  ).run(requesterId, addresseeId, now, now);
  return { success: true };
}

export function respondFriendRequest(
  requestId: number,
  addresseeId: number,
  accept: boolean,
): { success: boolean; error?: string } {
  const db = getDb();
  const now = Date.now();
  const row = db.prepare(
    `SELECT id, addresseeId FROM friendships WHERE id = ? AND addresseeId = ? AND status = 'pending'`
  ).get(requestId, addresseeId) as { id: number; addresseeId: number } | undefined;
  if (!row) return { success: false, error: "Request not found" };
  if (accept) {
    db.prepare(`UPDATE friendships SET status = 'accepted', updatedAt = ? WHERE id = ?`).run(now, requestId);
  } else {
    db.prepare(`DELETE FROM friendships WHERE id = ?`).run(requestId);
  }
  return { success: true };
}

export function listFriends(userId: number): {
  friends: Array<{ id: number; friendId: number; friendName: string | null; friendOpenId: string; since: number }>;
  pending: Array<{ id: number; fromId: number; fromName: string | null; fromOpenId: string; sentAt: number }>;
} {
  const db = getDb();
  // Accepted: user is either requester or addressee
  const acceptedRows = db.prepare(`
    SELECT f.id, f.createdAt,
      CASE WHEN f.requesterId = ? THEN f.addresseeId ELSE f.requesterId END AS friendId,
      u.name AS friendName, u.openId AS friendOpenId
    FROM friendships f
    JOIN users u ON u.id = CASE WHEN f.requesterId = ? THEN f.addresseeId ELSE f.requesterId END
    WHERE (f.requesterId = ? OR f.addresseeId = ?) AND f.status = 'accepted'
  `).all(userId, userId, userId, userId) as Array<{ id: number; createdAt: number; friendId: number; friendName: string | null; friendOpenId: string }>;
  // Pending requests addressed to this user
  const pendingRows = db.prepare(`
    SELECT f.id, f.requesterId AS fromId, f.createdAt AS sentAt, u.name AS fromName, u.openId AS fromOpenId
    FROM friendships f
    JOIN users u ON u.id = f.requesterId
    WHERE f.addresseeId = ? AND f.status = 'pending'
  `).all(userId) as Array<{ id: number; fromId: number; sentAt: number; fromName: string | null; fromOpenId: string }>;
  return {
    friends: acceptedRows.map((r) => ({ id: r.id, friendId: r.friendId, friendName: r.friendName, friendOpenId: r.friendOpenId, since: r.createdAt })),
    pending: pendingRows.map((r) => ({ id: r.id, fromId: r.fromId, fromName: r.fromName, fromOpenId: r.fromOpenId, sentAt: r.sentAt })),
  };
}

export function searchUsers(
  query: string,
  excludeUserId: number,
  limit = 20,
): Array<{ id: number; name: string | null; openId: string }> {
  if (!query || query.trim().length < 2) return [];
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, name, openId FROM users
    WHERE id != ? AND (name LIKE ? OR openId LIKE ?)
    ORDER BY name ASC LIMIT ?
  `).all(excludeUserId, `%${query}%`, `%${query}%`, limit) as Array<{ id: number; name: string | null; openId: string }>;
  return rows;
}

export function getFriendsLeaderboard(
  userId: number,
): Array<{ rank: number; playerId: number; displayName: string; totalXp: number; currentStreak: number }> {
  const db = getDb();
  // Get IDs of all accepted friends + self
  const friendIds = db.prepare(`
    SELECT CASE WHEN requesterId = ? THEN addresseeId ELSE requesterId END AS fid
    FROM friendships WHERE (requesterId = ? OR addresseeId = ?) AND status = 'accepted'
  `).all(userId, userId, userId) as Array<{ fid: number }>;
  const ids = [userId, ...friendIds.map((r) => r.fid)];
  const placeholders = ids.map(() => "?").join(",");
  const rows = db.prepare(`
    SELECT u.id AS playerId, COALESCE(u.name, 'Player') AS displayName,
      COALESCE(pp.totalXp, 0) AS totalXp, COALESCE(pp.currentStreak, 0) AS currentStreak
    FROM users u
    LEFT JOIN player_progress pp ON pp.userId = u.id
    WHERE u.id IN (${placeholders})
    ORDER BY totalXp DESC
  `).all(...ids) as Array<{ playerId: number; displayName: string; totalXp: number; currentStreak: number }>;
  return rows.map((r, i) => ({ rank: i + 1, ...r }));
}

