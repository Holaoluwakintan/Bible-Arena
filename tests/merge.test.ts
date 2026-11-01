import { describe, it, expect } from "vitest";
import { mergeStats, mergePlayerRows } from "../server/v3/merge";

// A Google player with story progress, and a fresh guest (after a reinstall) who played a little before signing in again.
const account = {
  name: "Ayo", church: "Grace Chapel", xp: 23104, streak: 4, best_streak: 9, last_day: "2026-10-30", rounds: 56,
  achievements: ["first_round", "story_1"],
  stats: { rounds: 56, correct: 400, answered: 560, bestCombo: 12, perfect: 3, streakSaves: 1, dailies: 10,
    st3: { "gen.1": 3, "gen.2": 2, "gen.b": 1 }, st3e: { d: "2026-10-30", u: 3, a: 0 }, endless: 4, story: { gen: 8 } },
};
const guest = {
  name: "Ayo", church: "", xp: 300, streak: 1, best_streak: 1, last_day: "2026-11-01", rounds: 2,
  achievements: ["first_round"],
  stats: { rounds: 2, correct: 15, answered: 20, bestCombo: 6, perfect: 0, streakSaves: 0, dailies: 1,
    st3: { "gen.1": 1, "exo.1": 2 }, st3e: { d: "2026-11-01", u: 2, a: 0 }, endless: 1, story: { gen: 9 } },
};

describe("v3.12.0 guest -> Google merge", () => {
  it("never wipes story stars (the old merge turned objects into NaN -> null)", () => {
    const s = mergeStats(account.stats, guest.stats) as any;
    expect(s.st3).toEqual({ "gen.1": 3, "gen.2": 2, "gen.b": 1, "exo.1": 2 });
    expect(s.story).toEqual({ gen: 9 });
    expect(JSON.parse(JSON.stringify(s))).toEqual(s); // nothing that serialises to null
    for (const v of Object.values(s)) expect(v).not.toBeNull();
  });
  it("adds counters, keeps records at the higher value", () => {
    const s = mergeStats(account.stats, guest.stats) as any;
    expect(s.rounds).toBe(58); expect(s.correct).toBe(415); expect(s.answered).toBe(580); expect(s.dailies).toBe(11);
    expect(s.bestCombo).toBe(12); expect(s.endless).toBe(4); expect(s.streakSaves).toBe(1);
    expect(s.st3e).toEqual({ d: "2026-11-01", u: 2, a: 0 }); // newer day's energy
  });
  it("row: XP and rounds add, streak follows the newer day, best streak never drops, church and name kept", () => {
    const m = mergePlayerRows(account, guest);
    expect(m.xp).toBe(23404); expect(m.rounds).toBe(58);
    expect(m.best_streak).toBe(9); expect(m.streak).toBe(1); expect(m.last_day).toBe("2026-11-01");
    expect(m.church).toBe("Grace Chapel"); expect(m.name).toBe("Ayo");
    expect(m.achievements.sort()).toEqual(["first_round", "story_1"]);
  });
  it("an empty new guest changes nothing", () => {
    const m = mergePlayerRows(account, { name: "Player", church: null, xp: 0, streak: 0, best_streak: 0, last_day: null, rounds: 0, achievements: [], stats: {} });
    expect(m.xp).toBe(account.xp); expect(m.streak).toBe(4); expect(m.last_day).toBe("2026-10-30");
    expect(m.stats).toEqual(account.stats); expect(m.church).toBe("Grace Chapel");
  });
  it("same day: streak is the higher one; Date last_day from pg works", () => {
    const m = mergePlayerRows({ ...account, last_day: new Date("2026-11-01T00:00:00Z") }, guest);
    expect(m.streak).toBe(4); expect(m.last_day).toBe("2026-11-01");
  });
  it("a default account name takes the guest's real name; a broken (null) key is repaired from the guest", () => {
    const m = mergePlayerRows({ ...account, name: "Guest Player", stats: { ...account.stats, st3: null } }, guest);
    expect(m.name).toBe("Ayo");
    expect((m.stats as any).st3).toEqual(guest.stats.st3);
  });
});
