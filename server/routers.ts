import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { z } from "zod";
import { recordAuthoritativeSession } from "./authoritative-session";

const gameMode = z.enum(["bible_quiz", "bible_or_myth", "word_puzzle", "daily_challenge"]);
const legacySessionInput = z.object({
  id: z.string().min(1).max(128),
  mode: gameMode,
  score: z.number().int().min(0).max(1_000_000),
  accuracy: z.number().int().min(0).max(100),
  correctAnswers: z.number().int().min(0).max(100),
  totalQuestions: z.number().int().min(1).max(100),
  xpEarned: z.number().int().min(0).max(1_000_000),
  completedAt: z.coerce.date(),
});
const authoritativeSessionInput = z.object({
  id: z.string().min(1).max(128),
  mode: gameMode,
  answers: z.array(z.object({ questionId: z.string().min(1).max(128), answerId: z.string().max(256).nullable() })).min(1).max(20),
});
const roomId = z.string().min(1).max(160);

export const appRouter = router({
  system: router({
    health: publicProcedure.query(() => ({ status: "ok" as const, database: db.checkDatabaseHealth().ok })),
  }),
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  sync: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const cloud = await db.getCloudProgress(ctx.user.id);
      return {
        progress: cloud?.progress
          ? {
              totalXp: cloud.progress.totalXp,
              currentStreak: cloud.progress.currentStreak,
              bestStreak: cloud.progress.bestStreak,
              lastEligibleDate: cloud.progress.lastEligibleDate,
              achievements: JSON.parse(cloud.progress.achievementsJson || "[]"),
            }
          : null,
        sessions: cloud?.sessions ?? [],
      };
    }),
    migrate: protectedProcedure
      .input(z.object({ progress: z.unknown(), sessions: z.array(legacySessionInput).max(50) }))
      .mutation(() => {
        throw new Error("Legacy client progression migration is disabled; complete a new verified session instead.");
      }),
    recordSession: protectedProcedure
      .input(authoritativeSessionInput)
      .mutation(({ ctx, input }) => {
        return recordAuthoritativeSession({ ...input, userId: ctx.user.id });
      }),
  }),
  challenges: router({
    list: protectedProcedure.query(({ ctx }) => db.listUserChallenges(ctx.user.id)),
    create: protectedProcedure
      .input(
        z.object({
          id: z.string().min(1).max(128),
          shareCode: z.string().regex(/^\d{6}$/),
          mode: gameMode,
          expiresAt: z.coerce.date(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.createCloudChallenge({ ...input, creatorUserId: ctx.user.id, createdAt: new Date() })
      ),
    join: protectedProcedure
      .input(z.object({ shareCode: z.string().regex(/^\d{6}$/) }))
      .mutation(({ ctx, input }) => db.joinCloudChallenge(input.shareCode, ctx.user.id)),
    recordTurn: protectedProcedure
      .input(z.object({
        challengeId: z.string().min(1).max(128),
        sessionId: z.string().min(1).max(128),
        mode: gameMode,
        answers: authoritativeSessionInput.shape.answers,
      }))
      .mutation(({ ctx, input }) => {
        const result = recordAuthoritativeSession({ userId: ctx.user.id, id: input.sessionId, mode: input.mode, answers: input.answers });
        return db.recordFriendChallengeTurn({
          challengeId: input.challengeId,
          userId: ctx.user.id,
          sessionId: input.sessionId,
          score: Number(result.score),
          accuracy: Number(result.accuracy),
          completedAt: new Date(Number(result.completedAt) * 1000),
        });
      }),
  }),
  leaderboards: router({
    list: protectedProcedure
      .input(z.object({ scope: z.enum(["weekly", "all_time"]) }))
      .query(async ({ input }) => {
        const rows = await db.getLeaderboardRows(input.scope, new Date());
        return rows.map((row, index) => ({
          playerId: String(row.userId),
          displayName: row.displayName || "Bible Arena Player",
          score: Number(row.score ?? 0),
          sessions: Number(row.sessions ?? 0),
          averageAccuracy: Number(row.averageAccuracy ?? 0),
          rank: index + 1,
        }));
      }),
  }),
  multiplayerRankings: router({
    list: protectedProcedure
      .input(z.object({ scope: z.enum(["weekly", "season", "all_time"]) }))
      .query(({ input }) => db.getMultiplayerRankingRows(input.scope, new Date())),
  }),
  rooms: router({
    create: protectedProcedure
      .input(z.object({ mode: gameMode }))
      .mutation(({ ctx, input }) => db.createMultiplayerRoom(ctx.user.id, input.mode)),
    get: protectedProcedure
      .input(z.object({ roomId }))
      .query(async ({ ctx, input }) => {
        const room = await db.getMultiplayerRoom(input.roomId);
        if (!room || (room.hostUserId !== ctx.user.id && room.guestUserId !== ctx.user.id)) {
          throw new Error("Room not found.");
        }
        if (room.status === "playing" && room.roundDeadline && room.roundDeadline.getTime() <= Date.now()) {
          return db.timeoutRoomRound(room.id, ctx.user.id, room.roundToken, room.roomVersion);
        }
        return room;
      }),
    join: protectedProcedure
      .input(z.object({ roomCode: z.string().regex(/^\d{6}$/) }))
      .mutation(({ ctx, input }) => db.joinMultiplayerRoom(input.roomCode, ctx.user.id)),
    ready: protectedProcedure
      .input(z.object({ roomId, ready: z.boolean(), roomVersion: z.number().int().min(0) }))
      .mutation(({ ctx, input }) =>
        db.setRoomReady(input.roomId, ctx.user.id, input.ready, input.roomVersion)
      ),
    answer: protectedProcedure
      .input(
        z.object({
          roomId,
          questionIndex: z.number().int().min(0).max(20),
          answerId: z.string().nullable(),
          roundToken: z.string().min(1).max(96),
          roomVersion: z.number().int().min(0),
        })
      )
      .mutation(({ ctx, input }) =>
        db.submitRoomAnswer(
          input.roomId,
          ctx.user.id,
          input.questionIndex,
          input.answerId,
          input.roundToken,
          input.roomVersion
        )
      ),
    timeout: protectedProcedure
      .input(
        z.object({
          roomId,
          roundToken: z.string().min(1).max(96),
          roomVersion: z.number().int().min(0),
        })
      )
      .mutation(({ ctx, input }) =>
        db.timeoutRoomRound(input.roomId, ctx.user.id, input.roundToken, input.roomVersion)
      ),
    rematch: protectedProcedure
      .input(z.object({ roomId, roomVersion: z.number().int().min(0) }))
      .mutation(({ ctx, input }) =>
        db.rematchMultiplayerRoom(input.roomId, ctx.user.id, input.roomVersion)
      ),
  }),
  matches: router({
    list: protectedProcedure.query(({ ctx }) => db.listUserMatches(ctx.user.id)),
  }),
  matchmaking: router({
    join: protectedProcedure.mutation(({ ctx }) => db.joinMatchmakingQueue(ctx.user.id)),
    status: protectedProcedure.query(({ ctx }) => db.getMatchmakingQueueStatus(ctx.user.id)),
    leave: protectedProcedure.mutation(({ ctx }) => db.leaveMatchmakingQueue(ctx.user.id)),
  }),
  season: router({
    myProgress: protectedProcedure.query(({ ctx }) => db.getSeasonProgress(ctx.user.id)),
    claimReward: protectedProcedure
      .input(z.object({ seasonId: z.string().min(1), rewardId: z.string().min(1) }))
      .mutation(({ ctx, input }) => db.claimSeasonReward(ctx.user.id, input.seasonId, input.rewardId)),
  }),
  notifications: router({
    registerToken: protectedProcedure
      .input(z.object({ token: z.string().min(1), platform: z.string().optional() }))
      .mutation(({ ctx, input }) => db.registerPushToken(input.token, ctx.user.id, input.platform)),
    updatePreferences: protectedProcedure
      .input(z.object({ dailyReminders: z.boolean() }))
      .mutation(({ ctx, input }) => db.updateNotificationPreferences(ctx.user.id, input.dailyReminders)),
  }),
  friends: router({
    list: protectedProcedure.query(({ ctx }) => db.listFriends(ctx.user.id)),
    search: protectedProcedure
      .input(z.object({ query: z.string().min(2).max(60) }))
      .query(({ ctx, input }) => db.searchUsers(input.query, ctx.user.id)),
    request: protectedProcedure
      .input(z.object({ addresseeId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => db.sendFriendRequest(ctx.user.id, input.addresseeId)),
    respond: protectedProcedure
      .input(z.object({ requestId: z.number().int().positive(), accept: z.boolean() }))
      .mutation(({ ctx, input }) => db.respondFriendRequest(input.requestId, ctx.user.id, input.accept)),
    leaderboard: protectedProcedure.query(({ ctx }) => db.getFriendsLeaderboard(ctx.user.id)),
  }),
  reports: router({
    question: protectedProcedure
      .input(z.object({
        questionId: z.string().min(1).max(128),
        reason: z.enum(["incorrect_answer", "bad_reference", "unclear_wording", "sensitive_content", "other"]),
        details: z.string().max(2_000).optional(),
      }))
      .mutation(({ ctx, input }) => db.createQuestionReport({ ...input, reporterUserId: ctx.user.id })),
    match: protectedProcedure
      .input(z.object({
        subjectUserId: z.number().int().positive().optional(),
        matchId: z.string().max(128).optional(),
        reason: z.enum(["cheating", "abuse", "connection_manipulation", "other"]),
        evidence: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(({ ctx, input }) => db.createModerationFlag({ ...input, reporterUserId: ctx.user.id })),
  }),
  privacy: router({
    export: protectedProcedure.query(({ ctx }) => db.exportUserData(ctx.user.id)),
    deleteAccount: protectedProcedure.mutation(({ ctx }) => {
      db.deleteUserAccount(ctx.user.id);
      return { success: true as const };
    }),
  }),
  moderation: router({
    openFlags: protectedProcedure.query(({ ctx }) => {
      if (db.getUserRole(ctx.user.id) !== "admin") throw new Error("Admin access required.");
      return db.listOpenModerationFlags();
    }),
  }),
});

export type AppRouter = typeof appRouter;
