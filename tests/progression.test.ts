import { describe, expect, it } from "vitest";

import { applyCompletedSession, getLevelForXp, getLevelName, getXpToNextLevel, unlockAchievements, type ProgressionSnapshot } from "../domain/progression";

const empty: ProgressionSnapshot = { totalXp: 0, currentStreak: 0, bestStreak: 0, lastEligibleDate: null, rewardEvents: [] };

describe("Bible Arena progression", () => {
  it("maps XP to level names and next threshold distance", () => {
    expect(getLevelForXp(0)).toBe(1);
    expect(getLevelName(1)).toBe("Scripture Seeker");
    expect(getLevelForXp(500)).toBe(2);
    expect(getXpToNextLevel(500)).toBe(700);
  });

  it("awards completion and correct-answer rewards exactly once", () => {
    const first = applyCompletedSession(empty, { sessionId: "s1", correctAnswers: 2, xpEarned: 250, completedAt: new Date("2026-09-16T10:00:00").getTime() });
    const replay = applyCompletedSession(first, { sessionId: "s1", correctAnswers: 2, xpEarned: 250, completedAt: new Date("2026-09-16T10:00:00").getTime() });
    expect(first.totalXp).toBe(250);
    expect(first.rewardEvents).toHaveLength(3);
    expect(replay).toEqual(first);
  });

  it("awards the daily challenge bonus only once per calendar day", () => {
    const first = applyCompletedSession(empty, { sessionId: "daily-1", mode: "daily_challenge", correctAnswers: 0, xpEarned: 150, completedAt: new Date("2026-09-16T10:00:00").getTime() });
    const second = applyCompletedSession(first, { sessionId: "daily-2", mode: "daily_challenge", correctAnswers: 0, xpEarned: 50, completedAt: new Date("2026-09-16T18:00:00").getTime() });
    expect(first.totalXp).toBe(150);
    expect(second.totalXp).toBe(200);
    expect(second.rewardEvents.filter((event) => event.type === "daily_challenge")).toHaveLength(1);
  });

  it("increments streak only on a consecutive new calendar day", () => {
    const dayOne = applyCompletedSession(empty, { sessionId: "s1", correctAnswers: 0, xpEarned: 50, completedAt: new Date("2026-09-15T10:00:00").getTime() });
    const sameDay = applyCompletedSession(dayOne, { sessionId: "s2", correctAnswers: 0, xpEarned: 50, completedAt: new Date("2026-09-15T18:00:00").getTime() });
    const nextDay = applyCompletedSession(sameDay, { sessionId: "s3", correctAnswers: 0, xpEarned: 50, completedAt: new Date("2026-09-16T09:00:00").getTime() });
    expect(dayOne.currentStreak).toBe(1);
    expect(sameDay.currentStreak).toBe(1);
    expect(nextDay.currentStreak).toBe(2);
    expect(nextDay.bestStreak).toBe(2);
  });

  it("unlocks achievement definitions from progression and history", () => {
    const progression = applyCompletedSession(empty, { sessionId: "s1", mode: "bible_or_myth", correctAnswers: 5, xpEarned: 550, completedAt: new Date("2026-09-16T10:00:00").getTime() });
    const unlocked = unlockAchievements([], { progression, sessions: [{ mode: "bible_or_myth", accuracy: 100 }] }, progression.lastEligibleDate ? new Date(`${progression.lastEligibleDate}T10:00:00`).getTime() : Date.now());
    expect(unlocked.map((achievement) => achievement.key)).toEqual(expect.arrayContaining(["first_session", "perfect_session", "bible_or_myth"]));
  });
});
