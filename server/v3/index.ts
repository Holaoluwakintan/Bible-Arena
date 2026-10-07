// Bible Arena v3 API: server-scored rounds, ranks, achievements, daily challenge, pastor duels
// (challenge links), leaderboards (weekly, all-time, Pastors' League by church, rivals, daily).
// Durable data lives in Postgres (Supabase schema bible_arena) via ./pg.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { COOKIE_NAME } from "../../shared/const";
import { rateLimit } from "../_core/rate-limit";
import { logger } from "../_core/logger";
import { baPool, SCH } from "./pg";
import { compareDuel, sqlDuelRule } from "./duel-outcome";
import { registerLive, flushLive } from "./live";
import { shutdownHooks } from "../persist";

type Tier = "b" | "s" | "t";
type Mode = "arena" | "myth" | "who" | "gap";
interface Item {
  id: string; m: Mode; tiers: Tier[]; k: string; q?: string; o?: string[]; a?: number | string;
  clues?: string[]; text?: string; g?: Record<Tier, { blanks: number[]; decoys: string[] }>; r?: string; x?: string;
}

const WEB_DIR = path.resolve(process.env.V3_WEB_DIR || "web-v3");
let BANK: Item[] = [];
let BY_ID = new Map<string, Item>();
function loadBank() {
  try {
    BANK = JSON.parse(fs.readFileSync(path.join(WEB_DIR, "bank.json"), "utf8")).items as Item[];
    BY_ID = new Map(BANK.map((i) => [i.id, i]));
  } catch (error) {
    logger.error("v3_bank_load_failed", { error: error instanceof Error ? error.message : String(error) });
  }
}

// ---------- scoring (mirrors web-v3/app.js) ----------
export const BASE: Record<Tier, number> = { b: 100, s: 150, t: 200 };
export function timeLimit(item: Item, tier: Tier): number {
  const T: Record<string, Record<Tier, number>> = {
    mc: { b: 30, s: 22, t: 16 }, who_said: { b: 30, s: 22, t: 16 }, tf: { b: 20, s: 15, t: 12 },
    order: { b: 45, s: 40, t: 35 }, who: { b: 60, s: 50, t: 40 }, gap: { b: 0, s: 50, t: 45 },
  };
  return (T[item.k] || T.mc)[tier];
}
const WORD = /[A-Za-z\u2019]+/g;
export function gapAnswer(item: Item, tier: Tier): string[] {
  const toks = (item.text || "").match(WORD) || [];
  return (item.g?.[tier]?.blanks || []).map((i) => toks[i]);
}
export function checkAnswer(item: Item, tier: Tier, choice: unknown): { correct: boolean; partial: number } {
  if (item.k === "gap") {
    const want = gapAnswer(item, tier);
    const got = Array.isArray(choice) ? choice.map(String) : [];
    let n = 0;
    want.forEach((w, i) => { if (got[i] === w) n++; });
    return { correct: n === want.length && want.length > 0, partial: want.length ? n / want.length : 0 };
  }
  if (item.k === "order") return { correct: String(choice) === String(item.a), partial: 0 };
  const ok = String(choice) === String(item.a);
  return { correct: ok, partial: ok ? 1 : 0 };
}
export function scoreOne(item: Item, tier: Tier, correct: boolean, partial: number, ms: number, clues: number, combo: number): number {
  const limit = timeLimit(item, tier);
  const base = BASE[tier];
  if (!correct) return item.k === "gap" ? Math.round(base * 0.3 * partial) : 0;
  const frac = limit ? Math.max(0, Math.min(1, 1 - ms / 1000 / limit)) : 0.5;
  let pts = base * (1 + 0.5 * frac) * (1 + Math.min(combo, 10) * 0.1);
  if (item.k === "who") pts *= [1, 1, 0.75, 0.5, 0.3][Math.max(1, Math.min(4, clues || 4))];
  if (item.k === "gap") pts *= 1.2;
  return Math.round(pts);
}
export function scoreRound(tier: Tier, answers: Array<{ id: string; choice: unknown; ms?: number; clues?: number }>) {
  let combo = 0, best = 0, total = 0, correct = 0;
  const results: Array<{ id: string; correct: boolean; partial: number; points: number }> = [];
  const stat = { gapPerfect: 0, whoFirst: 0, mythRight: 0 };
  for (const a of answers) {
    const item = BY_ID.get(String(a.id));
    if (!item) continue;
    const c = checkAnswer(item, tier, a.choice);
    const ms = Math.max(0, Math.min(Number(a.ms) || 0, 600_000));
    const pts = scoreOne(item, tier, c.correct, c.partial, ms, Number(a.clues) || 4, combo);
    if (c.correct) { combo++; correct++; best = Math.max(best, combo); } else combo = 0;
    if (c.correct && item.k === "gap") stat.gapPerfect++;
    if (c.correct && item.k === "who" && (Number(a.clues) || 4) <= 1) stat.whoFirst++;
    if (c.correct && item.m === "myth") stat.mythRight++;
    total += pts;
    results.push({ id: item.id, correct: c.correct, partial: c.partial, points: pts });
  }
  return { total, correct, count: results.length, bestCombo: best, results, stat };
}

// ---------- ranks & achievements ----------
export const RANKS = [
  { name: "Seeker", xp: 0 }, { name: "Disciple", xp: 600 }, { name: "Servant", xp: 1800 }, { name: "Watchman", xp: 4000 },
  { name: "Scribe", xp: 8000 }, { name: "Elder", xp: 14000 }, { name: "Prophet", xp: 24000 }, { name: "Apostle", xp: 40000 },
];
export function rankOf(xp: number) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  const cur = RANKS[i], next = RANKS[i + 1];
  const span = next ? next.xp - cur.xp : 1;
  const into = xp - cur.xp;
  const div = next ? Math.min(3, Math.floor((into / span) * 3) + 1) : 3;
  return { index: i, name: cur.name, division: ["I", "II", "III"][div - 1], next: next?.name || null, nextXp: next?.xp || null, progress: next ? into / span : 1 };
}
const ACH: Array<[string, (s: any, p: any) => boolean]> = [
  ["first_round", (s) => s.rounds >= 1], ["ten_rounds", (s) => s.rounds >= 10], ["fifty_rounds", (s) => s.rounds >= 50],
  ["perfect", (s) => s.perfect >= 1], ["theologian_perfect", (s) => s.theoPerfect >= 1], ["combo_5", (s) => s.bestCombo >= 5],
  ["combo_10", (s) => s.bestCombo >= 10], ["gap_10", (s) => s.gapPerfect >= 10], ["gap_50", (s) => s.gapPerfect >= 50],
  ["first_clue", (s) => s.whoFirst >= 1], ["myth_buster", (s) => s.mythRight >= 25], ["correct_100", (s) => s.correct >= 100],
  ["correct_500", (s) => s.correct >= 500], ["streak_3", (_s, p) => p.best_streak >= 3], ["streak_7", (_s, p) => p.best_streak >= 7],
  ["streak_30", (_s, p) => p.best_streak >= 30], ["daily_5", (s) => s.dailies >= 5], ["duel_sent", (s) => s.duelsSent >= 1],
  ["duel_won", (s) => s.duelsWon >= 1], ["duel_5", (s) => s.duelsWon >= 5], ["rematch", (s) => s.rematches >= 1],
  ["church", (_s, p) => !!p.church], ["rank_elder", (_s, p) => p.xp >= RANKS[5].xp], ["rank_apostle", (_s, p) => p.xp >= RANKS[7].xp],
];
function evalAchievements(stats: any, player: any): string[] {
  return ACH.filter(([, f]) => { try { return f(stats || {}, player); } catch { return false; } }).map(([k]) => k);
}

// ---------- helpers ----------
function lagosDay(offsetDays = 0): string {
  return new Date(Date.now() + 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
}
function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return undefined;
}
async function who(req: Request): Promise<{ openId: string; name: string } | null> {
  const auth = req.headers.authorization;
  const token = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7).trim() : readCookie(req, COOKIE_NAME);
  const s = await sdk.verifySession(token).catch(() => null);
  return s ? { openId: s.openId, name: s.name } : null;
}
const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max);
const TIERS: Tier[] = ["b", "s", "t"];
const asTier = (v: unknown): Tier => (TIERS.includes(v as Tier) ? (v as Tier) : "b");
function seeded(seed: string) {
  let h = crypto.createHash("sha256").update(seed).digest().readUInt32LE(0);
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1_000_000) / 1_000_000; };
}
function pick(mode: Mode, tier: Tier, n: number, rnd: () => number, exclude = new Set<string>()): string[] {
  const pool = BANK.filter((i) => i.m === mode && i.tiers.includes(tier) && !exclude.has(i.id));
  const out: string[] = [];
  const copy = [...pool];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rnd() * copy.length), 1)[0].id);
  // A thin tier borrows from the tier below it.
  if (out.length < n && tier !== "b") out.push(...pick(mode, tier === "t" ? "s" : "b", n - out.length, rnd, new Set([...exclude, ...out])));
  return out;
}
export function buildSet(kind: string, tier: Tier, seed: string): string[] {
  const rnd = seeded(seed);
  if (kind === "mixed") return [...pick("arena", tier, 4, rnd), ...pick("gap", tier, 2, rnd), ...pick("myth", tier, 2, rnd), ...pick("who", tier, 2, rnd)];
  if (kind === "who") return pick("who", tier, 6, rnd);
  if (kind === "gap") return pick("gap", tier, 8, rnd);
  if (kind === "myth") return pick("myth", tier, 12, rnd);
  return pick("arena", tier, 10, rnd);
}
export function dailySet(day = lagosDay()): string[] {
  const rnd = seeded("daily:" + day);
  return [...pick("arena", "s", 3, rnd), ...pick("gap", "s", 3, rnd), ...pick("myth", "s", 2, rnd), ...pick("who", "s", 2, rnd)];
}
function code(): string {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.randomBytes(6), (b) => A[b % A.length]).join("");
}
async function getPlayer(openId: string) {
  const r = await baPool()!.query(`select * from ${SCH}.players where open_id=$1`, [openId]);
  return r.rows[0] || null;
}
function publicPlayer(p: any) {
  if (!p) return null;
  return { name: p.name, church: p.church, tier: p.tier, xp: p.xp, streak: p.streak, bestStreak: p.best_streak, lastDay: p.last_day, rounds: p.rounds, achievements: p.achievements, stats: p.stats, rank: rankOf(p.xp) };
}
function send(res: Response, status: number, body: unknown) {
  res.status(status).setHeader("Cache-Control", "no-store");
  res.json(body);
}
function guard(fn: (req: Request, res: Response, me: { openId: string; name: string }) => Promise<void>, needAuth = true) {
  return async (req: Request, res: Response) => {
    if (!baPool()) return send(res, 503, { error: "storage_unavailable" });
    try {
      const me = await who(req);
      if (needAuth && !me) return send(res, 401, { error: "sign_in_required" });
      await fn(req, res, me as any);
    } catch (error) {
      logger.error("v3_error", { path: req.path, error: error instanceof Error ? error.message : String(error) });
      send(res, 500, { error: "server_error" });
    }
  };
}

async function applyRound(openId: string, fallbackName: string, opts: { mode: string; tier: Tier; scored: ReturnType<typeof scoreRound>; daily?: boolean; duel?: "sent" | "played" | "won" | "rematch"; won?: number; drawn?: number }) {
  const pool = baPool()!;
  const { scored, tier } = opts;
  const perfect = scored.count > 0 && scored.correct === scored.count;
  const xp = Math.round(scored.total / 10) + scored.correct * 10 + (perfect ? 50 : 0) + (opts.daily ? 100 : 0) + 20;
  const today = lagosDay();
  const yesterday = lagosDay(-1);
  let p = await getPlayer(openId);
  if (!p) {
    await pool.query(`insert into ${SCH}.players(open_id, name) values ($1,$2) on conflict do nothing`, [openId, clean(fallbackName, 40) || "Player"]);
    p = await getPlayer(openId);
  }
  const lastDay = p.last_day ? new Date(p.last_day).toISOString().slice(0, 10) : null;
  const streak = lastDay === today ? p.streak : lastDay === yesterday ? p.streak + 1 : 1;
  const s = { rounds: 0, correct: 0, answered: 0, perfect: 0, theoPerfect: 0, bestCombo: 0, gapPerfect: 0, whoFirst: 0, mythRight: 0, dailies: 0, duelsSent: 0, duelsWon: 0, duelsDrawn: 0, duelsPlayed: 0, rematches: 0, ...(p.stats || {}) };
  s.rounds++; s.correct += scored.correct; s.answered += scored.count;
  if (perfect) s.perfect++;
  if (perfect && tier === "t" && scored.count >= 6) s.theoPerfect++;
  s.bestCombo = Math.max(s.bestCombo, scored.bestCombo);
  s.gapPerfect += scored.stat.gapPerfect; s.whoFirst += scored.stat.whoFirst; s.mythRight += scored.stat.mythRight;
  if (opts.daily) s.dailies++;
  if (opts.duel === "sent") s.duelsSent++;
  if (opts.duel === "played") s.duelsPlayed++;
  if (opts.won) s.duelsWon += opts.won;
  if (opts.drawn) s.duelsDrawn += opts.drawn;
  if (opts.duel === "rematch") { s.rematches++; s.duelsSent++; }
  const newXp = p.xp + xp;
  const bestStreak = Math.max(p.best_streak, streak);
  const before: string[] = Array.isArray(p.achievements) ? p.achievements : [];
  const after = evalAchievements(s, { ...p, xp: newXp, best_streak: bestStreak });
  const merged = Array.from(new Set([...before, ...after]));
  await pool.query(
    `update ${SCH}.players set xp=$2, streak=$3, best_streak=$4, last_day=$5, rounds=rounds+1, stats=$6, achievements=$7, updated_at=now() where open_id=$1`,
    [openId, newXp, streak, bestStreak, today, JSON.stringify(s), JSON.stringify(merged)],
  );
  await pool.query(
    `insert into ${SCH}.rounds(open_id, mode, tier, score, correct, total, xp, day) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [openId, opts.mode, tier, scored.total, scored.correct, scored.count, xp, today],
  );
  const fresh = await getPlayer(openId);
  return { xp, perfect, newAchievements: merged.filter((a) => !before.includes(a)), player: publicPlayer(fresh), rankBefore: rankOf(p.xp), rankAfter: rankOf(newXp) };
}

async function bumpStat(openId: string, key: string, by = 1) {
  const p = await getPlayer(openId);
  if (!p || !by) return;
  const s = { ...(p.stats || {}) };
  s[key] = (s[key] || 0) + by;
  const ach = Array.from(new Set([...(p.achievements || []), ...evalAchievements(s, p)]));
  await baPool()!.query(`update ${SCH}.players set stats=$2, achievements=$3, updated_at=now() where open_id=$1`, [openId, JSON.stringify(s), JSON.stringify(ach)]);
}

async function duelView(codeStr: string, meId?: string) {
  const pool = baPool()!;
  const d = (await pool.query(`select * from ${SCH}.duels where code=$1`, [codeStr])).rows[0];
  if (!d) return null;
  const entries = (await pool.query(
    `select e.open_id, e.name, e.church, e.score, e.correct, e.total, e.time_ms, e.answers, e.progress, e.finished, e.updated_at, p.xp from ${SCH}.duel_entries e left join ${SCH}.players p on p.open_id=e.open_id where e.code=$1 order by e.finished desc, e.score desc, e.time_ms asc limit 60`,
    [codeStr],
  )).rows;
  return {
    code: d.code, mode: d.mode, tier: d.tier, ids: d.question_ids, parent: d.parent_code, createdAt: d.created_at,
    creator: { name: d.creator_name, isMe: meId === d.creator_open_id },
    entries: entries.map((e: any) => ({
      name: e.name, church: e.church, score: e.score, correct: e.correct, total: e.total, timeMs: e.time_ms,
      answers: e.finished ? e.answers : [], progress: e.progress, finished: e.finished, isMe: e.open_id === meId,
      isCreator: e.open_id === d.creator_open_id, rank: rankOf(e.xp || 0).name, updatedAt: e.updated_at,
    })),
  };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const TIER_NAME: Record<string, string> = { b: "Believer", s: "Scholar", t: "Theologian" };
const MODE_NAME: Record<string, string> = { mixed: "Mixed Arena", arena: "Arena Quiz", gap: "Fill in the Gap", who: "Who Am I", myth: "Bible or Myth" };

/** Called when a guest signs in with Google on the web: carry the guest's v3 progress onto the Google account. */
export async function mergeGuestInto(guestOpenId: string, googleOpenId: string): Promise<void> {
  const pool = baPool();
  if (!pool || !guestOpenId.startsWith("guest_") || guestOpenId === googleOpenId) return;
  try {
    const g = await getPlayer(guestOpenId);
    if (!g) return;
    const t = await getPlayer(googleOpenId);
    if (!t) {
      await pool.query(`update ${SCH}.players set open_id=$2, updated_at=now() where open_id=$1`, [guestOpenId, googleOpenId]);
    } else {
      const s: any = { ...(t.stats || {}) };
      for (const [k, v] of Object.entries(g.stats || {})) s[k] = k === "bestCombo" ? Math.max(Number(s[k] || 0), Number(v || 0)) : Number(s[k] || 0) + Number(v || 0);
      const ach = Array.from(new Set([...(t.achievements || []), ...(g.achievements || [])]));
      await pool.query(
        `update ${SCH}.players set xp=xp+$2, best_streak=greatest(best_streak,$3), streak=greatest(streak,$4), rounds=rounds+$5, stats=$6, achievements=$7, name=coalesce(nullif(name,'Player'),$8), church=coalesce(church,$9), updated_at=now() where open_id=$1`,
        [googleOpenId, g.xp, g.best_streak, g.streak, g.rounds, JSON.stringify(s), JSON.stringify(ach), g.name, g.church],
      );
      await pool.query(`delete from ${SCH}.players where open_id=$1`, [guestOpenId]);
    }
    await pool.query(`update ${SCH}.rounds set open_id=$2 where open_id=$1`, [guestOpenId, googleOpenId]);
    await pool.query(`delete from ${SCH}.duel_entries e where e.open_id=$1 and exists(select 1 from ${SCH}.duel_entries x where x.code=e.code and x.open_id=$2)`, [guestOpenId, googleOpenId]);
    await pool.query(`update ${SCH}.duel_entries set open_id=$2 where open_id=$1`, [guestOpenId, googleOpenId]);
    await pool.query(`update ${SCH}.duels set creator_open_id=$2 where creator_open_id=$1`, [guestOpenId, googleOpenId]);
  } catch (error) {
    logger.warn("v3_merge_failed", { error: error instanceof Error ? error.message : String(error) });
  }
}

export function registerV3(app: Express): void {
  loadBank();
  const limitWrites = rateLimit({ windowMs: 60_000, max: 90, name: "v3-writes" });

  registerLive(app, () => BANK as any, WEB_DIR);
  shutdownHooks.push(flushLive);
  app.get("/api/v3/health", (_req, res) => send(res, 200, { ok: true, bank: BANK.length, storage: !!baPool() }));

  app.get("/api/v3/me", guard(async (_req, res, me) => {
    if (!me) return send(res, 200, { user: null, player: null });
    send(res, 200, { user: { openId: me.openId.startsWith("guest_") ? "guest" : "google", name: me.name }, player: publicPlayer(await getPlayer(me.openId)) });
  }, false));

  app.post("/api/v3/player", limitWrites, guard(async (req, res, me) => {
    const b = req.body || {};
    const name = clean(b.name, 40) || me.name || "Player";
    const church = clean(b.church, 60) || null;
    const tier = asTier(b.tier);
    const importXp = Math.max(0, Math.min(Number(b.importXp) || 0, 20000));
    const pool = baPool()!;
    await pool.query(
      `insert into ${SCH}.players(open_id, name, church, tier, xp) values ($1,$2,$3,$4,$5)
       on conflict (open_id) do update set name=excluded.name, church=excluded.church, tier=excluded.tier, updated_at=now()`,
      [me.openId, name, church, tier, importXp],
    );
    if (church) await bumpStat(me.openId, "churchSet");
    send(res, 200, { player: publicPlayer(await getPlayer(me.openId)) });
  }));

  app.get("/api/v3/daily", guard(async (_req, res, me) => {
    const day = lagosDay();
    let played = null;
    if (me) {
      const r = await baPool()!.query(`select score, correct, total from ${SCH}.rounds where open_id=$1 and mode='daily' and day=$2 order by id limit 1`, [me.openId, day]);
      played = r.rows[0] || null;
    }
    send(res, 200, { day, ids: dailySet(day), played });
  }, false));

  app.post("/api/v3/round", limitWrites, guard(async (req, res, me) => {
    const b = req.body || {};
    const tier = asTier(b.tier);
    const mode = clean(b.mode, 20) || "arena";
    const answers = Array.isArray(b.answers) ? b.answers.slice(0, 20) : [];
    const daily = mode === "daily";
    if (daily) {
      const day = lagosDay();
      const want = dailySet(day);
      if (answers.map((a: any) => a.id).join(",") !== want.join(",")) return send(res, 400, { error: "daily_mismatch" });
      const r = await baPool()!.query(`select 1 from ${SCH}.rounds where open_id=$1 and mode='daily' and day=$2 limit 1`, [me.openId, day]);
      if (r.rows.length) return send(res, 409, { error: "daily_done" });
    }
    const scored = scoreRound(daily ? "s" : tier, answers);
    if (!scored.count) return send(res, 400, { error: "no_answers" });
    const applied = await applyRound(me.openId, me.name, { mode, tier: daily ? "s" : tier, scored, daily });
    send(res, 200, { score: scored.total, correct: scored.correct, total: scored.count, bestCombo: scored.bestCombo, results: scored.results, ...applied });
  }));

  // ---- duels (challenge links) ----
  app.post("/api/v3/duels", limitWrites, guard(async (req, res, me) => {
    const b = req.body || {};
    const tier = asTier(b.tier);
    const kind = ["mixed", "arena", "gap", "who", "myth"].includes(b.mode) ? b.mode : "mixed";
    const p = await getPlayer(me.openId);
    const name = clean(b.name, 40) || p?.name || me.name || "A pastor";
    let ids: string[] = Array.isArray(b.ids) ? b.ids.map(String).filter((id: string) => BY_ID.has(id)).slice(0, 12) : [];
    if (ids.length < 4) ids = buildSet(kind, tier, code() + Date.now());
    const parent = b.parent ? clean(b.parent, 12) : null;
    let c = code();
    for (let i = 0; i < 3; i++) {
      try {
        await baPool()!.query(`insert into ${SCH}.duels(code, creator_open_id, creator_name, mode, tier, question_ids, parent_code) values ($1,$2,$3,$4,$5,$6,$7)`, [c, me.openId, name, kind, tier, JSON.stringify(ids), parent]);
        break;
      } catch (e) { if (i === 2) throw e; c = code(); }
    }
    // A set the creator already played (from a results screen) is recorded as their entry, without a second XP award.
    if (Array.isArray(b.answers) && b.answers.length) {
      const ordered = ids.map((id) => b.answers.find((a: any) => String(a?.id) === id) || { id, choice: null, ms: 600000 });
      const scored = scoreRound(tier, ordered);
      const timeMs = ordered.reduce((t: number, a: any) => t + Math.max(0, Math.min(Number(a.ms) || 0, 600000)), 0);
      await baPool()!.query(
        `insert into ${SCH}.duel_entries(code, open_id, name, church, score, correct, total, time_ms, answers, progress, finished) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$7,true) on conflict do nothing`,
        [c, me.openId, name, p?.church || null, scored.total, scored.correct, scored.count, timeMs, JSON.stringify(scored.results.map((r) => r.correct))],
      );
      await bumpStat(me.openId, "duelsSent");
    }
    send(res, 200, { code: c, ids, tier, mode: kind });
  }));

  app.get("/api/v3/duels/mine", guard(async (_req, res, me) => {
    const r = await baPool()!.query(
      `select d.code, d.mode, d.tier, d.creator_name, d.creator_open_id=$1 as mine, d.created_at,
        (select count(*) from ${SCH}.duel_entries x where x.code=d.code and x.finished) as players,
        (select json_agg(json_build_object('name',x.name,'score',x.score,'timeMs',x.time_ms,'finished',x.finished,'me',x.open_id=$1) order by x.score desc, x.time_ms asc) from ${SCH}.duel_entries x where x.code=d.code) as entries
       from ${SCH}.duels d where d.creator_open_id=$1 or exists(select 1 from ${SCH}.duel_entries e where e.code=d.code and e.open_id=$1)
       order by d.created_at desc limit 30`, [me.openId]);
    send(res, 200, { duels: r.rows });
  }));

  app.get("/api/v3/duels/:code", guard(async (req, res, me) => {
    const v = await duelView(clean(req.params.code, 12).toUpperCase(), me?.openId);
    if (!v) return send(res, 404, { error: "not_found" });
    send(res, 200, v);
  }, false));

  app.post("/api/v3/duels/:code/progress", rateLimit({ windowMs: 60_000, max: 120, name: "v3-progress" }), guard(async (req, res, me) => {
    const c = clean(req.params.code, 12).toUpperCase();
    const b = req.body || {};
    const name = clean(b.name, 40) || me.name || "Player";
    await baPool()!.query(
      `insert into ${SCH}.duel_entries(code, open_id, name, church, progress, score, correct)
       select $1,$2,$3,$4,$5,$6,$7 where exists(select 1 from ${SCH}.duels where code=$1)
       on conflict (code, open_id) do update set progress=excluded.progress, score=excluded.score, correct=excluded.correct, updated_at=now()
       where not ${SCH}.duel_entries.finished`,
      [c, me.openId, name, clean(b.church, 60) || null, Math.max(0, Math.min(Number(b.i) || 0, 20)), Math.max(0, Math.min(Number(b.score) || 0, 100000)), Math.max(0, Math.min(Number(b.correct) || 0, 20))],
    );
    send(res, 200, { ok: true });
  }));

  app.post("/api/v3/duels/:code/submit", limitWrites, guard(async (req, res, me) => {
    const c = clean(req.params.code, 12).toUpperCase();
    const pool = baPool()!;
    const d = (await pool.query(`select * from ${SCH}.duels where code=$1`, [c])).rows[0];
    if (!d) return send(res, 404, { error: "not_found" });
    const prev = (await pool.query(`select finished from ${SCH}.duel_entries where code=$1 and open_id=$2`, [c, me.openId])).rows[0];
    if (prev?.finished) return send(res, 409, { error: "already_played", duel: await duelView(c, me.openId) });
    const b = req.body || {};
    const ids: string[] = d.question_ids;
    const answers = (Array.isArray(b.answers) ? b.answers : []).filter((a: any) => ids.includes(String(a?.id)));
    const ordered = ids.map((id) => answers.find((a: any) => String(a.id) === id) || { id, choice: null, ms: 600000 });
    const scored = scoreRound(d.tier, ordered);
    const timeMs = ordered.reduce((t: number, a: any) => t + Math.max(0, Math.min(Number(a.ms) || 0, 600000)), 0);
    const name = clean(b.name, 40) || me.name || "Player";
    const church = clean(b.church, 60) || null;
    await pool.query(
      `insert into ${SCH}.duel_entries(code, open_id, name, church, score, correct, total, time_ms, answers, progress, finished)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$7,true)
       on conflict (code, open_id) do update set name=excluded.name, church=excluded.church, score=excluded.score, correct=excluded.correct,
         total=excluded.total, time_ms=excluded.time_ms, answers=excluded.answers, progress=excluded.progress, finished=true, updated_at=now()`,
      [c, me.openId, name, church, scored.total, scored.correct, scored.count, timeMs, JSON.stringify(scored.results.map((r) => r.correct))],
    );
    const isCreator = d.creator_open_id === me.openId;
    // Settle every head-to-head this finish completes (duel-outcome.ts: score, then time in
    // tenths of a second, else a draw). A challenger is settled against the creator; a creator
    // who finishes after challengers is settled against each of them. Each pair settles once,
    // when the second of the two finishes, and both sides' stats move (win, loss or draw).
    let won = 0, drawn = 0;
    const mine = { score: scored.total, timeMs };
    const others = (await pool.query(
      `select open_id, score, time_ms from ${SCH}.duel_entries where code=$1 and open_id<>$2 and finished` + (isCreator ? "" : " and open_id=$3"),
      isCreator ? [c, me.openId] : [c, me.openId, d.creator_open_id],
    )).rows;
    for (const o of others) {
      const cmp = compareDuel(mine, { score: o.score, timeMs: o.time_ms });
      if (cmp > 0) won++;
      else if (cmp < 0) await bumpStat(o.open_id, "duelsWon");
      else { drawn++; await bumpStat(o.open_id, "duelsDrawn"); }
    }
    const applied = await applyRound(me.openId, name, { mode: "duel", tier: d.tier, scored, duel: isCreator ? (d.parent_code ? "rematch" : "sent") : "played", won, drawn });
    const view = await duelView(c, me.openId);
    send(res, 200, { score: scored.total, correct: scored.correct, total: scored.count, results: scored.results, duel: view, ...applied });
  }));

  // ---- leaderboards ----
  app.get("/api/v3/leaderboard", guard(async (req, res, me) => {
    const scope = String(req.query.scope || "week");
    const pool = baPool()!;
    let rows: any[] = [];
    if (scope === "all") {
      rows = (await pool.query(`select open_id, name, church, xp as score, xp from ${SCH}.players where xp>0 order by xp desc limit 50`)).rows;
    } else if (scope === "week") {
      rows = (await pool.query(`select r.open_id, p.name, p.church, sum(r.score)::int as score, p.xp from ${SCH}.rounds r join ${SCH}.players p on p.open_id=r.open_id where r.created_at > now() - interval '7 days' group by r.open_id, p.name, p.church, p.xp order by score desc limit 50`)).rows;
    } else if (scope === "daily") {
      rows = (await pool.query(`select r.open_id, p.name, p.church, r.score, p.xp from ${SCH}.rounds r join ${SCH}.players p on p.open_id=r.open_id where r.mode='daily' and r.day=$1 order by r.score desc limit 50`, [lagosDay()])).rows;
    } else if (scope === "church") {
      const r = await pool.query(`select min(church) as church, count(*)::int as players, sum(xp)::int as score, max(xp) as top from ${SCH}.players where church is not null and church<>'' group by lower(regexp_replace(church,'\\s+',' ','g')) order by score desc limit 40`);
      return send(res, 200, { scope, churches: r.rows });
    } else if (scope === "rivals") {
      if (!me) return send(res, 200, { scope, rows: [] });
      const rule = sqlDuelRule("m", "o");
      const n = (cond: string) => `sum(case when ${cond} then 1 else 0 end)::int`;
      rows = (await pool.query(
        `select o.open_id, max(o.name) as name, max(p.church) as church, coalesce(max(p.xp),0) as xp, coalesce(max(p.xp),0) as score,
           ${n(rule.win)} as wins, ${n(rule.loss)} as losses, ${n(rule.draw)} as draws
         from ${SCH}.duel_entries m join ${SCH}.duel_entries o on o.code=m.code and o.open_id<>m.open_id and o.finished
         left join ${SCH}.players p on p.open_id=o.open_id
         where m.open_id=$1 and m.finished group by o.open_id order by count(*) desc limit 30`, [me.openId])).rows;
    }
    send(res, 200, { scope, rows: rows.map((r: any) => ({ name: r.name, church: r.church, score: r.score, rank: rankOf(r.xp || 0).name, isMe: me?.openId === r.open_id, wins: r.wins, losses: r.losses, draws: r.draws })) });
  }, false));

  // ---- share pages: WhatsApp/OG previews for challenge links ----
  const indexFile = path.join(WEB_DIR, "index.html");
  const page = (req: Request, res: Response, og: { title: string; desc: string; image: string }) => {
    let html = "";
    try { html = fs.readFileSync(indexFile, "utf8"); } catch { return res.redirect(302, "/"); }
    const origin = `${req.protocol}://${req.get("host")}`;
    const tags = `<meta property="og:title" content="${esc(og.title)}"><meta property="og:description" content="${esc(og.desc)}"><meta property="og:image" content="${origin}${og.image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:url" content="${origin}${req.originalUrl}"><meta property="og:type" content="website"><meta name="twitter:card" content="summary_large_image">`;
    html = html.replace(/<!--OG-->[\s\S]*?<!--\/OG-->/, tags).replace(/<title>[^<]*<\/title>/, `<title>${esc(og.title)}</title>`);
    res.setHeader("Cache-Control", "no-cache");
    res.type("html").send(html);
  };
  app.get("/d/:code", async (req, res) => {
    const c = clean(req.params.code, 12).toUpperCase();
    let title = "You've been challenged on Bible Arena";
    let desc = "Same questions, head to head. Know the Word. Challenge the World.";
    try {
      if (baPool()) {
        const v = await duelView(c);
        if (v) {
          const creator = v.entries.find((e) => e.isCreator && e.finished);
          title = creator
            ? `${v.creator.name} scored ${creator.score.toLocaleString("en-US")} on Bible Arena. Can you beat it?`
            : `${v.creator.name} challenges you on Bible Arena`;
          desc = `${MODE_NAME[v.mode] || "Arena"} · ${TIER_NAME[v.tier] || ""} level · ${v.ids.length} questions. Play the same set and see who knows the Word.`;
        }
      }
    } catch {}
    page(req, res, { title, desc, image: "/v3/og-duel.jpg" });
  });
  app.get(["/", "/index.html"], (req, res) => page(req, res, { title: "Bible Arena — Know the Word. Challenge the World.", desc: "Fill in the Gap, Who Am I, Bible or Myth, daily challenges and head-to-head pastor duels. Every answer with its verse.", image: "/v3/og.jpg" }));
}
