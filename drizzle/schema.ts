import { check, index, int, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const nonNegative = (column: any) => sql`${column} >= 0`;

export const users = sqliteTable("users", {
  id: int("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  createdAt: int("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: int("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  lastSignedIn: int("lastSignedIn", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  openIdUnique: uniqueIndex("users_openId_unique").on(table.openId),
  roleCheck: check("users_role_check", sql`${table.role} IN ('user', 'admin')`),
}));

export const playerProgress = sqliteTable("player_progress", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  totalXp: int("totalXp").notNull().default(0),
  currentStreak: int("currentStreak").notNull().default(0),
  bestStreak: int("bestStreak").notNull().default(0),
  lastEligibleDate: text("lastEligibleDate"),
  achievementsJson: text("achievementsJson").notNull().default("[]"),
  updatedAt: int("updatedAt", { mode: "timestamp" }).notNull(),
}, (table) => ({
  userUnique: uniqueIndex("player_progress_userId_unique").on(table.userId),
  xpCheck: check("player_progress_xp_check", nonNegative(table.totalXp)),
  streakCheck: check("player_progress_streak_check", sql`${table.currentStreak} >= 0 AND ${table.bestStreak} >= 0`),
}));

export const sessionRecords = sqliteTable("session_records", {
  id: text("id").primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  mode: text("mode").notNull(),
  score: int("score").notNull(),
  accuracy: int("accuracy").notNull(),
  correctAnswers: int("correctAnswers").notNull(),
  totalQuestions: int("totalQuestions").notNull(),
  xpEarned: int("xpEarned").notNull(),
  completedAt: int("completedAt", { mode: "timestamp" }).notNull(),
}, (table) => ({
  userCompletedIndex: index("session_records_user_completed_idx").on(table.userId, table.completedAt),
  scoreCheck: check("session_records_score_check", nonNegative(table.score)),
  accuracyCheck: check("session_records_accuracy_check", sql`${table.accuracy} BETWEEN 0 AND 100`),
  answersCheck: check("session_records_answers_check", sql`${table.correctAnswers} BETWEEN 0 AND ${table.totalQuestions} AND ${table.totalQuestions} > 0`),
  xpCheck: check("session_records_xp_check", nonNegative(table.xpEarned)),
}));

export const friendChallenges = sqliteTable("friend_challenges", {
  id: text("id").primaryKey(),
  shareCode: text("shareCode").notNull(),
  creatorUserId: int("creatorUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  opponentUserId: int("opponentUserId").references(() => users.id, { onDelete: "set null" }),
  mode: text("mode").notNull(),
  status: text("status", { enum: ["open", "in_progress", "completed", "expired"] }).notNull().default("open"),
  createdAt: int("createdAt", { mode: "timestamp" }).notNull(),
  expiresAt: int("expiresAt", { mode: "timestamp" }).notNull(),
}, (table) => ({
  shareCodeUnique: uniqueIndex("friend_challenges_shareCode_unique").on(table.shareCode),
  creatorIndex: index("friend_challenges_creator_idx").on(table.creatorUserId),
  opponentIndex: index("friend_challenges_opponent_idx").on(table.opponentUserId),
}));

export const friendChallengeTurns = sqliteTable("friend_challenge_turns", {
  id: text("id").primaryKey(),
  challengeId: text("challengeId").notNull().references(() => friendChallenges.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionId: text("sessionId").notNull().references(() => sessionRecords.id, { onDelete: "cascade" }),
  score: int("score").notNull(),
  accuracy: int("accuracy").notNull(),
  completedAt: int("completedAt", { mode: "timestamp" }).notNull(),
}, (table) => ({
  challengeUserUnique: uniqueIndex("friend_challenge_turns_challenge_user_unique").on(table.challengeId, table.userId),
  sessionUnique: uniqueIndex("friend_challenge_turns_session_unique").on(table.sessionId),
  challengeIndex: index("friend_challenge_turns_challenge_idx").on(table.challengeId, table.completedAt),
}));

export const multiplayerRooms = sqliteTable("multiplayer_rooms", {
  id: text("id").primaryKey(),
  roomCode: text("roomCode").notNull(),
  hostUserId: int("hostUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  guestUserId: int("guestUserId").references(() => users.id, { onDelete: "set null" }),
  mode: text("mode").notNull(),
  status: text("status", { enum: ["lobby", "playing", "complete"] }).notNull().default("lobby"),
  currentQuestionIndex: int("currentQuestionIndex").notNull().default(0),
  hostReady: int("hostReady").notNull().default(0),
  guestReady: int("guestReady").notNull().default(0),
  hostAnsweredIndex: int("hostAnsweredIndex").notNull().default(-1),
  guestAnsweredIndex: int("guestAnsweredIndex").notNull().default(-1),
  hostScore: int("hostScore").notNull().default(0),
  guestScore: int("guestScore").notNull().default(0),
  winnerUserId: int("winnerUserId").references(() => users.id, { onDelete: "set null" }),
  roundToken: text("roundToken").notNull().default(""),
  roundDeadline: int("roundDeadline", { mode: "timestamp" }),
  roomVersion: int("roomVersion").notNull().default(0),
  createdAt: int("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: int("updatedAt", { mode: "timestamp" }).notNull(),
}, (table) => ({
  roomCodeUnique: uniqueIndex("multiplayer_rooms_roomCode_unique").on(table.roomCode),
  hostIndex: index("multiplayer_rooms_host_idx").on(table.hostUserId),
  guestIndex: index("multiplayer_rooms_guest_idx").on(table.guestUserId),
}));

export const tournamentSeasons = sqliteTable("tournament_seasons", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  startsAt: int("startsAt", { mode: "timestamp" }).notNull(),
  endsAt: int("endsAt", { mode: "timestamp" }).notNull(),
  status: text("status", { enum: ["active", "completed"] }).notNull().default("active"),
  createdAt: int("createdAt", { mode: "timestamp" }).notNull(),
}, (table) => ({ statusIndex: index("tournament_seasons_status_idx").on(table.status) }));

export const matchmakingQueue = sqliteTable("matchmaking_queue", {
  id: text("id").primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  seasonId: text("seasonId").notNull(),
  division: text("division").notNull(),
  rating: int("rating").notNull().default(0),
  status: text("status", { enum: ["waiting", "matched", "expired"] }).notNull().default("waiting"),
  matchedRoomId: text("matchedRoomId").references(() => multiplayerRooms.id, { onDelete: "set null" }),
  createdAt: int("createdAt", { mode: "timestamp" }).notNull(),
  expiresAt: int("expiresAt", { mode: "timestamp" }).notNull(),
}, (table) => ({
  userUnique: uniqueIndex("matchmaking_queue_userId_unique").on(table.userId),
  statusIndex: index("matchmaking_queue_status_idx").on(table.status, table.expiresAt),
}));

export const multiplayerMatches = sqliteTable("multiplayer_matches", {
  id: text("id").primaryKey(),
  roomId: text("roomId").notNull().references(() => multiplayerRooms.id, { onDelete: "cascade" }),
  seasonId: text("seasonId").notNull().default("season-legacy"),
  hostUserId: int("hostUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  guestUserId: int("guestUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  hostScore: int("hostScore").notNull(),
  guestScore: int("guestScore").notNull(),
  winnerUserId: int("winnerUserId").references(() => users.id, { onDelete: "set null" }),
  hostXp: int("hostXp").notNull(),
  guestXp: int("guestXp").notNull(),
  resultReason: text("resultReason", { enum: ["answers", "timeout"] }).notNull(),
  isSuspicious: int("isSuspicious").notNull().default(0),
  suspicionReason: text("suspicionReason"),
  completedAt: int("completedAt", { mode: "timestamp" }).notNull(),
}, (table) => ({
  roomIndex: index("multiplayer_matches_room_idx").on(table.roomId),
  hostIndex: index("multiplayer_matches_host_idx").on(table.hostUserId, table.completedAt),
  guestIndex: index("multiplayer_matches_guest_idx").on(table.guestUserId, table.completedAt),
}));

export const playerSeasonRewards = sqliteTable("player_season_rewards", {
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  seasonId: text("seasonId").notNull(),
  rewardId: text("rewardId").notNull(),
  claimedAt: int("claimedAt", { mode: "timestamp" }).notNull(),
}, (table) => ({
  primaryKey: primaryKey({ columns: [table.userId, table.seasonId, table.rewardId] }),
  userIndex: index("player_season_rewards_user_idx").on(table.userId),
}));

export const pushTokens = sqliteTable("push_tokens", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: int("userId").references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  platform: text("platform"),
  dailyReminders: int("dailyReminders").notNull().default(1),
  createdAt: int("createdAt").notNull(),
  updatedAt: int("updatedAt").notNull(),
}, (table) => ({ tokenUnique: uniqueIndex("push_tokens_token_unique").on(table.token), userIndex: index("push_tokens_user_idx").on(table.userId) }));

export const friendships = sqliteTable("friendships", {
  id: int("id").primaryKey({ autoIncrement: true }),
  requesterId: int("requesterId").notNull().references(() => users.id, { onDelete: "cascade" }),
  addresseeId: int("addresseeId").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["pending", "accepted"] }).notNull().default("pending"),
  createdAt: int("createdAt").notNull(),
  updatedAt: int("updatedAt").notNull(),
}, (table) => ({
  pairUnique: uniqueIndex("friendships_pair_unique").on(table.requesterId, table.addresseeId),
  requesterIndex: index("friendships_requester_idx").on(table.requesterId),
  addresseeIndex: index("friendships_addressee_idx").on(table.addresseeId),
}));

export const questionReports = sqliteTable("question_reports", {
  id: text("id").primaryKey(),
  reporterUserId: int("reporterUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  questionId: text("questionId").notNull(),
  reason: text("reason").notNull(),
  details: text("details"),
  status: text("status", { enum: ["open", "reviewed", "resolved", "rejected"] }).notNull().default("open"),
  createdAt: int("createdAt").notNull(),
  reviewedAt: int("reviewedAt"),
}, (table) => ({
  questionIndex: index("question_reports_question_idx").on(table.questionId, table.status),
  reporterIndex: index("question_reports_reporter_idx").on(table.reporterUserId, table.createdAt),
}));

export const moderationFlags = sqliteTable("moderation_flags", {
  id: text("id").primaryKey(),
  reporterUserId: int("reporterUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectUserId: int("subjectUserId").references(() => users.id, { onDelete: "set null" }),
  matchId: text("matchId").references(() => multiplayerMatches.id, { onDelete: "set null" }),
  reason: text("reason").notNull(),
  evidenceJson: text("evidenceJson").notNull().default("{}"),
  status: text("status", { enum: ["open", "reviewed", "actioned", "dismissed"] }).notNull().default("open"),
  createdAt: int("createdAt").notNull(),
  reviewedAt: int("reviewedAt"),
}, (table) => ({
  statusIndex: index("moderation_flags_status_idx").on(table.status, table.createdAt),
  subjectIndex: index("moderation_flags_subject_idx").on(table.subjectUserId, table.createdAt),
}));

export const privacyRequests = sqliteTable("privacy_requests", {
  id: text("id").primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["export", "delete"] }).notNull(),
  status: text("status", { enum: ["requested", "completed", "failed"] }).notNull().default("requested"),
  requestedAt: int("requestedAt").notNull(),
  completedAt: int("completedAt"),
  resultJson: text("resultJson"),
}, (table) => ({
  userIndex: index("privacy_requests_user_idx").on(table.userId, table.requestedAt),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type PlayerProgress = typeof playerProgress.$inferSelect;
export type SessionRecord = typeof sessionRecords.$inferSelect;
export type FriendChallenge = typeof friendChallenges.$inferSelect;
export type FriendChallengeTurn = typeof friendChallengeTurns.$inferSelect;
export type MultiplayerRoom = typeof multiplayerRooms.$inferSelect;
export type TournamentSeason = typeof tournamentSeasons.$inferSelect;
export type MatchmakingQueueEntry = typeof matchmakingQueue.$inferSelect;
export type MultiplayerMatch = typeof multiplayerMatches.$inferSelect;
export type QuestionReport = typeof questionReports.$inferSelect;
export type ModerationFlag = typeof moderationFlags.$inferSelect;
export type PrivacyRequest = typeof privacyRequests.$inferSelect;
