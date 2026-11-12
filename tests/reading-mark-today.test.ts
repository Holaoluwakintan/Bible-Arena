import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import type { DatabaseSync as Db } from "node:sqlite";
import { createPlan, ensureReadingTables, joinPlan, lagosDate, planViewFor, tickDay } from "../server/v3/reading-store";

// Mark as Read: only today's reading can be marked, one mark per Africa/Lagos calendar day, and the next reading opens at
// midnight Lagos (23:00 UTC). In-memory databases only.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: new (path: string) => Db };
const fresh = (): Db => { const d = new DatabaseSync(":memory:"); ensureReadingTables(d); return d; };
const H = 60 * 60 * 1000;
// 2026-11-12 10:00 Lagos (09:00 UTC) and the moments around Lagos midnight.
const NOON_LAGOS = Date.parse("2026-11-12T11:00:00Z");
const JUST_BEFORE_MIDNIGHT = Date.parse("2026-11-12T22:59:30Z"); // 23:59:30 Lagos, Nov 12
const JUST_AFTER_MIDNIGHT = Date.parse("2026-11-12T23:00:30Z");  // 00:00:30 Lagos, Nov 13

function plan(d: Db, lengthDays = 5) {
  const r = createPlan(d, "owner", { name: "Ada", book: "Mark", startChapter: 1, endChapter: 16, lengthDays, version: "KJV", lengthLabel: "" } as any, NOON_LAGOS);
  if (!r.ok) throw new Error(r.message);
  const code = (d.prepare("SELECT code FROM v3_reading_plans WHERE id = ?").get(r.value.planId) as { code: string }).code;
  joinPlan(d, "m1", code, "Ben", NOON_LAGOS);
  return code;
}

describe("Mark as Read: today only, once a Lagos day", () => {
  it("maps instants to Africa/Lagos calendar dates, rolling over at 23:00 UTC", () => {
    expect(lagosDate(JUST_BEFORE_MIDNIGHT)).toBe("2026-11-12");
    expect(lagosDate(JUST_AFTER_MIDNIGHT)).toBe("2026-11-13");
    expect(lagosDate(Date.parse("2026-11-12T23:00:00Z"))).toBe("2026-11-13");
  });

  it("marks today's reading, and a second click the same day does nothing", () => {
    const d = fresh();
    plan(d);
    const first = tickDay(d, "owner", 1, NOON_LAGOS);
    expect(first.ok && first.value.newlyTicked).toBe(true);
    const again = tickDay(d, "owner", 1, NOON_LAGOS + H);
    expect(again.ok && again.value.newlyTicked).toBe(false);
    const later = tickDay(d, "owner", 1, JUST_BEFORE_MIDNIGHT);
    expect(later.ok && later.value.newlyTicked).toBe(false);
    const view = planViewFor(d, "owner", JUST_BEFORE_MIDNIGHT).plan as any;
    expect(view.myTicks).toEqual([1]);
    expect(view.today).toEqual({ day: 1, marked: true });
  });

  it("refuses a day that is not today's reading: a future day, and a second mark on the same day", () => {
    const d = fresh();
    plan(d);
    const future = tickDay(d, "owner", 3, NOON_LAGOS);
    expect(future.ok).toBe(false);
    if (!future.ok) expect(future.error).toBe("not_today");
    tickDay(d, "owner", 1, NOON_LAGOS);
    expect(tickDay(d, "owner", 3, NOON_LAGOS + H).ok).toBe(false);
    // Day 2 is the next day, but today's mark is already in: a second mark the same day does nothing.
    const second = tickDay(d, "owner", 2, NOON_LAGOS + H);
    expect(second.ok && second.value.newlyTicked).toBe(false);
    const view = planViewFor(d, "owner", NOON_LAGOS + H).plan as any;
    expect(view.myTicks).toEqual([1]);
  });

  it("resets at midnight Lagos: the next day's reading can be marked after it, not before", () => {
    const d = fresh();
    plan(d);
    tickDay(d, "owner", 1, JUST_BEFORE_MIDNIGHT);
    expect((planViewFor(d, "owner", JUST_BEFORE_MIDNIGHT).plan as any).today).toEqual({ day: 1, marked: true });
    // Still the same Lagos day: day 2 is not open yet.
    expect(tickDay(d, "owner", 2, JUST_BEFORE_MIDNIGHT).ok && (tickDay(d, "owner", 2, JUST_BEFORE_MIDNIGHT) as any).value.newlyTicked).toBe(false);
    const next = planViewFor(d, "owner", JUST_AFTER_MIDNIGHT).plan as any;
    expect(next.today).toEqual({ day: 2, marked: false });
    const day2 = tickDay(d, "owner", 2, JUST_AFTER_MIDNIGHT);
    expect(day2.ok && day2.value.newlyTicked).toBe(true);
    expect((planViewFor(d, "owner", JUST_AFTER_MIDNIGHT).plan as any).myTicks).toEqual([1, 2]);
  });

  it("members are independent: one member's mark does not mark another's day", () => {
    const d = fresh();
    plan(d);
    expect(tickDay(d, "owner", 1, NOON_LAGOS).ok).toBe(true);
    const ben = tickDay(d, "m1", 1, NOON_LAGOS);
    expect(ben.ok && ben.value.newlyTicked).toBe(true);
    expect((planViewFor(d, "m1", NOON_LAGOS).plan as any).today).toEqual({ day: 1, marked: true });
  });

  it("with every day ticked the plan is done: nothing else can be marked", () => {
    const d = fresh();
    plan(d, 2);
    tickDay(d, "owner", 1, NOON_LAGOS);
    tickDay(d, "owner", 2, NOON_LAGOS + 24 * H);
    const view = planViewFor(d, "owner", NOON_LAGOS + 24 * H).plan as any;
    expect(view.myTicks).toEqual([1, 2]);
    expect(view.today.marked).toBe(true);
    expect(tickDay(d, "owner", 3, NOON_LAGOS + 48 * H).ok).toBe(false);
  });
});
