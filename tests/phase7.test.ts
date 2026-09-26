import { describe, expect, it } from "vitest";
import { getPerfectRoundCelebration, getStreakIdentity } from "../domain/phase7";

describe("phase 7 premium experience primitives", () => {
  it("uses encouraging milestone identities without guilt language", () => {
    expect(getStreakIdentity(3).title).toBe("Bright Beginning");
    expect(getStreakIdentity(7).title).toBe("Weekly Walker");
    expect(getStreakIdentity(30).title).toBe("Steady Scribe");
    expect(getStreakIdentity(100).title).toBe("Faithful Guide");
    expect(getStreakIdentity(2, false).graceMessage).toContain("not a failure");
  });

  it("creates a branded, share-ready perfect-round Scripture card", () => {
    const celebration = getPerfectRoundCelebration(100, 7, "John 3:16");
    expect(celebration.title).toBe("Perfect round");
    expect(celebration.reference).toBe("John 3:16");
    expect(celebration.shareText).toContain("Bible Arena");
    expect(celebration.shareText).toContain("John 3:16");
  });
});
