import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { z } from "zod";

const gameMode = z.enum(["bible_quiz", "bible_or_myth", "word_puzzle", "daily_challenge"]);
const sessionInput = z.object({
  id: z.string().min(1).max(128),
  mode: gameMode,
  score: z.number().int().min(0).max(1_000_000),
  accuracy: z.number().int().min(0).max(100),
  correctAnswers: z.number().int().min(0).max(100),
  totalQuestions: z.number().int().min(1).max(100),
  xpEarned: z.number().int().min(0).max(1_000_000),
  completedAt: z.coerce.date(),
});
const progressInput = z.object({
  totalXp: z.number().int().min(0),
  currentStreak: z.number().int().min(0),
  bestStreak: z.number().int().min(0),
  lastEligibleDate: z.string().nullable(),
  achievementsJson: z.string().max(100_000),
});
const roomId = z.string().min(1).max(160);

export const appRouter = router({
  system: router({
    health: publicProcedure.query(() => ({ status: "ok" as const })),
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
      .input(z.object({ progress: progressInput, sessions: z.array(sessionInput).max(50) }))
      .mutation(async ({ ctx, input }) => {
        await db.saveCloudProgress({ userId: ctx.user.id, ...input.progress });
        for (const session of input.sessions) {
          await db.saveSessionRecord({ ...session, userId: ctx.user.id });
        }
        return { success: true } as const;
      }),
    recordSession: protectedProcedure
      .input(z.object({ progress: progressInput, session: sessionInput }))
      .mutation(async ({ ctx, input }) => {
        await db.saveCloudProgress({ userId: ctx.user.id, ...input.progress });
        await db.saveSessionRecord({ ...input.session, userId: ctx.user.id });
        return { success: true } as const;
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
});

export type AppRouter = typeof appRouter;
