import { describe, it, expect } from "vitest";
import fs from "node:fs";
import * as E from "../server/v3/live-engine";
import { toLive, pickSet, bankMeta, cleanCustom, bookOf, countMatches } from "../server/v3/live-bank";
import { playerView, hostView } from "../server/v3/live";
import { createRequire } from "node:module";
const { parseQuick } = createRequire(import.meta.url)("../web-v3/live-quick.js");

const Q = (n: number): E.LQ[] => Array.from({ length: n }, (_, i) => ({ id: "q" + i, type: "mc", q: `Question ${i}?`, o: ["A", "B", "C", "D"], a: i % 4 }));
const T0 = 1_700_000_000_000;
function room(opts: Partial<Parameters<typeof E.createRoom>[0]> = {}) {
  return E.createRoom({ code: "123456", title: "Grace Chapel Youth Quiz Night", questions: Q(3), timer: 20, now: T0, ...opts });
}
function join(r: E.LRoom, name: string, extra: Record<string, unknown> = {}, now = T0) {
  const j = E.joinRoom(r, { name, ...extra }, now);
  if (!j.ok) throw new Error(j.error);
  return j.player;
}
/** lobby → intro → question; returns the moment answers opened */
function openQ(r: E.LRoom, at: number) { E.advance(r, at); E.tick(r, at + E.INTRO_MS); return at + E.INTRO_MS; }

describe("room lifecycle", () => {
  it("runs lobby → intro → question → reveal → board → … → final", () => {
    const r = room();
    expect(r.phase).toBe("lobby");
    E.advance(r, T0); // no players: cannot start
    expect(r.phase).toBe("lobby");
    const a = join(r, "Ada");
    const t = openQ(r, T0 + 1000);
    expect(r.phase).toBe("question");
    expect(r.qi).toBe(0);
    expect(E.submitAnswer(r, a.token, 0, 0, 1000, t + 1000).ok).toBe(true);
    // everyone answered: reveal comes early (after a short beat), not at the 20 s mark
    expect(E.tick(r, t + 1200)).toBe(false);
    expect(E.tick(r, t + 1900)).toBe(true);
    expect(r.phase).toBe("reveal");
    E.advance(r, t + 3000); expect(r.phase).toBe("board");
    E.advance(r, t + 4000); expect(r.phase).toBe("intro"); expect(r.qi).toBe(1);
    E.tick(r, t + 4000 + E.INTRO_MS); expect(r.phase).toBe("question");
    // nobody answers: closes at time-up plus the grace window
    expect(E.tick(r, t + 4000 + E.INTRO_MS + 20_000)).toBe(false);
    expect(E.tick(r, t + 4000 + E.INTRO_MS + 20_000 + E.GRACE_MS)).toBe(true);
    expect(r.phase).toBe("reveal");
    E.advance(r, t + 40_000); E.advance(r, t + 41_000); // board, Q3 intro
    expect(r.qi).toBe(2);
    E.tick(r, t + 41_000 + E.INTRO_MS); E.advance(r, t + 50_000); // reveal
    E.advance(r, t + 51_000); // last reveal → final (no board)
    expect(r.phase).toBe("final");
    expect(E.joinRoom(r, { name: "Late" }, t + 52_000).ok).toBe(false);
  });

  it("auto-play advances reveal → board → next question by itself", () => {
    const r = room({ auto: true });
    const a = join(r, "Ada");
    const t = openQ(r, T0);
    E.submitAnswer(r, a.token, 0, 0, 500, t + 500);
    E.tick(r, t + 2000); expect(r.phase).toBe("reveal");
    E.tick(r, t + 2000 + E.AUTO_REVEAL_MS); expect(r.phase).toBe("board");
    E.tick(r, t + 2000 + E.AUTO_REVEAL_MS + E.AUTO_BOARD_MS); expect(r.phase).toBe("intro");
  });

  it("rejects late, stale, duplicate and invalid answers", () => {
    const r = room();
    const a = join(r, "Ada"), b = join(r, "Bola");
    const t = openQ(r, T0);
    expect(E.submitAnswer(r, a.token, 1, 0, 0, t + 100)).toMatchObject({ ok: false, code: "stale" });
    expect(E.submitAnswer(r, a.token, 0, 9, 0, t + 100)).toMatchObject({ ok: false, code: "choice" });
    expect(E.submitAnswer(r, "nope", 0, 0, 0, t + 100)).toMatchObject({ ok: false, code: "unknown" });
    const first = E.submitAnswer(r, a.token, 0, 0, 1000, t + 1000);
    const again = E.submitAnswer(r, a.token, 0, 1, 1000, t + 2000);
    expect(again.ok && again.already).toBe(true);
    expect(r.players[a.id].answers["0"].c).toBe(0); // the first tap stands
    expect(first.ok).toBe(true);
    expect(E.submitAnswer(r, b.token, 0, 0, 0, t + 20_000 + E.GRACE_MS + 1)).toMatchObject({ ok: false, code: "closed" });
  });

  it("caps a room at 200 players and lets the host lock and kick", () => {
    const r = room();
    for (let i = 0; i < 200; i++) join(r, "P" + i);
    const full = E.joinRoom(r, { name: "One more" }, T0);
    expect(full.ok).toBe(false);
    expect(!full.ok && full.code).toBe("full");
    const victim = Object.values(r.players)[5];
    expect(E.kick(r, victim.id)).toBe(true);
    expect(E.joinRoom(r, { name: "Now fits" }, T0).ok).toBe(true);
    expect(E.joinRoom(r, { token: victim.token }, T0)).toMatchObject({ ok: false, code: "kicked" });
    r.locked = true;
    expect(E.joinRoom(r, { name: "Locked out" }, T0)).toMatchObject({ ok: false, code: "locked" });
  });

  it("cleans names: duplicates numbered, rude words refused", () => {
    const r = room();
    expect(join(r, "  Grace  ").name).toBe("Grace");
    expect(join(r, "grace").name).toBe("grace 2");
    expect(E.joinRoom(r, { name: "shit head" }, T0).ok).toBe(false);
    expect(E.joinRoom(r, { name: "<script>" }, T0)).toMatchObject({ ok: true });
    expect(Object.values(r.players).some((p) => p.name.includes("<"))).toBe(false);
  });
});

describe("scoring", () => {
  it("gives 500–1000 for a right answer, faster = more, wrong = 0", () => {
    expect(E.scoreAnswer(true, 0, 20_000, 0)).toEqual({ pts: 1000, speed: 500, streak: 0 });
    expect(E.scoreAnswer(true, 10_000, 20_000, 0)).toEqual({ pts: 750, speed: 250, streak: 0 });
    expect(E.scoreAnswer(true, 20_000, 20_000, 0)).toEqual({ pts: 500, speed: 0, streak: 0 });
    expect(E.scoreAnswer(false, 100, 20_000, 4).pts).toBe(0);
  });
  it("adds a streak bonus from the second right answer in a row, capped at +500", () => {
    expect(E.scoreAnswer(true, 20_000, 20_000, 1).streak).toBe(100);
    expect(E.scoreAnswer(true, 20_000, 20_000, 3).streak).toBe(300);
    expect(E.scoreAnswer(true, 20_000, 20_000, 12).streak).toBe(500);
  });
  it("credits slow data up to 2.5 s but never more than the server measured", () => {
    expect(E.effectiveMs(5000, 3500)).toBe(3500);
    expect(E.effectiveMs(5000, 100)).toBe(2500); // a phone cannot claim it was faster than that
    expect(E.effectiveMs(5000, 9000)).toBe(5000);
    expect(E.effectiveMs(5000, "x")).toBe(5000);
  });
  it("scores a full round: speed, streak, misses breaking the run, ranks with tiebreak on time", () => {
    const r = room({ questions: Q(2) });
    const a = join(r, "Ada"), b = join(r, "Bola"), c = join(r, "Chidi");
    let t = openQ(r, T0);
    E.submitAnswer(r, a.token, 0, 0, 2000, t + 2000);  // right, fast
    E.submitAnswer(r, b.token, 0, 0, 10_000, t + 10_000); // right, slower
    E.submitAnswer(r, c.token, 0, 3, 1000, t + 1000);  // wrong
    E.tick(r, t + 10_900);
    expect(r.phase).toBe("reveal");
    expect(r.players[a.id].score).toBe(950);
    expect(r.players[b.id].score).toBe(750);
    expect(r.players[c.id].score).toBe(0);
    expect(E.distribution(r)).toEqual([2, 0, 0, 1]);
    E.advance(r, t + 12_000); E.advance(r, t + 13_000);
    t = t + 13_000 + E.INTRO_MS; E.tick(r, t);
    const q1 = E.submitAnswer(r, a.token, 1, 1, 0, t); // right again → streak +100
    expect(q1.ok && q1.answer.streak).toBe(100);
    expect(q1.ok && q1.answer.pts).toBe(1100);
    E.tick(r, t + 20_000 + E.GRACE_MS); // b and c miss: streaks reset
    expect(r.players[b.id].streak).toBe(0);
    const order = E.ranks(r).map((p) => p.name);
    expect(order).toEqual(["Ada", "Bola", "Chidi"]);
  });
  it("equal score and equal time share a rank", () => {
    const r = room({ questions: Q(1) });
    const a = join(r, "Ada"), b = join(r, "Bola");
    const t = openQ(r, T0);
    E.submitAnswer(r, a.token, 0, 0, 3000, t + 3000);
    E.submitAnswer(r, b.token, 0, 0, 3000, t + 3000);
    const list = E.ranks(r);
    expect(list[0].rank).toBe(1);
    expect(list[1].rank).toBe(1);
  });
});

describe("reconnect", () => {
  it("a returning phone gets its own player back with score and answer intact", () => {
    const r = room();
    const a = join(r, "Ada");
    const t = openQ(r, T0);
    E.submitAnswer(r, a.token, 0, 0, 1000, t + 1000);
    const back = E.joinRoom(r, { token: a.token, name: "Someone else" }, t + 5000);
    expect(back.ok && back.rejoined).toBe(true);
    expect(back.ok && back.player.id).toBe(a.id);
    expect(back.ok && back.player.name).toBe("Ada");
    expect(Object.keys(r.players)).toHaveLength(1);
    // reconnecting mid-question still shows that they already answered
    const view = playerView(r, r.players[a.id], t + 5000);
    expect(view.me.ans.c).toBe(0);
    expect(view.phase).toBe("question");
  });
  it("survives a server restart: the room round-trips through JSON", () => {
    const r = room({ teams: E.makeTeams("men-women") });
    const a = join(r, "Ada", { team: "t1" });
    const t = openQ(r, T0);
    E.submitAnswer(r, a.token, 0, 0, 1000, t + 1000);
    const copy = JSON.parse(JSON.stringify(r)) as E.LRoom;
    expect(E.joinRoom(copy, { token: a.token }, t + 2000)).toMatchObject({ ok: true, rejoined: true });
    expect(copy.players[a.id].score).toBe(r.players[a.id].score);
    expect(E.teamTotals(copy)).toEqual(E.teamTotals(r));
  });
  it("can switch team on rejoin only before the game starts", () => {
    const r = room({ teams: E.makeTeams("youth-choir") });
    const a = join(r, "Ada", { team: "t0" });
    E.joinRoom(r, { token: a.token, team: "t1" }, T0);
    expect(r.players[a.id].team).toBe("t1");
    openQ(r, T0);
    E.joinRoom(r, { token: a.token, team: "t0" }, T0 + 9000);
    expect(r.players[a.id].team).toBe("t1");
  });
});

describe("teams", () => {
  it("presets Youth vs Choir and Men vs Women, and custom names", () => {
    expect(E.makeTeams("youth-choir")!.map((t) => t.name)).toEqual(["Youth", "Choir"]);
    expect(E.makeTeams("men-women")!.map((t) => t.name)).toEqual(["Men", "Women"]);
    expect(E.makeTeams("custom", ["Ushers", "Choir", "Youth"])!.map((t) => t.name)).toEqual(["Ushers", "Choir", "Youth"]);
    expect(E.makeTeams("custom", ["Solo"])).toBeNull();
    expect(E.makeTeams(null)).toBeNull();
  });
  it("puts a player with no pick on the smaller team", () => {
    const r = room({ teams: E.makeTeams("youth-choir") });
    join(r, "A", { team: "t0" }); join(r, "B", { team: "t0" });
    expect(join(r, "C").team).toBe("t1");
  });
  it("ranks teams by average points per member so team size gives no edge", () => {
    const r = room({ teams: E.makeTeams("men-women"), questions: Q(1) });
    const men = [join(r, "M1", { team: "t0" }), join(r, "M2", { team: "t0" }), join(r, "M3", { team: "t0" })];
    const women = [join(r, "W1", { team: "t1" })];
    const t = openQ(r, T0);
    E.submitAnswer(r, men[0].token, 0, 0, 0, t);        // 1000
    E.submitAnswer(r, men[1].token, 0, 0, 20_000, t + 20_000); // 500
    E.submitAnswer(r, men[2].token, 0, 1, 0, t);        // 0
    E.submitAnswer(r, women[0].token, 0, 0, 0, t);      // 1000
    const tt = E.teamTotals(r);
    expect(tt[0]).toMatchObject({ name: "Women", total: 1000, avg: 1000, members: 1 });
    expect(tt[1]).toMatchObject({ name: "Men", total: 1500, avg: 500, members: 3 });
  });
  it("kicked players leave the team totals", () => {
    const r = room({ teams: E.makeTeams("men-women"), questions: Q(1) });
    const m = join(r, "M1", { team: "t0" }); join(r, "M2", { team: "t0" });
    E.kick(r, m.id);
    expect(E.teamTotals(r).find((t) => t.name === "Men")!.members).toBe(1);
  });
});

describe("views never leak the answer early", () => {
  it("hides the right answer from phones and host until reveal", () => {
    const r = room();
    const a = join(r, "Ada");
    E.advance(r, T0);
    expect(playerView(r, r.players[a.id], T0).q.o).toBeUndefined(); // intro: question only
    E.tick(r, T0 + E.INTRO_MS);
    const pv = playerView(r, r.players[a.id], T0 + E.INTRO_MS);
    expect(pv.q.o).toHaveLength(4);
    expect(pv.q.a).toBeUndefined();
    expect(hostView(r).q.a).toBeUndefined();
    E.reveal(r, T0 + 9000);
    expect(hostView(r).q.a).toBe(0);
    expect(playerView(r, r.players[a.id]).q.a).toBe(0);
  });
  it("final summary has podium, teams and stats", () => {
    const r = room({ teams: E.makeTeams("youth-choir"), questions: Q(1) });
    const a = join(r, "Ada"), b = join(r, "Bola"), c = join(r, "Chidi");
    const t = openQ(r, T0);
    E.submitAnswer(r, a.token, 0, 0, 1000, t + 1000);
    E.submitAnswer(r, b.token, 0, 0, 5000, t + 5000);
    E.submitAnswer(r, c.token, 0, 2, 900, t + 900);
    E.finish(r, t + 9000);
    const s = E.summary(r);
    expect(s.podium.map((p) => p.name)).toEqual(["Ada", "Bola", "Chidi"]);
    expect(s.players).toBe(3);
    expect(s.accuracy).toBe(67);
    expect(s.fastest!.name).toBe("Ada");
    expect(s.teams).toHaveLength(2);
  });
});

describe("question bank", () => {
  const bank = JSON.parse(fs.readFileSync("web-v3/bank.json", "utf8")).items;
  it("turns every usable bank item into a valid 2–4 button question", () => {
    let n = 0;
    for (const it of bank) {
      const lq = toLive(it, "s");
      if (!lq) continue;
      n++;
      expect(lq.o.length).toBeGreaterThanOrEqual(2);
      expect(lq.o.length).toBeLessThanOrEqual(4);
      expect(lq.a).toBeGreaterThanOrEqual(0);
      expect(lq.a).toBeLessThan(lq.o.length);
      expect(new Set(lq.o.map((o) => o.toLowerCase())).size).toBe(lq.o.length);
      if (lq.type === "gap") expect(lq.q).toContain("_____");
    }
    expect(n).toBeGreaterThan(900);
  });
  it("complete-the-verse keeps the exact KJV word as the right answer", () => {
    const gap = bank.find((i: any) => i.id === "gap-001");
    const lq = toLive(gap, "b")!;
    expect(lq.q.replace("_____", lq.o[lq.a])).toBe(gap.text);
  });
  it("meta lists categories, levels and books with counts", () => {
    const m = bankMeta(bank);
    expect(m.total).toBeGreaterThan(900);
    expect(m.cats.map((c) => c.id)).toEqual(expect.arrayContaining(["people", "who", "myth", "verse", "said"]));
    expect(m.books.find((b) => b.name === "Genesis")!.count).toBeGreaterThan(50);
    expect(bookOf("Psalm 23:1")).toBe("Psalms");
    expect(bookOf("1 Kings 17:4-6; 18:20")).toBe("1 Kings");
    expect(bookOf("Song of Solomon 2:4")).toBe("Song of Solomon");
  });
  it("picks by category, difficulty and book, spread across categories", () => {
    const set = pickSet(bank, { cats: ["events", "myth", "who"], tiers: ["t"], count: 12 });
    expect(set).toHaveLength(12);
    expect(new Set(set.map((q) => q.cat)).size).toBe(3);
    expect(new Set(set.map((q) => q.id)).size).toBe(12);
    const jonah = pickSet(bank, { books: ["Jonah"], count: 50 });
    expect(jonah.length).toBe(countMatches(bank, { books: ["Jonah"] }));
    expect(jonah.every((q) => /Jonah/.test(q.r || ""))).toBe(true);
    const nt = pickSet(bank, { testament: "nt", count: 20 });
    expect(nt.every((q) => !/^(Genesis|Exodus|Psalms?)/.test(q.r || ""))).toBe(true);
  });
  it("validates a host's custom questions", () => {
    const out = cleanCustom([
      { q: "Who was swallowed by a great fish?", o: ["Jonah", "Peter", "Paul"], a: 0, r: "Jonah 1:17" },
      { q: "Bad: one option", o: ["Only"], a: 0 },
      { q: "Bad: answer out of range", o: ["A", "B"], a: 5 },
      { q: "", o: ["A", "B"], a: 0 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: "custom", o: ["Jonah", "Peter", "Paul"], a: 0, r: "Jonah 1:17" });
  });
});

describe("quick quiz text format", () => {
  it("parses questions, marked answers and references", () => {
    const r = parseQuick(`1. Who was swallowed by a great fish? (Jonah 1:17)
*Jonah
Peter
Elijah

How many days was Jonah in the fish?
A) Two
B) Three *
C) Seven
Ref: Jonah 1:17

Jonah ran away to Tarshish.
*True
False`);
    expect(r.errors).toEqual([]);
    expect(r.questions).toHaveLength(3);
    expect(r.questions[0]).toEqual({ q: "Who was swallowed by a great fish?", o: ["Jonah", "Peter", "Elijah"], a: 0, r: "Jonah 1:17" });
    expect(r.questions[1]).toMatchObject({ o: ["Two", "Three", "Seven"], a: 1, r: "Jonah 1:17" });
    expect(r.questions[2]).toMatchObject({ o: ["True", "False"], a: 0 });
    expect(cleanCustom(r.questions)).toHaveLength(3);
  });
  it("explains what is wrong with a bad block", () => {
    const r = parseQuick(`Who built the ark?\nNoah\nMoses\n\nOnly one answer?\n*Yes`);
    expect(r.questions).toHaveLength(0);
    expect(r.errors[0]).toMatch(/mark the right answer/);
    expect(r.errors[1]).toMatch(/at least 2 answers/);
  });
});
