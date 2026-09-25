import { describe, expect, it } from "vitest";
import {
  calculateSeasonTier,
  isRewardEligible,
  SEASON_TIERS,
  AUTUMN_ASCENSION_REWARDS,
} from "../domain/seasons";
import { getRankedDivision } from "../domain/multiplayer-rankings";

describe("Season Tiers and Progression", () => {
  it("calculates Seedling tier at 0 points", () => {
    const result = calculateSeasonTier(0);
    expect(result.currentTier).toBe("Seedling");
    expect(result.nextTier).toBe("Pathfinder");
    expect(result.pointsToNext).toBe(100);
    expect(result.progressPercent).toBe(0);
  });

  it("calculates partial progression through Pathfinder tier", () => {
    const result = calculateSeasonTier(150);
    expect(result.currentTier).toBe("Pathfinder");
    expect(result.nextTier).toBe("Scribe");
    expect(result.pointsToNext).toBe(150);
    expect(result.progressPercent).toBe(25); // (150 - 100) / (300 - 100) = 50 / 200 = 25%
  });

  it("calculates Elder tier at or above 600 points", () => {
    const result = calculateSeasonTier(750);
    expect(result.currentTier).toBe("Elder");
    expect(result.nextTier).toBeNull();
    expect(result.pointsToNext).toBe(0);
    expect(result.progressPercent).toBe(100);
  });

  it("correctly determines reward eligibility", () => {
    expect(isRewardEligible("Seedling", "Seedling")).toBe(true);
    expect(isRewardEligible("Seedling", "Pathfinder")).toBe(false);
    expect(isRewardEligible("Scribe", "Pathfinder")).toBe(true);
    expect(isRewardEligible("Scribe", "Elder")).toBe(false);
    expect(isRewardEligible("Elder", "Elder")).toBe(true);
  });

  it("has complete rewards catalog matching tiers", () => {
    expect(AUTUMN_ASCENSION_REWARDS.length).toBe(4);
    const requiredTiers = AUTUMN_ASCENSION_REWARDS.map((r) => r.requiredTier);
    expect(requiredTiers).toEqual(["Seedling", "Pathfinder", "Scribe", "Elder"]);
  });

  it("evaluates ranked competitive division from wins and draws", () => {
    expect(getRankedDivision(0, 0)).toBe("Bronze");
    expect(getRankedDivision(1, 0)).toBe("Silver");
    expect(getRankedDivision(2, 2)).toBe("Gold");
    expect(getRankedDivision(5, 0)).toBe("Platinum");
    expect(getRankedDivision(8, 1)).toBe("Diamond");
  });
});
