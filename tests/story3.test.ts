import { describe, it, expect } from "vitest";
import { story3Apply, story3Ad, ST3_ID } from "../server/v3/story3";
const D = "2026-10-24";
describe("v3.11 story energy + stars", () => {
  it("ids", () => { expect(ST3_ID.test("gen.4")).toBe(true); expect(ST3_ID.test("1sa.b")).toBe(true); expect(ST3_ID.test("mgen.12")).toBe(true); expect(ST3_ID.test("gen")).toBe(false); expect(ST3_ID.test("gen.123")).toBe(false); });
  it("stars: 7-8 = 1, 9 = 2, 10 = 2 slow / 3 fast; boss 13 = 1, 14 = 2, 15 fast = 3", () => {
    const s: any = {};
    expect(story3Apply(s, "gen.1", 10, 6, false, D)!.stars).toBe(0);
    expect(story3Apply(s, "gen.2", 10, 7, false, D)!.stars).toBe(1);
    expect(story3Apply(s, "gen.3", 10, 9, false, D)!.stars).toBe(2);
    expect(story3Apply(s, "gen.4", 10, 10, false, D)!.stars).toBe(2);
    expect(story3Apply(s, "gen.5", 10, 10, true, D)!.stars).toBe(3);
    const b: any = {};
    expect(story3Apply(b, "gen.b", 15, 12, true, D)!.stars).toBe(0);
    expect(story3Apply(b, "gen.b", 15, 13, true, D)!.stars).toBe(1);
    expect(story3Apply(b, "gen.b", 15, 15, true, D)!.stars).toBe(3);
    expect(b.st3["gen.b"]).toBe(3);
  });
  it("wrong length is not counted", () => { const s: any = {}; const r = story3Apply(s, "gen.1", 9, 9, true, D)!; expect(r.counted).toBe(false); expect(s.st3).toBeUndefined(); });
  it("energy: 5 new-level attempts a day, replays free, ad +1 once, refills next day", () => {
    const s: any = {};
    for (let i = 1; i <= 5; i++) expect(story3Apply(s, "gen." + i, 10, 3, false, D)!.energyOut).toBe(false);
    const out = story3Apply(s, "gen.6", 10, 10, true, D)!;
    expect(out.energyOut).toBe(true); expect(out.stars).toBe(0); expect(s.st3["gen.6"]).toBeUndefined();
    s.st3["gen.9"] = 2; expect(story3Apply(s, "gen.9", 10, 10, true, D)!.energyOut).toBe(false); // replay of a passed level is free
    expect(s.st3["gen.9"]).toBe(3);
    expect(story3Ad(s, D).ok).toBe(true); expect(story3Ad(s, D).ok).toBe(false);
    const r = story3Apply(s, "gen.6", 10, 8, false, D)!; expect(r.energyOut).toBe(false); expect(r.stars).toBe(1); expect(r.energy.left).toBe(0);
    const n = story3Apply(s, "gen.7", 10, 8, false, "2026-10-25")!; expect(n.energyOut).toBe(false); expect(n.energy.left).toBe(4);
  });
  it("best stars are kept", () => { const s: any = { st3: { "exo.1": 3 } }; story3Apply(s, "exo.1", 10, 7, false, D); expect(s.st3["exo.1"]).toBe(3); });
});
