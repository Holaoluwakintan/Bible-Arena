import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import type { DatabaseSync as Db } from "node:sqlite";
import {
  BIBLE_BOOKS, buildReadingPortion, chaptersIn, dailyReadings, daysForPace, portionError, refFor, scopeBooks, scopeLabel,
  type ReadingPortion,
} from "../domain/reading-plan";
import { createPlan, ensureReadingTables, joinPlan, planViewFor, tickDay } from "../server/v3/reading-store";

// Scope tests: one book, several books, the New Testament, the Old Testament and the whole Bible, and the days each
// makes from its chapters and a pace. Each database is in memory, so nothing here touches the live SQLite file.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: new (path: string) => Db };
const NOW = 1_800_000_000_000;
function fresh(): Db {
  const d = new DatabaseSync(":memory:");
  ensureReadingTables(d);
  return d;
}
function codeOf(d: Db, planId: string): string {
  return (d.prepare("SELECT code FROM v3_reading_plans WHERE id = ?").get(planId) as { code: string }).code;
}
const TEN_BOOKS = ["Ruth", "Ezra", "Esther", "Job", "Proverbs", "Isaiah", "Jonah", "Mark", "Romans", "Jude"];

describe("reading scope: chapter counts", () => {
  it("counts the New Testament as 260 chapters in 27 books", () => {
    const nt = scopeBooks("nt");
    expect(nt.ok).toBe(true);
    if (!nt.ok) return;
    expect(nt.value).toHaveLength(27);
    expect(nt.value[0].name).toBe("Matthew");
    expect(nt.value[26].name).toBe("Revelation");
    expect(chaptersIn(nt.value)).toBe(260);
  });

  it("counts the Old Testament as 929 chapters in 39 books", () => {
    const ot = scopeBooks("ot");
    expect(ot.ok).toBe(true);
    if (!ot.ok) return;
    expect(ot.value).toHaveLength(39);
    expect(ot.value[38].name).toBe("Malachi");
    expect(chaptersIn(ot.value)).toBe(929);
  });

  it("counts the whole Bible as 1189 chapters in 66 books", () => {
    const all = scopeBooks("bible");
    expect(all.ok).toBe(true);
    if (!all.ok) return;
    expect(all.value).toHaveLength(66);
    expect(chaptersIn(all.value)).toBe(1189);
    expect(BIBLE_BOOKS.reduce((n, b) => n + b.chapters, 0)).toBe(1189);
  });

  it("counts ten picked books in Bible order, whatever order they were picked in", () => {
    const ten = scopeBooks("books", [...TEN_BOOKS].reverse());
    expect(ten.ok).toBe(true);
    if (!ten.ok) return;
    expect(ten.value.map((b) => b.name)).toEqual(TEN_BOOKS.slice().sort((a, b) => BIBLE_BOOKS.findIndex((x) => x.name === a) - BIBLE_BOOKS.findIndex((x) => x.name === b)));
    expect(ten.value).toHaveLength(10);
    expect(chaptersIn(ten.value)).toBe(4 + 10 + 10 + 42 + 31 + 66 + 4 + 16 + 16 + 1);
  });

  it("refuses an empty pick and an unknown book", () => {
    expect(scopeBooks("books", []).ok).toBe(false);
    expect(scopeBooks("books", undefined).ok).toBe(false);
    expect(scopeBooks("books", ["Nowhere"]).ok).toBe(false);
  });

  it("labels a plan in plain words", () => {
    const nt = scopeBooks("nt");
    const bible = scopeBooks("bible");
    if (!nt.ok || !bible.ok) throw new Error("scope");
    expect(scopeLabel("nt", nt.value)).toBe("New Testament");
    expect(scopeLabel("bible", bible.value)).toBe("The whole Bible");
    expect(scopeLabel("books", [BIBLE_BOOKS[0], BIBLE_BOOKS[1]])).toBe("Genesis and Exodus");
    expect(scopeLabel("books", BIBLE_BOOKS.slice(0, 10))).toBe("10 books");
  });
});

describe("reading scope: days from chapters and pace", () => {
  it("makes ceil(chapters / pace) days", () => {
    expect(daysForPace(260, 3)).toEqual({ ok: true, value: 87 });
    expect(daysForPace(1189, 4)).toEqual({ ok: true, value: 298 });
    expect(daysForPace(929, 1)).toEqual({ ok: true, value: 929 });
    expect(daysForPace(260, "3")).toEqual({ ok: true, value: 87 });
    expect(daysForPace(260, 0).ok).toBe(false);
    expect(daysForPace(260, 2.5).ok).toBe(false);
    expect(daysForPace(260, "").ok).toBe(false);
  });

  it("refuses a pace that runs past ten years", () => {
    expect(daysForPace(1189, 1).ok).toBe(true);
    expect(daysForPace(3651, 1).ok).toBe(false);
  });
});

describe("reading scope: portions keep the existing single-book shape", () => {
  it("builds one book exactly as before", () => {
    const r = buildReadingPortion({ scope: "book", book: "Matthew", startChapter: 1, endChapter: 28, lengthDays: 7, version: "KJV" });
    expect(r).toEqual({ ok: true, value: { book: "Matthew", startChapter: 1, endChapter: 28, lengthDays: 7, version: "KJV" } });
  });

  it("builds one book at a pace: 28 chapters at 4 a day is 7 days", () => {
    const r = buildReadingPortion({ scope: "book", book: "Matthew", startChapter: 1, endChapter: 28, chaptersPerDay: 4, version: "KJV" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.lengthDays).toBe(7);
    expect(r.value.lengthLabel).toBe("4 chapters a day");
    expect(r.value.books).toBeUndefined();
  });

  it("rejects a multi-book portion whose chapters do not match its books", () => {
    const bad: ReadingPortion = { book: "New Testament", startChapter: 1, endChapter: 259, lengthDays: 10, version: "KJV", books: ["Matthew"] };
    expect(portionError(bad)).not.toBeNull();
    const unknown: ReadingPortion = { book: "x", startChapter: 1, endChapter: 1, lengthDays: 1, version: "KJV", books: ["Nowhere"] };
    expect(portionError(unknown)).toBe("unknown book: Nowhere");
  });
});

describe("reading scope: the days cover every chapter once, in order", () => {
  function coverage(d: Db, planId: string) {
    const view = planViewFor(d, "owner") as { plan: { days: Array<{ day: number; startChapter: number; endChapter: number; ref: string }>; portion: ReadingPortion } };
    return view.plan;
  }

  it("New Testament at 3 a day: 87 days, Matthew 1–3 first, Revelation last", () => {
    const d = fresh();
    const r = createPlan(d, "owner", { name: "Ada", scope: "nt", lengthDays: 1, chaptersPerDay: 3, version: "KJV" }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const plan = coverage(d, r.value.planId);
    expect(plan.days).toHaveLength(87);
    expect(plan.days[0].ref).toBe("Matthew 1–3");
    expect(plan.days[86].ref).toMatch(/^Revelation \d+–22$/);
    expect(plan.portion.book).toBe("New Testament");
    const covered = plan.days.reduce((n, x) => n + (x.endChapter - x.startChapter + 1), 0);
    expect(covered).toBe(260);
  });

  it("whole Bible at 4 a day: 298 days, every chapter once, and a day that crosses from Malachi to Matthew", () => {
    const d = fresh();
    const r = createPlan(d, "owner", { name: "Ada", scope: "bible", chaptersPerDay: 4, lengthDays: 1, version: "KJV" }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const plan = coverage(d, r.value.planId);
    expect(plan.days).toHaveLength(298);
    expect(plan.days[0].ref).toBe("Genesis 1–4");
    expect(plan.days[297].ref).toMatch(/^Revelation \d+–22$/);
    const covered = plan.days.reduce((n, x) => n + (x.endChapter - x.startChapter + 1), 0);
    expect(covered).toBe(1189);
    const crossings = plan.days.filter((x) => x.ref.includes(" – "));
    expect(crossings.length).toBeGreaterThan(20);
    for (const x of crossings) expect(x.ref).toMatch(/^[1-3]? ?[A-Za-z ]+ \d+ – [1-3]? ?[A-Za-z ]+ \d+$/);
    expect(crossings.some((x) => x.ref.startsWith("Genesis") && x.ref.includes(" – Exodus "))).toBe(true);
  });

  it("Old Testament at a set length of 929 days: one chapter a day, Genesis 1 to Malachi 4", () => {
    const d = fresh();
    const r = createPlan(d, "owner", { name: "Ada", scope: "ot", lengthDays: 929, version: "KJV" }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const plan = coverage(d, r.value.planId);
    expect(plan.days).toHaveLength(929);
    expect(plan.days[0].ref).toBe("Genesis 1");
    expect(plan.days[928].ref).toBe("Malachi 4");
  });

  it("ten picked books at 2 a day: the day count comes from their chapters", () => {
    const d = fresh();
    const r = createPlan(d, "owner", { name: "Ada", scope: "books", books: TEN_BOOKS, chaptersPerDay: 2, lengthDays: 1, version: "KJV" }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const plan = coverage(d, r.value.planId);
    const total = 4 + 10 + 10 + 42 + 31 + 66 + 4 + 16 + 16 + 1;
    expect(plan.days).toHaveLength(Math.ceil(total / 2));
    expect(plan.portion.books).toEqual(TEN_BOOKS.slice().sort((a, b) => BIBLE_BOOKS.findIndex((x) => x.name === a) - BIBLE_BOOKS.findIndex((x) => x.name === b)));
    expect(plan.days[0].ref).toBe("Ruth 1–2");
  });

  it("one book in a plan with scope book still reads Matthew 1–7 per day", () => {
    const d = fresh();
    const r = createPlan(d, "owner", { name: "Ada", scope: "book", book: "Matthew", startChapter: 1, endChapter: 7, lengthDays: 7, version: "KJV" }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const plan = coverage(d, r.value.planId);
    expect(plan.days.map((x) => x.ref)).toEqual(["Matthew 1", "Matthew 2", "Matthew 3", "Matthew 4", "Matthew 5", "Matthew 6", "Matthew 7"]);
  });

  it("a plan made before the scope column existed still loads, as a single book", () => {
    const d = new DatabaseSync(":memory:");
    d.exec(`CREATE TABLE v3_reading_plans (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, owner_open_id TEXT NOT NULL,
      book TEXT NOT NULL, start_chapter INTEGER NOT NULL, end_chapter INTEGER NOT NULL, length_days INTEGER NOT NULL,
      length_label TEXT NOT NULL DEFAULT '', version TEXT NOT NULL DEFAULT 'KJV', created_at INTEGER NOT NULL);
      INSERT INTO v3_reading_plans VALUES ('old', 'OLDPLN', 'o1', 'Mark', 1, 2, 2, '', 'KJV', 1);`);
    ensureReadingTables(d);
    d.exec("INSERT INTO v3_reading_members (open_id, plan_id, name, role, joined_at) VALUES ('o1', 'old', 'Old', 'owner', 1)");
    const view = planViewFor(d, "o1") as { plan: { days: Array<{ ref: string }>; portion: ReadingPortion } };
    expect(view.plan.days.map((x) => x.ref)).toEqual(["Mark 1", "Mark 2"]);
    expect(view.plan.portion.books).toBeUndefined();
  });
});

describe("reading scope: the shared plan still works with the larger plans", () => {
  it("a second member joins the whole-Bible plan, and ticks the last day", () => {
    const d = fresh();
    const made = createPlan(d, "owner", { name: "Ada", scope: "bible", chaptersPerDay: 4, lengthDays: 1, version: "KJV" }, NOW);
    if (!made.ok) throw new Error(made.message);
    const code = codeOf(d, made.value.planId);
    const j = joinPlan(d, "reader-2", code, "Ben", NOW + 1);
    expect(j.ok).toBe(true);
    // One mark per Lagos day: the reader marks day 1 on the first day, then each day after, up to the last.
    const DAY = 24 * 60 * 60 * 1000;
    for (let k = 1; k <= 298; k++) {
      const r = tickDay(d, "reader-2", k, NOW + 2 + k * DAY);
      expect(r.ok && r.value.newlyTicked).toBe(true);
    }
    const beyond = tickDay(d, "reader-2", 299, NOW + 2 + 299 * DAY);
    expect(beyond.ok).toBe(false);
    const view = planViewFor(d, "reader-2", NOW + 2 + 298 * DAY) as { plan: { memberCount: number; myTicks: number[]; days: Array<{ readCount: number }> } };
    expect(view.plan.memberCount).toBe(2);
    expect(view.plan.myTicks).toHaveLength(298);
    expect(view.plan.days[297].readCount).toBe(1);
  });

  it("refuses a create with an unknown scope in plain words", () => {
    const d = fresh();
    const r = createPlan(d, "owner", { name: "Ada", scope: "everything", lengthDays: 3, version: "KJV" }, NOW);
    expect(r.ok).toBe(false);
  });

  it("day list for a multi-book plan is the server's list, written out", () => {
    const portion = buildReadingPortion({ scope: "ot", chaptersPerDay: 100, version: "KJV" });
    if (!portion.ok) throw new Error(portion.error);
    const days = dailyReadings(portion.value);
    expect(days).toHaveLength(10);
    expect(days[0].ref).toBe("Genesis 1 – Leviticus 3"); // 929 chapters over 10 days: 93 a day, earlier days take the extra
    expect(refFor(portion.value, 1, 0)).toBe("");
  });
});
