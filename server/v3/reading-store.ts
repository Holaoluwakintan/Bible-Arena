// Chever v3: shared reading plans. One plan, up to 50 members (the owner counts as one), each member joins with the
// plan's invite code. Ticks are one row per member per day (a repeat tick changes nothing). Progress is counted from
// those rows only: no member count, tick count or name is invented.
//
// Storage: the server's SQLite database (tables v3_reading_plans, v3_reading_members, v3_reading_ticks, created here with
// CREATE TABLE IF NOT EXISTS), the same place and pattern as the church registry in churches.ts. Every function takes the
// database handle, so the tests run against an in-memory database.
import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { buildReadingPortion, dailyReadings, KNOWN_BIBLE_VERSIONS, type PortionInput, type ReadingPortion } from "../../domain/reading-plan";

export const READING_MEMBER_CAP = 50;
const CODE_ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I, as in the church codes
const NAME_MAX = 24;

export type ReadingResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string; message: string };
const fail = (status: number, error: string, message: string) => ({ ok: false as const, status, error, message });

export function ensureReadingTables(d: DatabaseSync): void {
  d.exec(`CREATE TABLE IF NOT EXISTS v3_reading_plans (
      id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, owner_open_id TEXT NOT NULL,
      book TEXT NOT NULL, start_chapter INTEGER NOT NULL, end_chapter INTEGER NOT NULL,
      length_days INTEGER NOT NULL, length_label TEXT NOT NULL DEFAULT '', version TEXT NOT NULL DEFAULT 'KJV',
      created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS v3_reading_members (
      open_id TEXT PRIMARY KEY, plan_id TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', joined_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS v3_reading_members_plan ON v3_reading_members(plan_id);
    CREATE TABLE IF NOT EXISTS v3_reading_ticks (
      plan_id TEXT NOT NULL, open_id TEXT NOT NULL, day INTEGER NOT NULL, ticked_at INTEGER NOT NULL,
      PRIMARY KEY (plan_id, open_id, day));
    CREATE INDEX IF NOT EXISTS v3_reading_ticks_day ON v3_reading_ticks(plan_id, day);`);
  // Plans made before the scope choice have no book list: add the column once, empty for a single-book plan.
  const cols = d.prepare("PRAGMA table_info(v3_reading_plans)").all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "scope_books")) d.exec("ALTER TABLE v3_reading_plans ADD COLUMN scope_books TEXT NOT NULL DEFAULT ''");
}

/** A display name a member chose (or "Reader"). Control characters and markup are dropped; the length is capped. */
export function cleanReaderName(v: unknown): string {
  const s = String(v ?? "").replace(/[\u0000-\u001f\u007f<>{}\[\]\\`$]/g, "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
  return s || "Reader";
}

type PlanRow = { id: string; code: string; owner_open_id: string; book: string; start_chapter: number; end_chapter: number; length_days: number; length_label: string; version: string; created_at: number; scope_books: string };
type MemberRow = { open_id: string; plan_id: string; name: string; role: string; joined_at: number };

function newCode(d: DatabaseSync): string {
  for (let attempt = 0; attempt < 8; attempt++) {
    let s = "";
    for (let i = 0; i < 6; i++) s += CODE_ABC[crypto.randomInt(CODE_ABC.length)];
    if (!d.prepare("SELECT 1 FROM v3_reading_plans WHERE code = ?").get(s)) return s;
  }
  throw new Error("reading_code_exhausted");
}

function memberOf(d: DatabaseSync, openId: string): MemberRow | null {
  return (d.prepare("SELECT open_id, plan_id, name, role, joined_at FROM v3_reading_members WHERE open_id = ?").get(openId) as MemberRow | undefined) || null;
}
function planById(d: DatabaseSync, id: string): PlanRow | null {
  return (d.prepare("SELECT * FROM v3_reading_plans WHERE id = ?").get(id) as PlanRow | undefined) || null;
}
function memberCount(d: DatabaseSync, planId: string): number {
  return Number((d.prepare("SELECT COUNT(*) AS n FROM v3_reading_members WHERE plan_id = ?").get(planId) as { n: number }).n) || 0;
}

/** Create a plan. The creator becomes its owner and its first member. A person is in one plan at a time. */
export function createPlan(d: DatabaseSync, openId: string, input: PortionInput & { name?: unknown; lengthLabel?: unknown }, now: number): ReadingResult<{ planId: string }> {
  if (memberOf(d, openId)) return fail(409, "already_in_plan", "You are already in a reading plan. Finish or leave it before you start another.");
  const version = String(input.version ?? "KJV");
  if (!(KNOWN_BIBLE_VERSIONS as readonly string[]).includes(version)) return fail(400, "invalid", "Pick KJV, NLT or MSG.");
  const made = buildReadingPortion({ ...input, version });
  if (!made.ok) return fail(400, "invalid", made.error);
  const label = (String(input.lengthLabel ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 40)) || made.value.lengthLabel || "";
  const id = crypto.randomUUID();
  d.exec("BEGIN IMMEDIATE");
  try {
    const code = newCode(d);
    const p = made.value;
    d.prepare("INSERT INTO v3_reading_plans (id, code, owner_open_id, book, start_chapter, end_chapter, length_days, length_label, version, created_at, scope_books) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, code, openId, p.book, p.startChapter, p.endChapter, p.lengthDays, label, p.version, now, p.books ? JSON.stringify(p.books) : "");
    d.prepare("INSERT INTO v3_reading_members (open_id, plan_id, name, role, joined_at) VALUES (?, ?, ?, 'owner', ?)").run(openId, id, cleanReaderName(input.name), now);
    d.exec("COMMIT");
  } catch (error) { d.exec("ROLLBACK"); throw error; }
  return { ok: true, value: { planId: id } };
}

/** Join a plan by its invite code. Refused with a plain message once the plan holds 50 members. Joining twice is harmless. */
export function joinPlan(d: DatabaseSync, openId: string, rawCode: unknown, name: unknown, now: number): ReadingResult<{ planId: string; already: boolean }> {
  const code = String(rawCode ?? "").trim().toUpperCase();
  if (code.length !== 6) return fail(400, "invalid_code", "Enter the six-letter code.");
  const plan = d.prepare("SELECT id FROM v3_reading_plans WHERE code = ?").get(code) as { id: string } | undefined;
  if (!plan) return fail(404, "no_such_plan", "That code doesn't match a reading plan.");
  const mine = memberOf(d, openId);
  if (mine) {
    if (mine.plan_id === plan.id) return { ok: true, value: { planId: plan.id, already: true } };
    return fail(409, "already_in_plan", "You are already in a reading plan. Finish or leave it before you join another.");
  }
  d.exec("BEGIN IMMEDIATE");
  try {
    if (memberCount(d, plan.id) >= READING_MEMBER_CAP) {
      d.exec("ROLLBACK");
      return fail(409, "plan_full", `This plan already has ${READING_MEMBER_CAP} members, so it can't take another one.`);
    }
    d.prepare("INSERT INTO v3_reading_members (open_id, plan_id, name, role, joined_at) VALUES (?, ?, ?, 'member', ?)").run(openId, plan.id, cleanReaderName(name), now);
    d.exec("COMMIT");
  } catch (error) { d.exec("ROLLBACK"); throw error; }
  return { ok: true, value: { planId: plan.id, already: false } };
}

/** Tick one day as read for one member. Idempotent: a second tick of the same day adds nothing. */
export function tickDay(d: DatabaseSync, openId: string, day: unknown, now: number): ReadingResult<{ newlyTicked: boolean; ticked: number }> {
  const m = memberOf(d, openId);
  if (!m) return fail(403, "not_in_plan", "Join a reading plan first.");
  const plan = planById(d, m.plan_id);
  if (!plan) return fail(404, "no_such_plan", "That reading plan is gone.");
  const n = Number(day);
  if (!Number.isInteger(n) || n < 1 || n > plan.length_days) return fail(400, "invalid_day", `Pick a day from 1 to ${plan.length_days}.`);
  const r = d.prepare("INSERT OR IGNORE INTO v3_reading_ticks (plan_id, open_id, day, ticked_at) VALUES (?, ?, ?, ?)").run(plan.id, openId, n, now);
  return { ok: true, value: { newlyTicked: Number(r.changes) === 1, ticked: myTicks(d, plan.id, openId).length } };
}

function myTicks(d: DatabaseSync, planId: string, openId: string): number[] {
  return (d.prepare("SELECT day FROM v3_reading_ticks WHERE plan_id = ? AND open_id = ? ORDER BY day").all(planId, openId) as Array<{ day: number }>).map((r) => Number(r.day));
}

function portionOf(p: PlanRow): ReadingPortion {
  const books = p.scope_books ? (JSON.parse(p.scope_books) as string[]) : undefined;
  return { book: p.book, startChapter: p.start_chapter, endChapter: p.end_chapter, lengthDays: p.length_days, version: p.version, lengthLabel: p.length_label || undefined, ...(books ? { books } : {}) };
}

/** The plan a member is in, with the shared progress. Counts come straight from the member and tick rows. */
export function planViewFor(d: DatabaseSync, openId: string): { plan: null } | { plan: Record<string, unknown> } {
  const m = memberOf(d, openId);
  if (!m) return { plan: null };
  const p = planById(d, m.plan_id);
  if (!p) return { plan: null };
  const portion = portionOf(p);
  const split = dailyReadings(portion);
  const members = d.prepare("SELECT open_id, name, role, joined_at FROM v3_reading_members WHERE plan_id = ? ORDER BY joined_at ASC, open_id ASC").all(p.id) as MemberRow[];
  const ticks = d.prepare("SELECT t.open_id, t.day, m.name FROM v3_reading_ticks t JOIN v3_reading_members m ON m.open_id = t.open_id WHERE t.plan_id = ? ORDER BY t.day, m.joined_at, t.open_id").all(p.id) as Array<{ open_id: string; day: number; name: string }>;
  const readersByDay = new Map<number, string[]>();
  const countByMember = new Map<string, number>();
  for (const t of ticks) {
    const list = readersByDay.get(Number(t.day)) || [];
    list.push(t.name);
    readersByDay.set(Number(t.day), list);
    countByMember.set(t.open_id, (countByMember.get(t.open_id) || 0) + 1);
  }
  const mine = myTicks(d, p.id, openId);
  return {
    plan: {
      id: p.id,
      code: p.code,
      isOwner: p.owner_open_id === openId,
      portion: { ...portionOf(p), lengthLabel: portion.lengthLabel || undefined },
      days: split.map((x) => ({ day: x.day, startChapter: x.startChapter, endChapter: x.endChapter, ref: x.ref, readers: readersByDay.get(x.day) || [], readCount: (readersByDay.get(x.day) || []).length })),
      members: members.map((x) => ({ name: x.name, role: x.role, isYou: x.open_id === openId, daysRead: countByMember.get(x.open_id) || 0 })),
      memberCount: members.length,
      memberCap: READING_MEMBER_CAP,
      myTicks: mine,
    },
  };
}
