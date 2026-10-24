// Bible Arena v3.5.0: Live Multiplayer Social. Open, on-demand multiplayer discovery (no scheduled shows):
//  - presence ("🟢 N online now"): clients heartbeat about every 25 s while the app is open and in use; online = seen in the last 75 s
//  - "Live now": open challenges (people waiting for an opponent), quick-match duels being played (anyone can join the
//    same questions), and Live rooms whose host listed them as public (late join, up to 200)
//  - Quick Match: pairs two waiting players into a duel (same questions, live progress); after ~60 s the waiter can keep
//    waiting, play the Arena Bot, or play solo
//  - Challenge the winner (duel results and Live room finals) and "winner stays on"
//  - in-app pop-up to people online when someone opens a match (max 1 per person per 2 min, mute in settings)
//  - Web Push for people not in the app (opt-in after a tap; quiet hours 22:00–07:00 Lagos; max 3 a day, 1 an hour)
// Everything live is in memory on the single instance (cheap: no database work per heartbeat); losing it on a redeploy is
// harmless. Push subscriptions live in the server's SQLite (table v3_push_subs), snapshotted to Postgres like the churches.
import type { Express, Request, Response } from "express";
import { getDb } from "../db";
import { logger } from "../_core/logger";
import { sendPush, vapidPublicKey, endpointOk, type PushSub } from "./webpush";
import { badName } from "./names";

type Me = { openId: string; name: string };
type Guard = (fn: (req: Request, res: Response, me: Me) => Promise<void>, needAuth?: boolean) => (req: Request, res: Response) => Promise<void>;
type Send = (res: Response, status: number, body: unknown) => void;
type Tier = "b" | "s" | "t";
export interface SocialDeps {
  /** Creates a duel owned by creatorOpenId (the waiter); returns its code and question ids. */
  createDuel(creatorOpenId: string, creatorName: string, mode: string, tier: Tier): Promise<{ code: string; ids: string[] }>;
  /** Creates a duel for the player with a finished Arena Bot entry. */
  createBotDuel(openId: string, name: string, mode: string, tier: Tier): Promise<{ code: string; ids: string[]; bot: { name: string; score: number } }>;
  /** The winner of a finished duel (score, then time), or null when there is none yet or it is a draw. */
  duelWinner(code: string): Promise<{ openId: string; name: string } | null>;
  /** The winner of a finished Live room, and whether the given player token is that winner. */
  liveWinner(code: string, token: string): { title: string; name: string; isMe: boolean } | null;
  /** Public Live rooms anyone can join now. */
  publicRooms(): Array<{ code: string; title: string; church: string; phase: string; qi: number; qn: number; n: number; max: number }>;
  /** v3.7.0: public knockout rooms with someone in them now (lobbies first). */
  publicKo?(): KoInfo[];
}
export interface KoInfo { code: string; host: string; auto: boolean; n: number; here: number; left: number; phase: string; round: number; final: boolean; game: number; startsIn: number | null; openedAt: number; max: number }

// ---------- clock (injectable for tests) ----------
let nowFn = () => Date.now();
export function _setNow(fn: () => number) { nowFn = fn; }
export const CFG = {
  onlineMs: 75_000, popupGapMs: 120_000, waitFreshMs: 25_000, waitMaxMs: 15 * 60_000, matchKeepMs: 5 * 60_000,
  runningMs: 10 * 60_000, inviteMaxAgeMs: 3 * 60_000, pushDelayMs: 15_000, pushPerDay: 3, pushGapMs: 60 * 60_000,
  koPushDelayMs: 20_000, koPushGapMs: 30 * 60_000, koInviteMaxAgeMs: 4 * 60_000,
};
const MODES = ["mixed", "arena", "gap", "who", "myth"];
const TIERS: Tier[] = ["b", "s", "t"];
const asTier = (v: unknown): Tier => (TIERS.includes(v as Tier) ? (v as Tier) : "s");
const asMode = (v: unknown) => (MODES.includes(String(v)) ? String(v) : "mixed");
const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f<>{}\[\]\\`$]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
/** v3.9.0: player display names also pass the shared bad-word filter (names.ts); a bad name falls back to the saved/default name. */
const cleanPlayerName = (v: unknown, max: number) => { const s = clean(v, max); return badName(s) ? "" : s; };
const pidOk = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9_-]{8,40}$/.test(v) ? v : "");
const lagosHour = (t: number) => new Date(t + 3600_000).getUTCHours();
const lagosDay = (t: number) => new Date(t + 3600_000).toISOString().slice(0, 10);
export const quietHours = (t: number) => { const h = lagosHour(t); return h >= 22 || h < 7; };

// ---------- presence ----------
interface Pres { key: string; openId: string; at: number; busy: boolean; mute: boolean; lastPopup: number; seen: Set<string>; name?: string }
const pres = new Map<string, Pres>();
const byOpen = new Map<string, Pres>();
export function onlineCount(now = nowFn()): number { let n = 0; for (const p of pres.values()) if (now - p.at < CFG.onlineMs) n++; return n; }
export function isOnline(openId: string, now = nowFn()): boolean { const p = byOpen.get(openId); return !!p && now - p.at < CFG.onlineMs; }
function prune(now: number) {
  for (const [k, p] of pres) if (now - p.at > 10 * 60_000) { pres.delete(k); if (byOpen.get(p.openId) === p) byOpen.delete(p.openId); }
  for (const [id, w] of waits) if ((w.status !== "waiting" && now - w.endedAt > CFG.matchKeepMs) || now - w.createdAt > CFG.waitMaxMs + CFG.matchKeepMs) waits.delete(id);
  for (const [c, r] of running) if (now - r.startedAt > CFG.runningMs) running.delete(c);
  for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
}

// ---------- open challenges ----------
type Kind = "quick" | "champ" | "challenge";
export interface Wait {
  id: string; openId: string; pid: string; name: string; church: string; tier: Tier; mode: string; kind: Kind;
  vs?: { name: string; openId?: string }; note?: string; createdAt: number; polledAt: number; endedAt: number;
  status: "waiting" | "pairing" | "matched" | "gone"; match?: { code: string; ids: string[]; tier: Tier; mode: string; opp: string };
  pushed?: boolean;
}
const waits = new Map<string, Wait>();
const running = new Map<string, { code: string; names: string[]; tier: Tier; mode: string; startedAt: number; ids: string[] }>();
let seq = 0;
const newId = () => (Date.now().toString(36) + (++seq).toString(36) + Math.random().toString(36).slice(2, 6)).slice(-12);
function fresh(w: Wait, now: number) { return w.status === "waiting" && now - w.polledAt < CFG.waitFreshMs && now - w.createdAt < CFG.waitMaxMs; }
function expire(now: number) { for (const w of waits.values()) if (w.status === "waiting" && !fresh(w, now)) { w.status = "gone"; w.endedAt = now; } }
function mineWaiting(openId: string): Wait | undefined { for (const w of waits.values()) if (w.openId === openId && (w.status === "waiting" || w.status === "pairing")) return w; return undefined; }

export function inviteText(w: Wait, forOpenId?: string): string {
  if (w.kind === "challenge" && w.vs) return w.vs.openId && w.vs.openId === forOpenId ? `${w.name} challenges you to a rematch!` : `${w.name} challenges ${w.vs.name}, the winner`;
  if (w.kind === "champ") return `${w.name}${w.note ? ` won ${w.note} and` : ""} is waiting for a challenger`;
  return `${w.name} is waiting for a challenger`;
}
function waitView(w: Wait, me: string | undefined, now: number) {
  return { t: "wait", id: w.id, name: w.name, church: w.church || null, tier: w.tier, mode: w.mode, kind: w.kind, vs: w.vs ? w.vs.name : null,
    forMe: !!(w.vs?.openId && w.vs.openId === me), mine: w.openId === me, text: inviteText(w, me), age: Math.round((now - w.createdAt) / 1000) };
}

let deps: SocialDeps;
let roomCache: { at: number; rows: ReturnType<SocialDeps["publicRooms"]> } = { at: 0, rows: [] };
export function liveList(me: string | undefined, now = nowFn()) {
  expire(now);
  const out: any[] = [];
  for (const w of [...waits.values()].sort((a, b) => a.createdAt - b.createdAt)) if (fresh(w, now)) out.push(waitView(w, me, now));
  for (const r of [...running.values()].sort((a, b) => b.startedAt - a.startedAt)) out.push({ t: "duel", code: r.code, names: r.names, tier: r.tier, mode: r.mode, age: Math.round((now - r.startedAt) / 1000) });
  if (now - roomCache.at > 3000) { try { roomCache = { at: now, rows: deps.publicRooms() }; } catch { roomCache = { at: now, rows: [] }; } }
  for (const r of roomCache.rows) out.push({ t: "room", ...r });
  // v3.7.0: group knockouts come first: they are the main way to play online
  return [...koRows(now).map((r) => ({ t: "ko", ...r })), ...out].slice(0, 40);
}
let koCache: { at: number; rows: KoInfo[] } = { at: 0, rows: [] };
export function koRows(now = nowFn()): KoInfo[] {
  if (now - koCache.at > 1500 || koCache.at > now) { try { koCache = { at: now, rows: deps?.publicKo ? deps.publicKo() : [] }; } catch { koCache = { at: now, rows: [] }; } }
  return koCache.rows;
}
export const koInviteText = (r: KoInfo) => `${r.host}'s knockout · ${r.here} player${r.here === 1 ? "" : "s"} · ${r.startsIn != null ? "starting soon" : "join now"}`;
/** v3.7.0: who is online (names only), for the online counter. */
export function peopleOnline(now = nowFn(), meKey = "") {
  const out: Array<{ name: string; busy: boolean; me: boolean }> = []; let anon = 0;
  for (const p of pres.values()) {
    if (now - p.at >= CFG.onlineMs) continue;
    if (!p.name) { anon++; continue; }
    out.push({ name: p.name, busy: p.busy, me: !!meKey && p.key === meKey });
  }
  out.sort((a, b) => Number(b.me) - Number(a.me) || Number(a.busy) - Number(b.busy) || a.name.localeCompare(b.name));
  return { people: out.slice(0, 80), more: Math.max(0, out.length - 80) + anon };
}

/** The pop-up this person should see now, if any (and records that it was shown). */
export function inviteFor(p: Pres, now = nowFn()) {
  if (p.mute || p.busy) return null;
  const list = [...waits.values()].filter((w) => fresh(w, now) && now - w.createdAt < CFG.inviteMaxAgeMs && w.openId !== p.openId && w.pid !== p.key && !p.seen.has(w.id));
  // a challenge aimed at this person comes first and is not held back by the 2-minute gap
  list.sort((a, b) => Number(!!(b.vs?.openId && b.vs.openId === p.openId)) - Number(!!(a.vs?.openId && a.vs.openId === p.openId)) || b.createdAt - a.createdAt);
  let koTried = false;
  const koInvite = () => {
    koTried = true;
    if (now - p.lastPopup < CFG.popupGapMs) return null;
    // a public knockout lobby that just opened or is about to start
    for (const r of koRows(now)) {
      if (r.phase !== "lobby" || r.n >= r.max) continue;
      if (r.startsIn == null && now - r.openedAt > CFG.koInviteMaxAgeMs) continue;
      const id = `ko:${r.code}:${r.game}`;
      if (p.seen.has(id)) continue;
      p.seen.add(id); if (p.seen.size > 200) p.seen = new Set([...p.seen].slice(-100));
      p.lastPopup = now;
      return { id, t: "ko", room: r.code, name: r.host, text: koInviteText(r), kind: "ko", here: r.here, targeted: false };
    }
    return null;
  };
  for (const w of list) {
    const targeted = !!(w.vs?.openId && p.openId && w.vs.openId === p.openId);
    if (!targeted && !koTried) { const k = koInvite(); if (k) return k; }
    if (!targeted && now - p.lastPopup < CFG.popupGapMs) continue;
    p.seen.add(w.id); if (p.seen.size > 200) p.seen = new Set([...p.seen].slice(-100));
    p.lastPopup = now;
    return { id: w.id, name: w.name, text: inviteText(w, p.openId), tier: w.tier, mode: w.mode, kind: w.kind, targeted };
  }
  return koTried ? null : koInvite();
}

async function pair(w: Wait, joiner: Me, joinerName: string, now: number) {
  w.status = "pairing";
  try {
    const d = await deps.createDuel(w.openId, w.name, w.mode, w.tier);
    w.status = "matched"; w.endedAt = nowFn();
    w.match = { code: d.code, ids: d.ids, tier: w.tier, mode: w.mode, opp: joinerName };
    running.set(d.code, { code: d.code, names: [w.name, joinerName], tier: w.tier, mode: w.mode, startedAt: now, ids: [w.openId, joiner.openId] });
    logger.info("social_matched", { kind: w.kind, waitedS: Math.round((now - w.createdAt) / 1000) });
    return { status: "matched", code: d.code, ids: d.ids, tier: w.tier, mode: w.mode, opp: w.name, role: "challenger" };
  } catch (error) {
    w.status = "waiting";
    throw error;
  }
}

// ---------- push subscriptions (SQLite) ----------
function db() {
  const d = getDb();
  d.exec(`CREATE TABLE IF NOT EXISTS v3_push_subs (
      endpoint TEXT PRIMARY KEY, open_id TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at INTEGER NOT NULL,
      day TEXT NOT NULL DEFAULT '', sent INTEGER NOT NULL DEFAULT 0, last_at INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS v3_push_subs_open ON v3_push_subs(open_id);`);
  return d;
}
type SubRow = { endpoint: string; open_id: string; p256dh: string; auth: string; day: string; sent: number; last_at: number };
export function saveSub(openId: string, s: { endpoint: string; p256dh: string; auth: string }) {
  const d = db();
  d.prepare(`INSERT INTO v3_push_subs(endpoint, open_id, p256dh, auth, created_at) VALUES (?,?,?,?,?)
    ON CONFLICT(endpoint) DO UPDATE SET open_id=excluded.open_id, p256dh=excluded.p256dh, auth=excluded.auth`).run(s.endpoint, openId, s.p256dh, s.auth, nowFn());
  // at most 5 devices per player
  d.prepare(`DELETE FROM v3_push_subs WHERE open_id = ? AND endpoint NOT IN (SELECT endpoint FROM v3_push_subs WHERE open_id = ? ORDER BY created_at DESC LIMIT 5)`).run(openId, openId);
}
export function subsOf(openId: string): SubRow[] { return db().prepare("SELECT * FROM v3_push_subs WHERE open_id = ?").all(openId) as any; }
export function deleteSocialData(openId: string): number {
  for (const w of waits.values()) if (w.openId === openId && w.status === "waiting") { w.status = "gone"; w.endedAt = nowFn(); }
  const p = byOpen.get(openId); if (p) { pres.delete(p.key); byOpen.delete(openId); }
  for (const [c, r] of running) if (r.ids.includes(openId)) running.delete(c); // its duel is deleted with the account
  try { return Number(db().prepare("DELETE FROM v3_push_subs WHERE open_id = ?").run(openId).changes || 0); } catch { return 0; }
}
export function mergeSocial(fromOpenId: string, toOpenId: string) {
  try { db().prepare("UPDATE v3_push_subs SET open_id = ? WHERE open_id = ?").run(toOpenId, fromOpenId); } catch {}
}

/** May this subscription get a push now? (quiet hours, 3 a day, 1 an hour). */
export function pushAllowed(row: Pick<SubRow, "day" | "sent" | "last_at">, now = nowFn()): boolean {
  if (quietHours(now)) return false;
  const sentToday = row.day === lagosDay(now) ? row.sent : 0;
  return sentToday < CFG.pushPerDay && now - row.last_at >= CFG.pushGapMs;
}
let pushImpl: typeof sendPush = sendPush;
export function _setPush(fn: typeof sendPush) { pushImpl = fn; }
const stats = { pushSent: 0, pushFailed: 0, pushGone: 0 };
async function deliver(rows: SubRow[], data: Record<string, unknown>) {
  const now = nowFn(); const day = lagosDay(now);
  const d = db();
  let i = 0;
  const worker = async () => {
    while (i < rows.length) {
      const row = rows[i++];
      const sub: PushSub = { endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth };
      const r = await pushImpl(sub, data, { ttl: 900, urgency: "high", topic: String(data.tag || "ba") });
      if (r.gone) { stats.pushGone++; d.prepare("DELETE FROM v3_push_subs WHERE endpoint = ?").run(row.endpoint); continue; }
      if (r.ok) { stats.pushSent++; d.prepare("UPDATE v3_push_subs SET day = ?, sent = CASE WHEN day = ? THEN sent + 1 ELSE 1 END, last_at = ? WHERE endpoint = ?").run(day, day, now, row.endpoint); }
      else stats.pushFailed++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, rows.length) }, worker));
}
/** Phone notifications for an open challenge that nobody took within 15 s: everyone subscribed who is not in the app. */
export async function pushForWait(w: Wait) {
  if (!vapidPublicKey() || w.status !== "waiting" || w.pushed) return 0;
  w.pushed = true;
  const now = nowFn();
  const rows = (db().prepare("SELECT * FROM v3_push_subs WHERE open_id <> ? ORDER BY last_at ASC LIMIT 1000").all(w.openId) as unknown as SubRow[])
    .filter((r) => !isOnline(r.open_id, now) && pushAllowed(r, now));
  // one notification per player, even with several devices: the player is charged once per day/hour cap via each device row
  const target = w.vs?.openId;
  const pick = target ? rows.filter((r) => r.open_id === target).concat(rows.filter((r) => r.open_id !== target)) : rows;
  const data = { title: w.kind === "challenge" && target ? "⚔️ You've been challenged!" : "⚔️ A challenger is waiting", body: inviteText(w, undefined) + ". Tap to join!", url: "/#/qm?join=" + w.id, tag: "ba-challenge" };
  const forTarget = target ? { ...data, body: inviteText(w, target) + " Tap to play." } : data;
  const a = pick.filter((r) => r.open_id === target), b = pick.filter((r) => r.open_id !== target);
  if (a.length) await deliver(a, forTarget);
  if (b.length) await deliver(b, data);
  logger.info("social_push", { devices: pick.length, sent: stats.pushSent });
  return pick.length;
}

/** v3.7.0: "<host> is looking for players" phone notification when a public knockout lobby opens. Goes to opted-in
 * players who are not in the app now; quiet hours, 3 a day and 1 an hour as before, plus at most 1 of these per player
 * per 30 min (in memory). Sent ~20 s after the lobby opens, only if it is still an open public lobby. */
const koPushAt = new Map<string, number>();
const koPushedRooms = new Map<string, number>();
export function scheduleKoPush(code: string) {
  if (!vapidPublicKey() || koPushedRooms.has(code)) return;
  koPushedRooms.set(code, nowFn());
  if (koPushedRooms.size > 2000) for (const [c, t] of koPushedRooms) if (nowFn() - t > 6 * 3600_000) koPushedRooms.delete(c);
  setTimeout(() => { void pushForKo(code).catch((e) => logger.warn("social_ko_push_failed", { error: e instanceof Error ? e.message : String(e) })); }, CFG.koPushDelayMs).unref?.();
}
export async function pushForKo(code: string) {
  if (!vapidPublicKey()) return 0;
  koCache.at = 0;
  const r = koRows().find((x) => x.code === code);
  if (!r || r.phase !== "lobby" || r.n >= r.max) return 0;
  const now = nowFn();
  const rows = (db().prepare("SELECT * FROM v3_push_subs ORDER BY last_at ASC LIMIT 1000").all() as unknown as SubRow[])
    .filter((s) => !isOnline(s.open_id, now) && pushAllowed(s, now) && now - (koPushAt.get(s.open_id) || 0) >= CFG.koPushGapMs);
  if (!rows.length) return 0;
  for (const s of rows) koPushAt.set(s.open_id, now);
  if (koPushAt.size > 20_000) for (const [k, t] of koPushAt) if (now - t > CFG.koPushGapMs) koPushAt.delete(k);
  await deliver(rows, { title: "⚔️ Players wanted", body: `${r.host} is looking for players on Bible Arena. Join now!`, url: "/j/" + code, tag: "ba-ko" });
  logger.info("social_ko_push", { devices: rows.length, sent: stats.pushSent });
  return rows.length;
}

// ---------- rate limit ----------
const buckets = new Map<string, { n: number; reset: number }>();
function allow(key: string, max: number, windowMs: number): boolean {
  const now = nowFn();
  let b = buckets.get(key);
  if (!b || b.reset <= now) { b = { n: 0, reset: now + windowMs }; buckets.set(key, b); }
  return ++b.n <= max;
}
const ipOf = (req: Request) => { const f = req.headers["x-forwarded-for"]; return (typeof f === "string" ? f.split(",")[0].trim() : req.ip) || "ip"; };

/** Ends a player's waiting entry (used when they start something else). */
function cancelMine(openId: string) { const w = mineWaiting(openId); if (w && w.status === "waiting") { w.status = "gone"; w.endedAt = nowFn(); } }

export function socialStatus() { return { online: onlineCount(), ko: koRows().length, waiting: [...waits.values()].filter((w) => w.status === "waiting").length, running: running.size, push: !!vapidPublicKey(), ...stats }; }
export function _reset() { pres.clear(); byOpen.clear(); waits.clear(); running.clear(); buckets.clear(); roomCache = { at: 0, rows: [] }; koCache = { at: 0, rows: [] }; koPushAt.clear(); koPushedRooms.clear(); }

export function registerSocial(app: Express, guard: Guard, send: Send, d: SocialDeps): void {
  deps = d;
  setInterval(() => { try { prune(nowFn()); } catch {} }, 60_000).unref?.();

  // heartbeat: presence + online count + (optionally) the Live now list + a pop-up + my waiting entry
  app.post("/api/v3/social/hb", guard(async (req, res, me) => {
    const b = req.body || {};
    const now = nowFn();
    const key = pidOk(b.pid) || (me ? "u:" + me.openId : "");
    if (!key) return send(res, 400, { error: "pid_required" });
    if (!allow("hb:" + key, 30, 60_000) || !allow("hbip:" + ipOf(req), 1500, 60_000)) return send(res, 429, { error: "slow_down" });
    let p = pres.get(key);
    if (!p) { if (pres.size > 50_000) prune(now); p = { key, openId: "", at: now, busy: false, mute: false, lastPopup: 0, seen: new Set() }; pres.set(key, p); }
    p.at = now; p.busy = !!b.busy; p.mute = !!b.mute;
    if (typeof b.name === "string") p.name = cleanPlayerName(b.name, 18) || undefined;
    if (me && p.openId !== me.openId) { p.openId = me.openId; }
    if (me) byOpen.set(me.openId, p);
    const out: any = { online: onlineCount(now), invite: inviteFor(p, now) };
    const list = liveList(me?.openId, now);
    out.liveCount = list.filter((x) => !x.mine).length;
    if (b.live) out.live = list;
    if (b.wantKey) out.pushKey = vapidPublicKey();
    send(res, 200, out);
  }, false));

  app.get("/api/v3/social/live", guard(async (req, res, me) => {
    if (!allow("live:" + ipOf(req), 600, 60_000)) return send(res, 429, { error: "slow_down" });
    const out: any = { online: onlineCount(), live: liveList(me?.openId) };
    if (req.query.people) Object.assign(out, peopleOnline(nowFn(), pidOk(req.query.pid)));
    send(res, 200, out);
  }, false));

  // Quick Match / open a challenge. body: { tier, mode, name, church, kind?: "quick"|"champ"|"challenge", duel?: CODE, room?: CODE, lt?: token }
  app.post("/api/v3/social/match", guard(async (req, res, me) => {
    if (!allow("match:" + me.openId, 12, 60_000)) return send(res, 429, { error: "slow_down" });
    const b = req.body || {};
    const now = nowFn();
    expire(now);
    cancelMine(me.openId);
    const name = cleanPlayerName(b.name, 40) || me.name || "Player";
    const church = clean(b.church, 60);
    let kind: Kind = "quick"; let vs: Wait["vs"]; let note = "";
    if (b.duel) {
      const win = await deps.duelWinner(clean(b.duel, 12).toUpperCase());
      if (!win) return send(res, 409, { error: "no_winner" });
      if (win.openId === me.openId) { kind = "champ"; note = "a duel"; } else { kind = "challenge"; vs = { name: win.name, openId: win.openId }; }
    } else if (b.room) {
      const win = deps.liveWinner(String(b.room).replace(/\D/g, "").slice(0, 6), String(b.lt || ""));
      if (!win) return send(res, 409, { error: "no_winner" });
      if (win.isMe) { kind = "champ"; note = win.title; } else { kind = "challenge"; vs = { name: win.name }; note = win.title; }
    }
    const tier = asTier(b.tier), mode = asMode(b.mode);
    // a plain Quick Match takes the longest-waiting open challenge first
    if (kind === "quick") {
      const open = [...waits.values()].filter((w) => fresh(w, now) && w.openId !== me.openId && !(w.vs?.openId && w.vs.openId !== me.openId && now - w.createdAt < 30_000)).sort((a, b) => a.createdAt - b.createdAt)[0];
      if (open) return send(res, 200, await pair(open, me, name, now));
    }
    const pid = pidOk(b.pid);
    const w: Wait = { id: newId(), openId: me.openId, pid, name, church, tier, mode, kind, vs, note: note || undefined, createdAt: now, polledAt: now, endedAt: 0, status: "waiting" };
    waits.set(w.id, w);
    setTimeout(() => { if (w.status === "waiting" && fresh(w, nowFn())) void pushForWait(w).catch((e) => logger.warn("social_push_failed", { error: e instanceof Error ? e.message : String(e) })); }, CFG.pushDelayMs).unref?.();
    logger.info("social_wait", { kind });
    send(res, 200, { status: "waiting", id: w.id, text: inviteText(w, me.openId) });
  }));

  app.get("/api/v3/social/match/:id", guard(async (req, res, me) => {
    const w = waits.get(clean(req.params.id, 16));
    if (!w) return send(res, 404, { error: "not_found" });
    if (w.openId !== me.openId) {
      // someone else looking at a challenge (pop-up / push / Live now): is it still open?
      return send(res, 200, { status: fresh(w, nowFn()) ? "open" : "taken", name: w.name, text: inviteText(w, me.openId), tier: w.tier, mode: w.mode, kind: w.kind });
    }
    const now = nowFn();
    expire(now);
    if (w.status === "waiting") w.polledAt = now;
    if (w.status === "matched" && w.match) return send(res, 200, { status: "matched", ...w.match, role: "creator" });
    send(res, 200, { status: w.status === "pairing" ? "waiting" : w.status, waited: Math.round((now - w.createdAt) / 1000), online: onlineCount(now) });
  }));

  app.post("/api/v3/social/match/:id/join", guard(async (req, res, me) => {
    if (!allow("match:" + me.openId, 12, 60_000)) return send(res, 429, { error: "slow_down" });
    const w = waits.get(clean(req.params.id, 16));
    const now = nowFn();
    if (!w || !fresh(w, now)) return send(res, 410, { error: "taken" });
    if (w.openId === me.openId) return send(res, 400, { error: "own_challenge" });
    cancelMine(me.openId);
    const name = cleanPlayerName((req.body || {}).name, 40) || me.name || "Player";
    send(res, 200, await pair(w, me, name, now));
  }));

  app.post("/api/v3/social/match/:id/cancel", guard(async (req, res, me) => {
    const w = waits.get(clean(req.params.id, 16));
    if (w && w.openId === me.openId && w.status === "waiting") { w.status = "gone"; w.endedAt = nowFn(); }
    send(res, 200, { ok: true, status: w?.status || "gone" });
  }));

  app.post("/api/v3/social/bot", guard(async (req, res, me) => {
    if (!allow("bot:" + me.openId, 10, 600_000)) return send(res, 429, { error: "slow_down" });
    const b = req.body || {};
    cancelMine(me.openId);
    const r = await deps.createBotDuel(me.openId, cleanPlayerName(b.name, 40) || me.name || "Player", asMode(b.mode), asTier(b.tier));
    send(res, 200, { ...r, tier: asTier(b.tier), mode: asMode(b.mode) });
  }));

  // ---- Web Push ----
  app.get("/api/v3/push/key", (_req, res) => { res.setHeader("Cache-Control", "no-store"); res.json({ key: vapidPublicKey() }); });
  app.post("/api/v3/push/subscribe", guard(async (req, res, me) => {
    if (!allow("sub:" + me.openId, 10, 600_000)) return send(res, 429, { error: "slow_down" });
    const s = (req.body || {}).sub || {};
    const endpoint = String(s.endpoint || ""), p256dh = String(s.keys?.p256dh || ""), auth = String(s.keys?.auth || "");
    if (!vapidPublicKey()) return send(res, 503, { error: "push_not_configured" });
    if (!endpointOk(endpoint) || !/^[A-Za-z0-9_-]{80,100}$/.test(p256dh) || !/^[A-Za-z0-9_-]{16,32}$/.test(auth)) return send(res, 400, { error: "bad_subscription" });
    saveSub(me.openId, { endpoint, p256dh, auth });
    send(res, 200, { ok: true, devices: subsOf(me.openId).length });
  }));
  app.post("/api/v3/push/unsubscribe", guard(async (req, res, me) => {
    const endpoint = String((req.body || {}).endpoint || "");
    const n = endpoint ? db().prepare("DELETE FROM v3_push_subs WHERE open_id = ? AND endpoint = ?").run(me.openId, endpoint).changes : db().prepare("DELETE FROM v3_push_subs WHERE open_id = ?").run(me.openId).changes;
    send(res, 200, { ok: true, removed: Number(n || 0) });
  }));
  app.get("/api/v3/push/status", guard(async (_req, res, me) => { send(res, 200, { configured: !!vapidPublicKey(), devices: subsOf(me.openId).length }); }));
  // a test notification to my own devices (does not count toward the daily cap; 3 per 10 minutes)
  app.post("/api/v3/push/test", guard(async (_req, res, me) => {
    if (!allow("ptest:" + me.openId, 3, 600_000)) return send(res, 429, { error: "slow_down" });
    if (!vapidPublicKey()) return send(res, 503, { error: "push_not_configured" });
    const rows = subsOf(me.openId);
    const results = await Promise.all(rows.map((r) => pushImpl({ endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth }, { title: "Bible Arena 🔔", body: "Notifications are on. We'll tell you when a challenger is waiting.", url: "/#/live", tag: "ba-test" }, { ttl: 300, urgency: "high" })));
    for (let i = 0; i < rows.length; i++) if (results[i].gone) db().prepare("DELETE FROM v3_push_subs WHERE endpoint = ?").run(rows[i].endpoint);
    send(res, 200, { devices: rows.length, sent: results.filter((r) => r.ok).length, statuses: results.map((r) => r.status) });
  }));
  app.get("/api/v3/social/status", (_req, res) => { res.setHeader("Cache-Control", "no-store"); res.json(socialStatus()); });
}
