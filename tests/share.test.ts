import { describe, expect, it } from "vitest";
import { generateShareMessage, getInspirationalVerse } from "../domain/share";

describe("Viral Share Results Engine", () => {
  it("generates a complete share message with score and streak", () => {
    const message = generateShareMessage({
      modeName: "Bible Quiz",
      score: 850,
      accuracy: 90,
      streak: 7,
      level: 4,
    });

    expect(message).toContain("Bible Arena — Session Result");
    expect(message).toContain("Mode: Bible Quiz");
    expect(message).toContain("Score: 850 pts · Accuracy: 90%");
    expect(message).toContain("Streak: 7 Days 🔥");
    expect(message).toContain("Player Level: 4 🎖️");
    expect(message).toContain("Can you beat my score?");
    expect(message).toContain("https://biblearena.app");
  });

  it("includes challenge codes when provided", () => {
    const message = generateShareMessage({
      modeName: "Friend Challenge",
      score: 500,
      accuracy: 100,
      challengeCode: "FAITH7",
    });

    expect(message).toContain("Challenge Code: FAITH7");
  });

  it("selects deterministic inspirational verses from seed", () => {
    const verse1 = getInspirationalVerse(100);
    const verse2 = getInspirationalVerse(100);
    expect(verse1).toBe(verse2);
    expect(typeof verse1).toBe("string");
    expect(verse1.length).toBeGreaterThan(10);
  });
});
