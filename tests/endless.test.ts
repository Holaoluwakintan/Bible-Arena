import { describe, it, expect } from "vitest";
import { endlessApply, EN_ID } from "../server/v3/story3";
const D = "2026-10-24";
describe("v3.11.1 endless", () => {
  it("locked until the Revelation boss is passed", () => { const s: any = {}; const r = endlessApply(s, "e1", 10, 10, true, D)!; expect(r.locked).toBe(true); expect(r.counted).toBe(false); expect(s.endless).toBeUndefined(); });
  it("in order, best level kept, boss every 10th (15 q, 13 to pass)", () => {
    const s: any = { st3: { "rev.b": 1 } };
    expect(endlessApply(s, "e2", 10, 10, true, D)!.locked).toBe(true);
    expect(endlessApply(s, "e1", 10, 7, false, D)!.passed).toBe(true); expect(s.endless).toBe(1);
    for (let n = 2; n <= 9; n++) { s.st3e = null; expect(endlessApply(s, "e" + n, 10, 9, false, D)!.passed).toBe(true); }
    s.st3e = null;
    expect(endlessApply(s, "e10", 10, 10, true, D)!.counted).toBe(false); // a boss needs 15 questions
    expect(endlessApply(s, "e10", 15, 12, true, D)!.passed).toBe(false);
    s.st3e = null; expect(endlessApply(s, "e10", 15, 13, true, D)!.passed).toBe(true); expect(s.endless).toBe(10);
    expect(endlessApply(s, "e3", 10, 3, false, D)!.best).toBe(10); // replaying an old level never lowers the best
  });
  it("shares the story energy", () => {
    const s: any = { st3: { "rev.b": 1 }, st3e: { d: D, u: 5, a: 0 } };
    const r = endlessApply(s, "e1", 10, 10, true, D)!; expect(r.energyOut).toBe(true); expect(s.endless).toBeUndefined();
  });
  it("ids", () => { expect(EN_ID.test("e1")).toBe(true); expect(EN_ID.test("e12345")).toBe(true); expect(EN_ID.test("e123456")).toBe(false); expect(EN_ID.test("gen.1")).toBe(false); });
});
