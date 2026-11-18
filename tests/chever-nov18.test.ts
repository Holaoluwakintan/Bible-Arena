import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import corpus from "../web-v3/vod-365.json";
import { lagosDay, msUntilLagosMidnight, verseForDay } from "../web-v3/daily-verse.mjs";
import { rankOf, RANKS } from "../web-v3/hall-of-fame.mjs";
import { verseOfTheDay } from "../domain/arena";
import { vodForDay } from "../server/v3/vod";

describe("Chever Nov 18 release regressions", () => {
  it("uses the 365 unique verses verified against the KJV reference (review fingerprint)", () => {
    expect(corpus).toHaveLength(365);
    expect(new Set(corpus.map(([, reference]) => reference)).size).toBe(365);
    expect(createHash("sha256").update(JSON.stringify(corpus)).digest("hex")).toBe("faf8ec541e25c98a69647a0809b228c27c63aa2757c4831171149e8a5c463c2c");
  });
  it("rolls the same verse at Lagos midnight on Web, Expo, and the server", () => {
    const before = Date.parse("2026-11-18T22:59:59.999Z");
    expect(lagosDay(before)).toBe("2026-11-18");
    expect(msUntilLagosMidnight(before)).toBe(1);
    expect(lagosDay(before + 1)).toBe("2026-11-19");
    expect(msUntilLagosMidnight(before + 1)).toBe(86_400_000);
    for (const t of [before, before + 1, Date.parse("1969-10-31T20:00:00Z"), Date.parse("2028-02-29T09:00:00Z")]) {
      const [text, ref] = vodForDay(lagosDay(t));
      expect(verseForDay(corpus, lagosDay(t))).toEqual([text, ref]);
      expect(verseOfTheDay(t)).toEqual({ text, ref });
    }
    expect(vodForDay(lagosDay(before))).not.toEqual(vodForDay(lagosDay(before + 1)));
  });
  it("does not silently convert invalid dates to the wrong verse", () => {
    for (const date of ["", "2026-02-29", "2026-11-35"]) {
      expect(verseForDay(corpus, date)).toBeNull();
      expect(() => vodForDay(date)).toThrow(RangeError);
    }
  });
  it("keeps the latest Hall of Fame thresholds, all divisions and sane progress", () => {
    for (const { name, xp } of RANKS) expect(rankOf(xp).name).toBe(name);
    expect(rankOf(2499)).toMatchObject({ name: "Seeker", division: "III", nextXp: 2500 });
    expect(rankOf(500_000)).toMatchObject({ name: "Apostle", division: "III", progress: 1, next: null });
    for (const input of [-1, Infinity, undefined]) expect(rankOf(input)).toMatchObject({ name: "Seeker", division: "I", progress: 0 });
  });
});
