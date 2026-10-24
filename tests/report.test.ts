import { describe, it, expect } from "vitest";
import * as R from "../server/v3/report";

// v3.10 weekly report card: book names, weeks, per-book tallies in SQLite, strongest/weakest picks, weekly totals.
describe("report card", () => {
  it("reads the book from a reference", () => {
    expect(R.bookOf("Genesis 41:15-16")).toBe("Genesis");
    expect(R.bookOf("1 Samuel 17:49")).toBe("1 Samuel");
    expect(R.bookOf("Psalm 23:1")).toBe("Psalms");
    expect(R.bookOf("Song of Solomon 2:1")).toBe("Song of Solomon");
    expect(R.bookOf("3 John 1:4")).toBe("3 John");
    expect(R.bookOf("")).toBe("");
    expect(R.bookOf(undefined)).toBe("");
  });
  it("weeks start on Monday", () => {
    expect(R.weekStart("2026-10-24")).toBe("2026-10-19"); // Saturday
    expect(R.weekStart("2026-10-19")).toBe("2026-10-19"); // Monday
    expect(R.weekStart("2026-10-25")).toBe("2026-10-19"); // Sunday
    expect(R.weekStart("2026-11-02")).toBe("2026-11-02");
  });
  it("tallies books per week, deletes with the account (store swapped for the test; the SQLite store is checked by v3.10/tests/report-sql.mjs)", () => {
    const m = new Map<string, { book: string; right: number; total: number }>();
    R._setReportStore({
      add: (o, w, rows) => { for (const r of rows) { const k = o + "|" + w + "|" + r.book; const x = m.get(k) || { book: r.book, right: 0, total: 0 }; x.right += r.right; x.total += r.total; m.set(k, x); } },
      get: (o, w) => [...m.entries()].filter(([k]) => k.startsWith(o + "|" + w + "|")).map(([, v]) => v),
      prune: () => {}, del: (o) => { let n = 0; for (const k of [...m.keys()]) if (k.startsWith(o + "|")) { m.delete(k); n++; } return n; },
    });
    const refs: Record<string, string> = { a: "Genesis 1:1", b: "Genesis 2:7", c: "Exodus 14:21", d: "Psalm 23:1", e: "nothing" };
    R.tallyBooks("u1", [{ id: "a", correct: true }, { id: "b", correct: false }, { id: "c", correct: true }, { id: "d", correct: true }, { id: "e", correct: true }], (id) => refs[id], "2026-10-24");
    R.tallyBooks("u1", [{ id: "a", correct: true }], (id) => refs[id], "2026-10-25");
    R.tallyBooks("u1", [{ id: "a", correct: false }], (id) => refs[id], "2026-10-26");
    R.tallyBooks("u2", [{ id: "a", correct: true }], (id) => refs[id], "2026-10-24");
    expect(m.get("u1|2026-10-19|Genesis")).toEqual({ book: "Genesis", right: 2, total: 3 });
    expect(m.get("u1|2026-10-19|Psalms")).toEqual({ book: "Psalms", right: 1, total: 1 });
    expect(m.get("u1|2026-10-26|Genesis")).toEqual({ book: "Genesis", right: 0, total: 1 });
    expect(R.deleteReportData("u1")).toBe(4);
    expect(m.size).toBe(1);
  });
  it("picks strongest and weakest books (3+ questions, no overlap)", () => {
    const rows = [
      { book: "Genesis", right: 9, total: 10 }, { book: "Exodus", right: 1, total: 4 }, { book: "Acts", right: 5, total: 5 },
      { book: "John", right: 2, total: 2 }, { book: "Psalms", right: 3, total: 6 }, { book: "Ruth", right: 2, total: 3 },
    ];
    const p = R.pickBooks(rows);
    expect(p.strong.map((x) => x.book)).toEqual(["Acts", "Genesis"]);
    expect(p.weak.map((x) => x.book)).toEqual(["Exodus", "Psalms"]);
    expect(R.pickBooks([{ book: "Acts", right: 3, total: 3 }]).weak).toEqual([]);
    expect(R.pickBooks([]).strong).toEqual([]);
  });
  it("sums a week of rounds", () => {
    const days = [{ d: "2026-10-12", c: 5, t: 10, n: 1 }, { d: "2026-10-19", c: 8, t: 10, n: 1 }, { d: "2026-10-24", c: 12, t: 15, n: 2 }, { d: "2026-10-26", c: 1, t: 1, n: 1 }];
    expect(R.summarize(days, "2026-10-19")).toEqual({ answered: 25, correct: 20, rounds: 3, days: 2, accuracy: 80 });
    expect(R.summarize(days, "2026-10-12")).toEqual({ answered: 10, correct: 5, rounds: 1, days: 1, accuracy: 50 });
    expect(R.summarize([], "2026-10-05").accuracy).toBe(null);
  });
});
