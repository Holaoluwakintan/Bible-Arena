import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(), openId: varchar("openId", { length: 64 }).notNull().unique(), name: text("name"), email: varchar("email", { length: 320 }), loginMethod: varchar("loginMethod", { length: 64 }), role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(), lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export const playerProgress = mysqlTable("player_progress", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().unique(), totalXp: int("totalXp").default(0).notNull(), currentStreak: int("currentStreak").default(0).notNull(), bestStreak: int("bestStreak").default(0).notNull(), lastEligibleDate: varchar("lastEligibleDate", { length: 10 }), achievementsJson: text("achievementsJson").notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() });
export const sessionRecords = mysqlTable("session_records", { id: varchar("id", { length: 128 }).primaryKey(), userId: int("userId").notNull(), mode: varchar("mode", { length: 32 }).notNull(), score: int("score").notNull(), accuracy: int("accuracy").notNull(), correctAnswers: int("correctAnswers").notNull(), totalQuestions: int("totalQuestions").notNull(), xpEarned: int("xpEarned").notNull(), completedAt: timestamp("completedAt").notNull() });
export const friendChallenges = mysqlTable("friend_challenges", { id: varchar("id", { length: 128 }).primaryKey(), shareCode: varchar("shareCode", { length: 6 }).notNull().unique(), creatorUserId: int("creatorUserId").notNull(), opponentUserId: int("opponentUserId"), mode: varchar("mode", { length: 32 }).notNull(), status: mysqlEnum("status", ["open", "completed", "expired"]).default("open").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), expiresAt: timestamp("expiresAt").notNull() });
export const multiplayerRooms = mysqlTable("multiplayer_rooms", {
  id: varchar("id", { length: 128 }).primaryKey(), roomCode: varchar("roomCode", { length: 6 }).notNull().unique(), hostUserId: int("hostUserId").notNull(), guestUserId: int("guestUserId"), mode: varchar("mode", { length: 32 }).notNull(), status: mysqlEnum("status", ["lobby", "playing", "complete"]).default("lobby").notNull(), currentQuestionIndex: int("currentQuestionIndex").default(0).notNull(), hostReady: int("hostReady").default(0).notNull(), guestReady: int("guestReady").default(0).notNull(), hostAnsweredIndex: int("hostAnsweredIndex").default(-1).notNull(), guestAnsweredIndex: int("guestAnsweredIndex").default(-1).notNull(), hostScore: int("hostScore").default(0).notNull(), guestScore: int("guestScore").default(0).notNull(), winnerUserId: int("winnerUserId"), roundToken: varchar("roundToken", { length: 96 }).default("").notNull(), roundDeadline: timestamp("roundDeadline"), roomVersion: int("roomVersion").default(0).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export const tournamentSeasons = mysqlTable("tournament_seasons", {
  id: varchar("id", { length: 64 }).primaryKey(), name: varchar("name", { length: 128 }).notNull(), startsAt: timestamp("startsAt").notNull(), endsAt: timestamp("endsAt").notNull(), status: mysqlEnum("status", ["active", "completed"]).default("active").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const matchmakingQueue = mysqlTable("matchmaking_queue", {
  id: varchar("id", { length: 128 }).primaryKey(), userId: int("userId").notNull().unique(), seasonId: varchar("seasonId", { length: 64 }).notNull(), division: varchar("division", { length: 32 }).notNull(), rating: int("rating").default(0).notNull(), status: mysqlEnum("status", ["waiting", "matched", "expired"]).default("waiting").notNull(), matchedRoomId: varchar("matchedRoomId", { length: 128 }), createdAt: timestamp("createdAt").defaultNow().notNull(), expiresAt: timestamp("expiresAt").notNull(),
});
export const multiplayerMatches = mysqlTable("multiplayer_matches", {
  id: varchar("id", { length: 160 }).primaryKey(), roomId: varchar("roomId", { length: 128 }).notNull(), seasonId: varchar("seasonId", { length: 64 }).default("season-legacy").notNull(), hostUserId: int("hostUserId").notNull(), guestUserId: int("guestUserId").notNull(), hostScore: int("hostScore").notNull(), guestScore: int("guestScore").notNull(), winnerUserId: int("winnerUserId"), hostXp: int("hostXp").notNull(), guestXp: int("guestXp").notNull(), resultReason: mysqlEnum("resultReason", ["answers", "timeout"]).notNull(), isSuspicious: int("isSuspicious").default(0).notNull(), suspicionReason: text("suspicionReason"), completedAt: timestamp("completedAt").notNull(),
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
