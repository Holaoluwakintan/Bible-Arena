import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import type { DatabaseSync as Db } from "node:sqlite";
import { createPlan, ensureReadingTables, joinPlan, planViewFor, READING_MEMBER_CAP, tickDay, cleanReaderName } from "../server/v3/reading-store";

// Each test gets its own in-memory database, so nothing here touches the live SQLite file. node:sqlite is loaded through
// createRequire: vitest 2 does not resolve the node: prefix for it.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: new (path: string) => Db };
function fresh(): Db {
  const d = new DatabaseSync(":memory:");
  ensureReadingTables(d);
  return d;
}
const PORTION = { book: "Mark", startChapter: 8, endChapter: 14, lengthDays: 7, version: "KJV", lengthLabel: "7 days" };
const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function makePlan(d: Db) {
  const r = createPlan(d, "owner", { name: "Ada", ...PORTION }, NOW);
  if (!r.ok) throw new Error(r.message);
  const code = (d.prepare("SELECT code FROM v3_reading_plans WHERE id = ?").get(r.value.planId) as { code: string }).code;
  return { planId: r.value.planId, code };
}

function makePlan2(d: Db): string {
  const r = createPlan(d, "owner-2", { name: "B", ...PORTION }, NOW);
  if (!r.ok) throw new Error(r.message);
  return (d.prepare("SELECT code FROM v3_reading_plans WHERE id = ?").get(r.value.planId) as { code: string }).code;
}

describe("shared reading plan: membership cap", () => {
  it("lets 50 members in (owner included) and refuses the 51st with a plain message", () => {
    const d = fresh();
    const { code } = makePlan(d);
    for (let i = 1; i < READING_MEMBER_CAP; i++) {
      const r = joinPlan(d, `member-${i}`, code, `Reader ${i}`, NOW + i);
      expect(r.ok).toBe(true);
    }
    const count = (d.prepare("SELECT COUNT(*) AS n FROM v3_reading_members").get() as { n: number }).n;
    expect(count).toBe(50);
    const full = joinPlan(d, "member-51", code, "Late", NOW + 99);
    expect(full.ok).toBe(false);
    if (!full.ok) {
      expect(full.status).toBe(409);
      expect(full.error).toBe("plan_full");
      expect(full.message).toContain("50 members");
    }
    expect((d.prepare("SELECT COUNT(*) AS n FROM v3_reading_members").get() as { n: number }).n).toBe(50);
    const view = planViewFor(d, "member-1").plan as any;
    expect(view.memberCount).toBe(50);
    expect(view.memberCap).toBe(50);
  });

  it("a repeat join by the same member is harmless and does not take a seat", () => {
    const d = fresh();
    const { code } = makePlan(d);
    expect(joinPlan(d, "m1", code, "A", NOW).ok).toBe(true);
    const again = joinPlan(d, "m1", code, "A", NOW + 1);
    expect(again.ok && again.value.already).toBe(true);
    expect((planViewFor(d, "owner").plan as any).memberCount).toBe(2);
  });

  it("refuses a code that matches no plan, and a person already in another plan", () => {
    const d = fresh();
    const { code } = makePlan(d);
    const bad = joinPlan(d, "m1", "ZZZZZZ", "A", NOW);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toBe("no_such_plan");
    const other = makePlan2(d);
    const clash = joinPlan(d, "owner", other, "Ada", NOW);
    expect(clash.ok).toBe(false);
    if (!clash.ok) expect(clash.error).toBe("already_in_plan");
    // Joining the plan you are already in is not an error.
    expect(joinPlan(d, "owner", code, "Ada", NOW).ok).toBe(true);
    const again = createPlan(d, "owner", { name: "Ada", ...PORTION }, NOW);
    expect(again.ok).toBe(false);
  });
});

describe("shared reading plan: ticks and progress", () => {
  it("a repeat tick of the same day does not double-count", () => {
    const d = fresh();
    const { code } = makePlan(d);
    joinPlan(d, "m1", code, "Ben", NOW);
    const first = tickDay(d, "m1", 1, NOW);
    const second = tickDay(d, "m1", 1, NOW + 5);
    expect(first.ok && first.value.newlyTicked).toBe(true);
    expect(second.ok && second.value.newlyTicked).toBe(false);
    const day1 = (planViewFor(d, "m1").plan as any).days[0];
    expect(day1.readCount).toBe(1);
    expect(day1.readers).toEqual(["Ben"]);
    expect((planViewFor(d, "m1").plan as any).members.find((m: any) => m.name === "Ben").daysRead).toBe(1);
  });

  it("progress counts match the ticks: per day and per member", () => {
    const d = fresh();
    const { code } = makePlan(d);
    joinPlan(d, "m1", code, "Ben", NOW);
    joinPlan(d, "m2", code, "Cy", NOW);
    // One mark per Lagos day, in order: day k is marked on day k-1 of the test (NOW + k days).
    const on = (k: number) => NOW + k * DAY;
    // Ada (owner) reads days 1,2,3 on three days; Ben reads 1 and 2 (a repeat on day 1 does nothing); Cy reads 1,2,3
    // and a repeat of 3 on the same day, and a day 6 that is not today (refused).
    tickDay(d, "owner", 1, on(0)); tickDay(d, "owner", 2, on(1)); tickDay(d, "owner", 3, on(2));
    tickDay(d, "m1", 1, on(0)); tickDay(d, "m1", 1, on(0)); tickDay(d, "m1", 2, on(1));
    tickDay(d, "m2", 1, on(0)); tickDay(d, "m2", 2, on(1)); tickDay(d, "m2", 3, on(2)); tickDay(d, "m2", 3, on(2));
    expect(tickDay(d, "m2", 6, on(2)).ok).toBe(false);
    const view = planViewFor(d, "m2", on(2)).plan as any;
    const readCounts = view.days.map((x: any) => x.readCount);
    expect(readCounts).toEqual([3, 3, 2, 0, 0, 0, 0]);
    expect([...view.days[2].readers].sort()).toEqual(["Ada", "Cy"]);
    const byName = Object.fromEntries(view.members.map((m: any) => [m.name, m.daysRead]));
    expect(byName).toEqual({ Ada: 3, Ben: 2, Cy: 3 });
    expect(view.myTicks).toEqual([1, 2, 3]);
    expect(view.members.find((m: any) => m.isYou).name).toBe("Cy");
  });

  it("refuses a tick from a non-member and a day outside the plan", () => {
    const d = fresh();
    makePlan(d);
    const stranger = tickDay(d, "nobody", 1, NOW);
    expect(stranger.ok).toBe(false);
    if (!stranger.ok) expect(stranger.status).toBe(403);
    const low = tickDay(d, "owner", 0, NOW);
    const high = tickDay(d, "owner", 8, NOW);
    const frac = tickDay(d, "owner", 1.5, NOW);
    expect(low.ok || high.ok || frac.ok).toBe(false);
    expect((planViewFor(d, "owner").plan as any).days.every((x: any) => x.readCount === 0)).toBe(true);
  });
});

describe("shared reading plan: input", () => {
  it("cleans a reader name and falls back to Reader", () => {
    expect(cleanReaderName("  <b>Ada</b>  ")).not.toMatch(/[<>]/);
    expect(cleanReaderName("  Ada   Lin  ")).toBe("Ada Lin");
    expect(cleanReaderName("")).toBe("Reader");
    expect(cleanReaderName(undefined)).toBe("Reader");
    expect(cleanReaderName("x".repeat(60)).length).toBe(24);
  });

  it("refuses an unknown Bible version and an impossible chapter range", () => {
    const d = fresh();
    const bad = createPlan(d, "o1", { name: "A", ...PORTION, version: "XYZ" }, NOW);
    expect(bad.ok).toBe(false);
    const range = createPlan(d, "o1", { name: "A", ...PORTION, endChapter: 99 }, NOW);
    expect(range.ok).toBe(false);
  });
});
