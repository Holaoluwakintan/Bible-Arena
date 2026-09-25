import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: int("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  createdAt: int("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: int("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  lastSignedIn: int("lastSignedIn", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const playerProgress = sqliteTable("player_progress", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: int("userId").notNull().unique(),
  totalXp: int("totalXp").notNull().default(0),
  currentStreak: int("currentStreak").notNull().default(0),
  bestStreak: int("bestStreak").notNull().default(0),
  lastEligibleDate: text("lastEligibleDate"),
  achievementsJson: text("achievementsJson").notNull().default("[]"),
  updatedAt: int("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const sessionRecords = sqliteTable("session_records", {
  id: text("id").primaryKey(),
  userId: int("userId").notNull(),
  mode: text("mode").notNull(),
  score: int("score").notNull(),
  accuracy: int("accuracy").notNull(),
  correctAnswers: int("correctAnswers").notNull(),
  totalQuestions: int("totalQuestions").notNull(),
  xpEarned: int("xpEarned").notNull(),
  completedAt: int("completedAt", { mode: "timestamp" }).notNull(),
});

export const friendChallenges = sqliteTable("friend_challenges", {
  id: text("id").primaryKey(),
  shareCode: text("shareCode").notNull().unique(),
  creatorUserId: int("creatorUserId").notNull(),
  opponentUserId: int("opponentUserId"),
  mode: text("mode").notNull(),
  status: text("status", { enum: ["open", "completed", "expired"] }).notNull().default("open"),
  createdAt: int("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  expiresAt: int("expiresAt", { mode: "timestamp" }).notNull(),
});

export const multiplayerRooms = sqliteTable("multiplayer_rooms", {
  id: text("id").primaryKey(),
  roomCode: text("roomCode").notNull().unique(),
  hostUserId: int("hostUserId").notNull(),
  guestUserId: int("guestUserId"),
  mode: text("mode").notNull(),
  status: text("status", { enum: ["lobby", "playing", "complete"] }).notNull().default("lobby"),
  currentQuestionIndex: int("currentQuestionIndex").notNull().default(0),
  hostReady: int("hostReady").notNull().default(0),
  guestReady: int("guestReady").notNull().default(0),
  hostAnsweredIndex: int("hostAnsweredIndex").notNull().default(-1),
  guestAnsweredIndex: int("guestAnsweredIndex").notNull().default(-1),
  hostScore: int("hostScore").notNull().default(0),
  guestScore: int("guestScore").notNull().default(0),
  winnerUserId: int("winnerUserId"),
  roundToken: text("roundToken").notNull().default(""),
  roundDeadline: int("roundDeadline", { mode: "timestamp" }),
  roomVersion: int("roomVersion").notNull().default(0),
  createdAt: int("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: int("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const tournamentSeasons = sqliteTable("tournament_seasons", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  startsAt: int("startsAt", { mode: "timestamp" }).notNull(),
  endsAt: int("endsAt", { mode: "timestamp" }).notNull(),
  status: text("status", { enum: ["active", "completed"] }).notNull().default("active"),
  createdAt: int("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const matchmakingQueue = sqliteTable("matchmaking_queue", {
  id: text("id").primaryKey(),
  userId: int("userId").notNull().unique(),
  seasonId: text("seasonId").notNull(),
  division: text("division").notNull(),
  rating: int("rating").notNull().default(0),
  status: text("status", { enum: ["waiting", "matched", "expired"] }).notNull().default("waiting"),
  matchedRoomId: text("matchedRoomId"),
  createdAt: int("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  expiresAt: int("expiresAt", { mode: "timestamp" }).notNull(),
});

export const multiplayerMatches = sqliteTable("multiplayer_matches", {
  id: text("id").primaryKey(),
  roomId: text("roomId").notNull(),
  seasonId: text("seasonId").notNull().default("season-legacy"),
  hostUserId: int("hostUserId").notNull(),
  guestUserId: int("guestUserId").notNull(),
  hostScore: int("hostScore").notNull(),
  guestScore: int("guestScore").notNull(),
  winnerUserId: int("winnerUserId"),
  hostXp: int("hostXp").notNull(),
  guestXp: int("guestXp").notNull(),
  resultReason: text("resultReason", { enum: ["answers", "timeout"] }).notNull(),
  isSuspicious: int("isSuspicious").notNull().default(0),
  suspicionReason: text("suspicionReason"),
  completedAt: int("completedAt", { mode: "timestamp" }).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type PlayerProgress = typeof playerProgress.$inferSelect;
export type SessionRecord = typeof sessionRecords.$inferSelect;
export type FriendChallenge = typeof friendChallenges.$inferSelect;
export type MultiplayerRoom = typeof multiplayerRooms.$inferSelect;
export type TournamentSeason = typeof tournamentSeasons.$inferSelect;
export type MatchmakingQueueEntry = typeof matchmakingQueue.$inferSelect;
export type MultiplayerMatch = typeof multiplayerMatches.$inferSelect;
