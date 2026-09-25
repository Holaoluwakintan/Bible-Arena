import { describe, expect, it } from "vitest";

import { buildLearningAnalytics, getAdaptiveDifficulty, getDailyHabitSnapshot, getQuestionsForPack } from "../domain/phase8";
import { generateShareMessage } from "../domain/share";

describe("Phase Eight product helpers", () => {
  it("tracks a daily habit streak from completed sessions", () => {
    const now = new Date("2026-09-25T12:00:00").getTime();
    const snapshot = getDailyHabitSnapshot([{ completedAt: now }, { completedAt: now - 86_400_000 }], now);
    expect(snapshot.completedToday).toBe(true);
    expect(snapshot.streak).toBe(2);
  });

  it("raises adaptive difficulty only after enough strong sessions", () => {
    expect(getAdaptiveDifficulty([{ accuracy: 100 }, { accuracy: 90 }])).toBe("hard");
    expect(getAdaptiveDifficulty([{ accuracy: 60 }, { accuracy: 70 }])).toBe("medium");
    expect(getAdaptiveDifficulty([{ accuracy: 40 }, { accuracy: 50 }])).toBe("easy");
  });

  it("returns verified topic-pack questions", () => {
    const pack = getQuestionsForPack("people-and-places", 5);
    expect(pack).toHaveLength(5);
    expect(pack.every((question) => question.status === "verified" && ["people", "places"].includes(question.category))).toBe(true);
  });

  it("builds analytics from local answer evidence", () => {
    const analytics = buildLearningAnalytics([{ id: "s1", mode: "bible_quiz", score: 100, accuracy: 50, correctAnswers: 1, totalQuestions: 2, xpEarned: 100, completedAt: 1, answers: [{ questionId: "bq-001", answerId: "b" }, { questionId: "bq-002", answerId: "a" }] }]);
    expect(analytics.averageAccuracy).toBe(50);
    expect(analytics.questionsAnswered).toBe(2);
    expect(analytics.weakestCategory).toBe("events");
  });

  it("shares a learning takeaway with a result", () => {
    const message = generateShareMessage({ modeName: "Bible Quiz", score: 100, accuracy: 50, learningNote: "1 answer reviewed with Scripture explanations." });
    expect(message).toContain("Learning takeaway:");
    expect(message).toContain("Scripture explanations");
  });
});
