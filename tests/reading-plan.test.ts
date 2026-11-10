import { describe, expect, it } from "vitest";
import {
  BIBLE_BOOKS,
  DEFAULT_BIBLE_VERSION,
  PAIRING_STATES,
  acceptInvite,
  advancePairing,
  createPairing,
  createReadingPortion,
  isQuizReady,
  nextPairingState,
  portionError,
} from "../domain/reading-plan";
import { FEATURE_FLAGS, featureOn } from "../domain/feature-flags";

describe("shared reading: flag", () => {
  it("is OFF by default", () => {
    expect(FEATURE_FLAGS.sharedReading).toBe(false);
    expect(featureOn("sharedReading")).toBe(false);
  });
});

describe("shared reading: portion model", () => {
  it("holds the canonical 66 books and 1,189 chapters", () => {
    expect(BIBLE_BOOKS).toHaveLength(66);
    expect(BIBLE_BOOKS.reduce((n, b) => n + b.chapters, 0)).toBe(1189);
  });

  it("defaults the version to KJV", () => {
    expect(DEFAULT_BIBLE_VERSION).toBe("KJV");
    const r = createReadingPortion({ book: "Matthew", startChapter: 1, endChapter: 7, lengthDays: 3 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.version).toBe("KJV");
      expect(isQuizReady(r.value)).toBe(true);
    }
  });

  it("accepts 3, 7, 14 and 30 day lengths only", () => {
    for (const d of [3, 7, 14, 30]) {
      expect(createReadingPortion({ book: "John", startChapter: 1, endChapter: 2, lengthDays: d }).ok).toBe(true);
    }
    for (const d of [0, 1, 5, 31, 90]) {
      expect(createReadingPortion({ book: "John", startChapter: 1, endChapter: 2, lengthDays: d }).ok).toBe(false);
    }
  });

  it("checks the chapter range against the book", () => {
    expect(portionError({ book: "Obadiah", startChapter: 1, endChapter: 1, lengthDays: 3, version: "KJV" })).toBeNull();
    expect(portionError({ book: "Obadiah", startChapter: 1, endChapter: 2, lengthDays: 3, version: "KJV" })).not.toBeNull();
    expect(portionError({ book: "Matthew", startChapter: 0, endChapter: 2, lengthDays: 3, version: "KJV" })).not.toBeNull();
    expect(portionError({ book: "Matthew", startChapter: 5, endChapter: 2, lengthDays: 3, version: "KJV" })).not.toBeNull();
    expect(portionError({ book: "Matthew", startChapter: 1.5, endChapter: 2, lengthDays: 3, version: "KJV" })).not.toBeNull();
    expect(portionError({ book: "Nowhere", startChapter: 1, endChapter: 1, lengthDays: 3, version: "KJV" })).not.toBeNull();
  });

  it("holds other translation codes, but only KJV is quiz-ready", () => {
    const nlt = createReadingPortion({ book: "Psalms", startChapter: 23, endChapter: 23, lengthDays: 3, version: "NLT" });
    expect(nlt.ok).toBe(true);
    if (nlt.ok) expect(isQuizReady(nlt.value)).toBe(false);
    const msg = createReadingPortion({ book: "Psalms", startChapter: 23, endChapter: 23, lengthDays: 3, version: "MSG" });
    expect(msg.ok).toBe(true);
    expect(createReadingPortion({ book: "Psalms", startChapter: 23, endChapter: 23, lengthDays: 3, version: "kjv" }).ok).toBe(false);
  });
});

describe("shared reading: partner pairing", () => {
  const portion = () => {
    const r = createReadingPortion({ book: "Matthew", startChapter: 1, endChapter: 7, lengthDays: 3 });
    if (!r.ok) throw new Error("portion should be valid");
    return r.value;
  };

  it("walks invited -> portion chosen -> reading -> finished -> duel ready, in that order", () => {
    expect(PAIRING_STATES).toEqual(["invited", "portion_chosen", "reading", "finished", "duel_ready"]);
    expect(nextPairingState("invited")).toBe("portion_chosen");
    expect(nextPairingState("portion_chosen")).toBe("reading");
    expect(nextPairingState("reading")).toBe("finished");
    expect(nextPairingState("finished")).toBe("duel_ready");
    expect(nextPairingState("duel_ready")).toBeNull();

    let p = acceptInvite(createPairing("p1", "a", "2026-11-10T00:00:00Z"), "b");
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    const steps = [portion(), undefined, undefined, undefined];
    let cur = p.value;
    const seen: string[] = [cur.state];
    for (const s of steps) {
      const r = advancePairing(cur, s);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      cur = r.value;
      seen.push(cur.state);
    }
    expect(seen).toEqual(["invited", "portion_chosen", "reading", "finished", "duel_ready"]);
    expect(advancePairing(cur).ok).toBe(false);
  });

  it("will not choose a portion without a partner, or with a bad one", () => {
    const base = createPairing("p2", "a", "2026-11-10T00:00:00Z");
    expect(advancePairing(base, portion()).ok).toBe(false);
    const paired = acceptInvite(base, "b");
    if (!paired.ok) throw new Error("accept should work");
    expect(advancePairing(paired.value).ok).toBe(false);
    const bad = { ...portion(), lengthDays: 5 as 3 };
    expect(advancePairing(paired.value, bad).ok).toBe(false);
  });

  it("refuses self-pairing and a second partner", () => {
    const base = createPairing("p3", "a", "2026-11-10T00:00:00Z");
    expect(acceptInvite(base, "a").ok).toBe(false);
    const b = acceptInvite(base, "b");
    if (!b.ok) throw new Error("accept should work");
    expect(acceptInvite(b.value, "c").ok).toBe(false);
    expect(acceptInvite(b.value, "b").ok).toBe(true);
  });
});
