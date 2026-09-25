import { describe, expect, it } from "vitest";

import { getAiAnswer, simulateAiScore } from "../domain/ai-battle";
import { createFriendChallenge, getChallengeStatus, joinFriendChallenge } from "../domain/competitive";
import { buildLocalLeaderboard } from "../domain/leaderboards";
import { getVerifiedQuestions } from "../domain/questions";

const sessions = [
  { id: "s1", mode: "bible_quiz" as const, score: 300, accuracy: 60, correctAnswers: 3, totalQuestions: 5, xpEarned: 350, completedAt: new Date("2026-09-15T10:00:00").getTime() },
  { id: "s2", mode: "bible_or_myth" as const, score: 500, accuracy: 100, correctAnswers: 5, totalQuestions: 5, xpEarned: 550, completedAt: new Date("2026-09-16T10:00:00").getTime() },
];

describe("Bible Arena competitive foundations", () => {
  it("makes deterministic AI choices for each difficulty", () => {
    const question = getVerifiedQuestions(1)[0];
    expect(getAiAnswer(question, "medium", 0)).toEqual(getAiAnswer(question, "medium", 0));
    expect(simulateAiScore(getVerifiedQuestions(5), "easy")).toBeGreaterThanOrEqual(0);
  });

  it("creates, joins, and expires share-code challenges", () => {
    const challenge = createFriendChallenge({ creatorName: "Guest Player", mode: "bible_quiz", createdAt: 100 });
    expect(challenge.shareCode).toHaveLength(6);
    expect(joinFriendChallenge(challenge, "Friend", 101).status).toBe("completed");
    expect(getChallengeStatus({ ...challenge, expiresAt: 100 }, 101)).toBe("expired");
  });

  it("builds all-time and current-week local leaderboard entries", () => {
    const allTime = buildLocalLeaderboard(sessions, { scope: "all_time", now: new Date("2026-09-16T12:00:00").getTime() });
    const weekly = buildLocalLeaderboard(sessions, { scope: "weekly", now: new Date("2026-09-16T12:00:00").getTime() });
    expect(allTime[0].score).toBe(800);
    expect(allTime[0].sessions).toBe(2);
    expect(weekly[0].rank).toBe(1);
  });
});
