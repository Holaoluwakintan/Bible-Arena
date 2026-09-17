import { describe, expect, it } from "vitest";

import { mergeCloudState, toRemoteProgress, toRemoteSession } from "../domain/cloud-sync";
import { EMPTY_PROGRESS_STATE, type LocalProgressState } from "../domain/local-storage";

const local: LocalProgressState = {
  ...EMPTY_PROGRESS_STATE,
  progression: { ...EMPTY_PROGRESS_STATE.progression, totalXp: 420 },
  sessions: [{ id: "local-1", mode: "bible_quiz", score: 100, accuracy: 50, correctAnswers: 1, totalQuestions: 2, xpEarned: 150, completedAt: 2_000 }],
  achievements: [{ key: "first_session", name: "First Step", description: "Complete your first game session.", icon: "book.fill", unlockedAt: 2_000 }],
};

describe("Bible Arena cloud sync", () => {
  it("merges cloud records without duplicate sessions or achievements", () => {
    const merged = mergeCloudState(local, {
      progress: { totalXp: 500, currentStreak: 2, bestStreak: 3, lastEligibleDate: "2026-09-16", achievements: [local.achievements[0], { key: "perfect_session", name: "Perfect Form", description: "Perfect", icon: "trophy.fill", unlockedAt: 3_000 }] },
      sessions: [
        { id: "local-1", mode: "bible_quiz", score: 100, accuracy: 50, correctAnswers: 1, totalQuestions: 2, xpEarned: 150, completedAt: new Date(2_000) },
        { id: "cloud-1", mode: "bible_or_myth", score: 500, accuracy: 100, correctAnswers: 5, totalQuestions: 5, xpEarned: 550, completedAt: new Date(3_000) },
      ],
    });
    expect(merged.sessions).toHaveLength(2);
    expect(merged.achievements).toHaveLength(2);
    expect(merged.progression.totalXp).toBe(500);
    expect(merged.progression.bestStreak).toBe(3);
  });

  it("serializes progression and session payloads for protected tRPC procedures", () => {
    const progress = toRemoteProgress(local);
    const session = toRemoteSession(local.sessions[0]);
    expect(progress.achievementsJson).toContain("first_session");
    expect(session.completedAt).toBeInstanceOf(Date);
    expect(session.id).toBe("local-1");
  });
});
