// Bible Arena Live: church quiz nights. A host screen on a projector, up to 200 phones, no accounts.
// Real time without paid services: Server-Sent Events, with long-polling as the fallback for weak
// mobile data. Rooms live in memory (one Render instance) and are snapshotted to Postgres every few
// seconds, so a restart or redeploy mid-quiz resumes where it was.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { logger } from "../_core/logger";
import { baPool, SCH } from "./pg";
import * as E from "./live-engine";
import { bankMeta, cleanCustom, countMatches, pickSet, type BankItem, type Pick } from "./live-bank";

const rooms = new Map<string, E.LRoom>();
const dirty = new Set<string>();
interface Conn { res: Response; role: "host" | "player"; token?: string; sent: number; at: number }
const conns = new Map<string, Set<Conn>>();
interface Waiter { res: Response; role: "host" | "player"; token?: string; since: number; timer: NodeJS.Timeout }
const waiters = new Map<string, Set<Waiter>>();
const lastHostPush = new Map<string, number>();
const lastPlayerPush = new Map<string, { v: number; at: number }>();
const ROOM_TTL_MS = 12 * 3600_000;

// ---------- v3.8.0 voice chat (knockout rooms) ----------
// WebRTC audio goes phone-to-phone (full mesh); the server only relays the small signaling messages
// (offer / answer / ICE) over the same SSE stream, with a mailbox + poll for phones on the long-poll fallback.
// Voice state lives in memory only (never in the live_rooms snapshot): after a restart phones simply rejoin.
export const VOICE_MAX = 8;
interface VMember { id: string; muted: boolean; at: number }
const voice = new Map<string, Map<string, VMember>>();          // room code -> player id -> member
const vbox = new Map<string, any[]>();                            // "code:playerId" -> undelivered messages (no SSE open)
function vRoster(room: E.LRoom) {
  const m = voice.get(room.code);
  const list = m ? [...m.values()].map((x) => { const p = room.players[x.id]; return p ? { id: x.id, name: p.name, avatar: p.avatar, muted: x.muted } : null; }).filter(Boolean) : [];
  return { type: "roster", list, max: VOICE_MAX };
}
/** Send one voice message to one player: over their open SSE stream(s), else into their mailbox. */
function vSend(room: E.LRoom, toId: string, msg: unknown, queue = true): void {
  const p = room.players[toId];
  if (!p) return;
  let sent = false;
  const set = conns.get(room.code);
  if (set) for (const c of set) if (c.role === "player" && c.token === p.token) {
    try { c.res.write(`event: vc\ndata: ${JSON.stringify(msg)}\n\n`); c.at = Date.now(); sent = true; } catch {}
  }
  if (!sent && queue) {
    const k = room.code + ":" + toId;
    const q = vbox.get(k) || [];
    q.push(msg);
    if (q.length > 200) q.splice(0, q.length - 200);
    vbox.set(k, q);
  }
}
/** Everyone in the room hears who is in voice (members get it queued if they are polling). */
function vBroadcastRoster(room: E.LRoom): void {
  const r = vRoster(room);
  const m = voice.get(room.code);
  for (const p of Object.values(room.players)) if (!p.kicked) vSend(room, p.id, r, !!m?.has(p.id));
}
function vRemove(room: E.LRoom, id: string): boolean {
  const m = voice.get(room.code);
  if (!m || !m.delete(id)) return false;
  vbox.delete(room.code + ":" + id);
  if (!m.size) voice.delete(room.code);
  return true;
}
const hostSeen = new Map<string, number>(); // last time the host's screen was connected or acted (v3.5.0 Live now)
const seenHost = (code: string) => hostSeen.set(code, Date.now());

/** Live rooms whose host listed them as public and that anyone can join right now (v3.5.0 "Live now"). */
export function publicRooms(now = Date.now()) {
  const out: Array<{ code: string; title: string; church: string; phase: string; qi: number; qn: number; n: number; max: number }> = [];
  for (const room of rooms.values()) {
    if (!room.public || room.locked || room.phase === "final") continue;
    const set = conns.get(room.code);
    let hostOn = now - (hostSeen.get(room.code) || 0) < 90_000;
    if (!hostOn && set) for (const c of set) if (c.role === "host") { hostOn = true; break; }
    if (!hostOn) continue;
    const n = E.activePlayers(room).length;
    if (n >= room.maxPlayers) continue;
    out.push({ code: room.code, title: room.title, church: room.church, phase: room.phase, qi: room.qi, qn: room.questions.length, n, max: room.maxPlayers });
  }
  return out.sort((a, b) => b.n - a.n).slice(0, 20);
}
/** Winner of a finished room (in memory), and whether this player token is the winner (v3.5.0 "Challenge the winner"). */
export function liveWinner(code: string, token: string): { title: string; name: string; isMe: boolean } | null {
  const room = rooms.get(code);
  if (!room || room.phase !== "final") return null;
  const top = E.ranks(room)[0];
  if (!top) return null;
  return { title: room.title, name: top.name, isMe: !!token && top.token === token };
}

/** v3.7.0: public knockout rooms with someone in them right now, for "Live now", pop-ups and "Join a live game". */
export interface KoRow { code: string; host: string; auto: boolean; n: number; here: number; left: number; phase: string; round: number; final: boolean; game: number; startsIn: number | null; openedAt: number; max: number }
export function publicKo(now = Date.now()): KoRow[] {
  const out: KoRow[] = [];
  for (const room of rooms.values()) {
    const ko = room.ko;
    if (!ko || !E.koPublic(ko) || room.locked) continue;
    const act = E.activePlayers(room);
    const here = act.filter((p) => online(room.code, p, now)).length;
    if (!here || act.length >= room.maxPlayers) continue;
    const alive = room.phase === "lobby" ? act.length : E.alivePlayers(room).length;
    out.push({ code: room.code, host: room.players[ko.hostId]?.name || "Someone", auto: !!ko.auto, n: act.length, here, left: alive,
      phase: room.phase, round: ko.round, final: room.phase !== "lobby" && room.phase !== "final" && alive <= 2 && ko.roundLen === E.koFinalLen(ko),
      game: ko.game, startsIn: room.phase === "lobby" && ko.startAt ? Math.max(0, ko.startAt - now) : null, openedAt: ko.openedAt || room.createdAt, max: room.maxPlayers });
  }
  // open lobbies first (busiest first), then games being played
  return out.sort((a, b) => Number(b.phase === "lobby") - Number(a.phase === "lobby") || b.here - a.here || b.openedAt - a.openedAt).slice(0, 20);
}
/** v3.7.0: called (once) when a public knockout lobby opens, so people who are not in the app can get a phone notification. */
let koOpenHook: ((code: string) => void) | null = null;
export function onKoOpen(fn: (code: string) => void) { koOpenHook = fn; }
function koOpened(room: E.LRoom) {
  if (!room.ko || !E.koPublic(room.ko) || !koOpenHook) return;
  try { koOpenHook(room.code); } catch {}
}

// ---------- tiny per-key limiter (keyed by token or IP; a whole church can share one IP) ----------
const buckets = new Map<string, { n: number; reset: number }>();
function allow(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset <= now) { b = { n: 0, reset: now + windowMs }; buckets.set(key, b); }
  b.n++;
  if (buckets.size > 20_000) for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
  return b.n <= max;
}
const ipOf = (req: Request) => {
  const f = req.headers["x-forwarded-for"];
  return (typeof f === "string" ? f.split(",")[0].trim() : req.ip) || "ip";
};
const json = (res: Response, status: number, body: unknown) => { res.setHeader("Cache-Control", "no-store"); res.status(status).json(body); };
const cleanCode = (c: unknown) => String(c || "").replace(/\D/g, "").slice(0, 6);

// ---------- persistence ----------
async function loadRoom(code: string): Promise<E.LRoom | null> {
  const mem = rooms.get(code);
  if (mem) return mem;
  const pool = baPool();
  if (!pool || code.length !== 6) return null;
  try {
    const r = await pool.query(`select state from ${SCH}.live_rooms where code=$1 and updated_at > now() - interval '12 hours'`, [code]);
    if (!r.rows.length) return null;
    const room = r.rows[0].state as E.LRoom;
    if (rooms.has(code)) return rooms.get(code)!;
    // the clock kept running while no server held the room: give a running question its time back
    const now = Date.now();
    if (room.phase === "question" || room.phase === "intro") { room.phase = "intro"; room.phaseAt = now; room.endsAt = now + room.intro; room.version++; room.pversion++; for (const p of Object.values(room.players)) delete p.answers[String(room.qi)]; }
    rooms.set(code, room);
    logger.info("live_room_restored", { code, players: Object.keys(room.players).length, phase: room.phase });
    return room;
  } catch (error) {
    logger.warn("live_room_load_failed", { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

let flushing = false;
export async function flushLive(): Promise<void> {
  const pool = baPool();
  if (!pool || flushing || !dirty.size) return;
  flushing = true;
  const codes = [...dirty];
  dirty.clear();
  try {
    for (const code of codes) {
      const room = rooms.get(code);
      if (!room) continue;
      await pool.query(
        `insert into ${SCH}.live_rooms(code,state,phase,title,players,updated_at) values($1,$2,$3,$4,$5,now())
         on conflict(code) do update set state=excluded.state, phase=excluded.phase, title=excluded.title, players=excluded.players, updated_at=now()`,
        [code, JSON.stringify(room), room.phase, room.title, E.activePlayers(room).length]);
    }
  } catch (error) {
    codes.forEach((c) => dirty.add(c));
    logger.warn("live_flush_failed", { error: error instanceof Error ? error.message : String(error) });
  } finally { flushing = false; }
}

async function saveResults(room: E.LRoom) {
  const pool = baPool();
  if (!pool || room.ko) return; // knockout rooms keep no results page
  try {
    await pool.query(
      `insert into ${SCH}.live_results(code,title,church,summary) values($1,$2,$3,$4)
       on conflict(code) do update set title=excluded.title, church=excluded.church, summary=excluded.summary`,
      [room.code, room.title, room.church, JSON.stringify(E.summary(room))]);
  } catch (error) {
    logger.warn("live_results_save_failed", { error: error instanceof Error ? error.message : String(error) });
  }
}

const touch = (room: E.LRoom) => { dirty.add(room.code); };

// ---------- views ----------
function qPublic(q: E.LQ, withAnswer: boolean) {
  return { type: q.type, q: q.q, o: q.o, clues: q.clues, r: withAnswer ? q.r : undefined, x: withAnswer ? q.x : undefined, a: withAnswer ? q.a : undefined, cat: q.cat };
}
const isOpen = (room: E.LRoom) => room.phase === "intro" || room.phase === "question";

export function playerView(room: E.LRoom, p: E.LPlayer | undefined, now = Date.now()) {
  const q = room.questions[room.qi];
  const showAns = room.phase === "reveal" || room.phase === "board" || room.phase === "final";
  const ans = p ? p.answers[String(room.qi)] : undefined;
  const v: any = {
    v: room.pversion, code: room.code, title: room.title, church: room.church, phase: room.phase,
    qi: room.qi, qn: room.questions.length, timer: room.timer, remain: isOpen(room) ? Math.max(0, room.endsAt - now) : 0,
    n: E.activePlayers(room).length, instant: room.instant,
    teams: room.teams ? E.teamTotals(room).map((t) => ({ id: t.id, name: t.name, color: t.color, emoji: t.emoji, avg: t.avg, members: t.members })) : null,
  };
  if (q && room.phase !== "lobby") v.q = room.phase === "intro" ? { type: q.type, q: q.q, n: q.o.length, cat: q.cat, clues: room.ko ? q.clues : undefined } : qPublic(q, showAns);
  if (p) {
    v.me = { id: p.id, name: p.name, avatar: p.avatar, team: p.team, score: p.score, rank: p.rank || null, streak: p.streak, kicked: !!p.kicked,
      ans: ans ? { c: ans.c, ok: showAns || room.instant ? ans.ok : undefined, pts: showAns || room.instant ? ans.pts : undefined, speed: showAns || room.instant ? ans.speed : undefined, streak: showAns || room.instant ? ans.streak : undefined } : null };
    if (showAns && room.teams) { const t = E.teamTotals(room).findIndex((x) => x.id === p.team); v.me.teamPos = t + 1; }
  }
  if (room.phase === "final") v.final = E.summary(room);
  if (room.ko) v.ko = koView(room, p, now);
  return v;
}

/** What every phone in a knockout room sees: round, who is still in, who just went out, the winner. */
function koView(room: E.LRoom, p: E.LPlayer | undefined, now: number) {
  const ko = room.ko!;
  const alive = room.phase === "lobby" ? [] : E.koStandings(room);
  const pos = new Map(alive.map((x, i) => [x.id, i + 1]));
  const host = room.players[ko.hostId];
  const all = E.activePlayers(room);
  const order = room.phase === "lobby"
    ? all.sort((a, b) => a.joinedAt - b.joinedAt)
    : [...alive, ...all.filter((x) => x.id in ko.out).sort((a, b) => (ko.out[b.id] - ko.out[a.id]) || b.score - a.score)];
  const lastOut = new Set(ko.lastOut);
  const winner = ko.winner ? room.players[ko.winner] : undefined;
  return {
    game: ko.game, round: ko.round, rq: room.qi >= 0 ? room.qi - ko.roundStart + 1 : 0, rlen: ko.roundLen,
    final: room.phase !== "lobby" && alive.length <= 2 && ko.roundLen === E.koFinalLen(ko),
    per: E.koPer(ko), finalLen: E.koFinalLen(ko), choices: E.KO_PER_CHOICES,
    pub: E.koPublic(ko), auto: !!ko.auto, startsIn: room.phase === "lobby" && ko.startAt ? Math.max(0, ko.startAt - now) : null,
    here: all.filter((x) => online(room.code, x, now)).length,
    again: ko.auto && room.phase === "final" ? Math.max(0, room.phaseAt + E.KO_AUTO_AGAIN_MS - now) : null,
    left: room.phase === "lobby" ? all.length : alive.length, rule: E.koRule(ko), max: room.maxPlayers,
    host: host ? { id: host.id, name: host.name, avatar: host.avatar, on: online(room.code, host, now) } : null,
    isHost: !!p && p.id === ko.hostId,
    meOut: p && p.id in ko.out ? ko.out[p.id] : 0, mePos: p ? pos.get(p.id) || null : null,
    lastOut: ko.lastOut.map((id) => room.players[id]).filter(Boolean).map((x) => ({ name: x.name, avatar: x.avatar })),
    winner: winner ? { id: winner.id, name: winner.name, avatar: winner.avatar, score: winner.score } : null,
    list: order.slice(0, 60).map((x) => ({ id: x.id, name: x.name, avatar: x.avatar, score: x.score, rp: room.phase === "lobby" ? 0 : E.roundPoints(room, x).pts,
      out: x.id in ko.out ? ko.out[x.id] : 0, justOut: lastOut.has(x.id), on: online(room.code, x, now), me: !!p && x.id === p.id, host: x.id === ko.hostId })),
  };
}

export function hostView(room: E.LRoom, now = Date.now()) {
  const q = room.questions[room.qi];
  const showAns = room.phase === "reveal" || room.phase === "board" || room.phase === "final";
  const live = E.activePlayers(room);
  const v: any = {
    v: room.version, code: room.code, title: room.title, church: room.church, phase: room.phase, qi: room.qi, qn: room.questions.length,
    timer: room.timer, remain: isOpen(room) ? Math.max(0, room.endsAt - now) : 0, intro: room.intro,
    auto: room.auto, instant: room.instant, locked: room.locked, public: !!room.public, max: room.maxPlayers, n: live.length,
    teams: room.teams ? E.teamTotals(room) : null,
    answered: room.qi >= 0 ? E.answeredCount(room) : 0,
  };
  if (q && room.phase !== "lobby") v.q = qPublic(q, showAns);
  if (room.phase === "lobby" || room.phase === "board" || room.phase === "final") {
    v.players = (room.phase === "lobby" ? live.sort((a, b) => a.joinedAt - b.joinedAt) : E.ranks(room))
      .map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, team: p.team, score: p.score, rank: p.rank, prev: p.prevRank, streak: p.streak, last: p.answers[String(room.qi)]?.pts || 0, on: online(room.code, p, now) }));
  }
  if (showAns) {
    v.dist = E.distribution(room);
    const fast = live.map((p) => ({ p, a: p.answers[String(room.qi)] })).filter((x) => x.a?.ok).sort((x, y) => x.a!.ms - y.a!.ms)[0];
    v.fastest = fast ? { name: fast.p.name, avatar: fast.p.avatar, ms: fast.a!.ms } : null;
    v.correctN = live.filter((p) => p.answers[String(room.qi)]?.ok).length;
  }
  if (room.phase === "final") v.final = E.summary(room);
  return v;
}

function online(code: string, p: E.LPlayer, now: number): boolean {
  const set = conns.get(code);
  if (set) for (const c of set) if (c.token === p.token) return true;
  return now - p.lastSeen < 15_000;
}

// ---------- push (SSE + long-poll) ----------
function sse(c: Conn, data: unknown) {
  try { c.res.write(`data: ${JSON.stringify(data)}\n\n`); c.at = Date.now(); } catch {}
}
function pushRoom(room: E.LRoom, force = false) {
  const now = Date.now();
  const set = conns.get(room.code);
  const ws = waiters.get(room.code);
  if (!set?.size && !ws?.size) return;
  const hostDue = force || now - (lastHostPush.get(room.code) || 0) >= 250;
  const lp = lastPlayerPush.get(room.code) || { v: 0, at: 0 };
  // lobby joins come in floods: players hear the head-count at most every 1.5 s; everything else at once
  const playerDue = room.pversion !== lp.v && (force || room.phase !== "lobby" || now - lp.at >= 1500);
  const byToken = new Map<string, E.LPlayer>();
  if (playerDue) for (const p of Object.values(room.players)) byToken.set(p.token, p);
  let host: any = null;
  if (set) for (const c of set) {
    if (c.role === "host") {
      if (hostDue && c.sent !== room.version) { host = host || hostView(room, now); sse(c, host); c.sent = room.version; }
    } else if (playerDue && c.sent !== room.pversion) {
      sse(c, playerView(room, byToken.get(c.token || ""), now)); c.sent = room.pversion;
    }
  }
  if (ws) for (const w of [...ws]) {
    if (w.role === "host" && hostDue && w.since !== room.version) { host = host || hostView(room, now); finishWait(room.code, w, host); }
    else if (w.role === "player" && playerDue && w.since !== room.pversion) finishWait(room.code, w, playerView(room, byToken.get(w.token || ""), now));
  }
  if (hostDue) lastHostPush.set(room.code, now);
  if (playerDue) lastPlayerPush.set(room.code, { v: room.pversion, at: now });
}
function finishWait(code: string, w: Waiter, body: unknown) {
  clearTimeout(w.timer);
  waiters.get(code)?.delete(w);
  try { json(w.res, 200, body); } catch {}
}

let loop: NodeJS.Timeout | null = null;
let flushLoop: NodeJS.Timeout | null = null;
function ensureLoops() {
  if (!loop) {
    loop = setInterval(() => {
      const now = Date.now();
      for (const room of rooms.values()) {
        if (room.ko && room.phase === "board" && room.questions.length < room.qi + 1 + E.koFinalLen(room.ko)) koTopUp(room);
        if (room.ko?.auto && (room.phase === "lobby" || room.phase === "final")) { try { if (koAuto(room, now)) { touch(room); pushRoom(room, true); } } catch {} }
        const before = room.phase;
        if (E.tick(room, now)) {
          touch(room);
          if (room.phase === "final" && before !== "final") void saveResults(room);
        }
        pushRoom(room);
      }
    }, 150);
    loop.unref();
    setInterval(() => { // keep-alive comments so proxies keep SSE streams open; expire old rooms
      const now = Date.now();
      for (const [code, set] of conns) for (const c of set) if (now - c.at > 15_000) { try { c.res.write(": ping\n\n"); c.at = now; } catch {} }
      for (const [code, room] of rooms) if (now - room.createdAt > ROOM_TTL_MS && !conns.get(code)?.size) { rooms.delete(code); lastHostPush.delete(code); lastPlayerPush.delete(code); voice.delete(code); }
      // v3.8.0 voice: a phone that closed without saying goodbye drops out of voice once it is offline
      for (const [code, m] of voice) {
        const room = rooms.get(code);
        if (!room) { voice.delete(code); continue; }
        let changed = false;
        for (const x of [...m.values()]) { const p = room.players[x.id]; if (!p || p.kicked || (!online(code, p, now) && now - x.at > 20_000)) changed = vRemove(room, x.id) || changed; }
        if (changed) vBroadcastRoster(room);
      }
      for (const k of vbox.keys()) { const [code, id] = k.split(":"); if (!voice.get(code)?.has(id)) vbox.delete(k); }
    }, 5000).unref();
  }
  if (!flushLoop) { flushLoop = setInterval(() => { void flushLive(); }, 3000); flushLoop.unref(); }
}

let bankRef: (() => BankItem[]) | null = null;
/** Knockout rooms add fresh questions (none repeated) before a round would run out. */
function koTopUp(room: E.LRoom) {
  if (!bankRef || !room.ko) return;
  const used = new Set(room.questions.map((q) => q.id));
  const more = pickSet(bankRef(), { tiers: [room.ko.tier], count: 30 }).filter((q) => !used.has(q.id));
  room.questions.push(...more);
  touch(room);
}

/** v3.7.0 auto lobbies ("Join a live game"): start on the countdown; after a finished game, back to the lobby by itself. */
function koAuto(room: E.LRoom, now: number): boolean {
  const ko = room.ko!;
  const isOn = (p: E.LPlayer) => online(room.code, p, now);
  const here = E.activePlayers(room).filter(isOn);
  if (room.phase === "final") {
    if (now - room.phaseAt < E.KO_AUTO_AGAIN_MS || !here.length || !bankRef) return false;
    E.koAgain(room, pickSet(bankRef(), { tiers: [ko.tier], count: 45 }), now);
    return true;
  }
  const r = E.koAutoLobby(room, now, here.length);
  if (r === "start") {
    const host = room.players[ko.hostId];
    if (!host || host.kicked || !isOn(host)) ko.hostId = here[0].id; // the host left: the longest-waiting player takes over
    delete ko.startAt;
    const s = E.koStart(room, now, isOn);
    if (!s.ok) { room.version++; room.pversion++; }
    logger.info("ko_auto_start", { code: room.code, players: here.length, ok: s.ok });
    return true;
  }
  return r === "changed";
}

function genCode(): string {
  for (let i = 0; i < 50; i++) {
    const c = String(crypto.randomInt(100000, 1000000));
    if (!rooms.has(c)) return c;
  }
  return String(crypto.randomInt(100000, 1000000));
}

function hostOk(room: E.LRoom, key: unknown) {
  const k = String(key || "");
  const ok = k.length > 0 && k.length === room.hostKey.length && crypto.timingSafeEqual(Buffer.from(k), Buffer.from(room.hostKey));
  if (ok) seenHost(room.code);
  return ok;
}

// ---------- routes ----------
export function registerLive(app: Express, bank: () => BankItem[], webDir: string): void {
  bankRef = bank;
  ensureLoops();

  app.get("/lv/meta", (_req, res) => { res.setHeader("Cache-Control", "public, max-age=300"); res.json(bankMeta(bank())); });
  app.post("/lv/count", (req, res) => json(res, 200, { count: countMatches(bank(), (req.body || {}) as Pick) }));

  app.post("/lv/rooms", async (req, res) => {
    if (!allow("create:" + ipOf(req), 30, 600_000)) return json(res, 429, { error: "Too many rooms from this network. Wait a few minutes." });
    const b = req.body || {};
    const custom = cleanCustom(b.custom);
    const fromBank = b.bank ? pickSet(bank(), b.bank as Pick) : [];
    const questions = [...custom, ...fromBank].slice(0, 50);
    if (!questions.length) return json(res, 400, { error: "No questions match. Pick more categories or add your own." });
    const teams = E.makeTeams(b.teams, b.teamNames);
    const room = E.createRoom({ code: genCode(), title: b.title, church: b.church, teams, questions, timer: b.timer, auto: b.auto, instant: b.instant, public: b.public === true, now: Date.now() });
    rooms.set(room.code, room);
    seenHost(room.code);
    touch(room);
    void flushLive();
    logger.info("live_room_created", { code: room.code, questions: questions.length, teams: !!teams });
    json(res, 200, { code: room.code, hostKey: room.hostKey, questions: questions.length });
  });

  // v3.6.0 "Challenge someone": a knockout room. The creator plays too (from their phone) and is the host.
  app.post("/lv/ko", async (req, res) => {
    if (!allow("kocreate:" + ipOf(req), 20, 600_000)) return json(res, 429, { error: "Too many challenges from this network. Wait a few minutes." });
    const b = req.body || {};
    const tier = ["b", "s", "t"].includes(b.tier) ? String(b.tier) : "s";
    const questions = pickSet(bank(), { tiers: [tier], count: 45 });
    if (questions.length < 10) return json(res, 503, { error: "Questions are loading. Try again in a moment." });
    const name = E.cleanName(b.name) || "Player";
    const room = E.createRoom({ code: genCode(), title: `${name}'s challenge`, questions, timer: E.KO_TIMER, auto: true, instant: true, now: Date.now() });
    room.maxPlayers = E.KO_MAX;
    const j = E.joinRoom(room, { name, avatar: b.avatar }, Date.now());
    if (!j.ok) return json(res, 400, { error: j.error });
    room.ko = E.makeKo(j.player.id, tier, Number(b.per) || E.KO_ROUND_LEN);
    room.ko.pub = b.pub !== false; room.ko.openedAt = Date.now(); // v3.7.0: listed in Live now unless the host turns it off
    rooms.set(room.code, room);
    touch(room);
    void flushLive();
    koOpened(room);
    logger.info("ko_room_created", { code: room.code, questions: questions.length });
    json(res, 200, { code: room.code, token: j.player.token, id: j.player.id, state: playerView(room, j.player) });
  });

  // v3.7.0 "Join a live game": join the busiest open public lobby, or open a new one that starts itself.
  app.post("/lv/ko/quick", async (req, res) => {
    if (!allow("koquick:" + ipOf(req), 30, 600_000)) return json(res, 429, { error: "Too many tries from this network. Wait a few minutes." });
    const b = req.body || {};
    const name = E.cleanName(b.name) || "Player";
    const now = Date.now();
    // already waiting in an open lobby (tapped twice, came back)? go back to it
    const mine = Array.isArray(b.mine) ? b.mine.slice(0, 10) : [];
    for (const m of mine) {
      const room = rooms.get(cleanCode(m && m.code));
      const p = room?.ko && room.phase === "lobby" ? Object.values(room.players).find((x) => x.token === String(m.t || "") && !x.kicked) : undefined;
      if (room && p) { p.lastSeen = now; room.version++; room.pversion++; return json(res, 200, { code: room.code, token: p.token, id: p.id, joined: true, back: true, state: playerView(room, p) }); }
    }
    // busiest open public lobby with someone in it right now (one with a countdown running wins ties)
    const pick = publicKo(now).filter((r) => r.phase === "lobby" && r.n < r.max)
      .sort((x, y) => y.here - x.here || Number(y.startsIn != null) - Number(x.startsIn != null) || x.openedAt - y.openedAt)[0];
    if (pick) {
      const room = rooms.get(pick.code)!;
      const j = E.joinRoom(room, { name, avatar: b.avatar }, now);
      if (j.ok) {
        touch(room); pushRoom(room, true);
        logger.info("ko_quick_joined", { code: room.code, players: E.activePlayers(room).length });
        return json(res, 200, { code: room.code, token: j.player.token, id: j.player.id, joined: true, state: playerView(room, j.player) });
      }
    }
    const tier = ["b", "s", "t"].includes(b.tier) ? String(b.tier) : "s";
    const questions = pickSet(bank(), { tiers: [tier], count: 45 });
    if (questions.length < 10) return json(res, 503, { error: "Questions are loading. Try again in a moment." });
    const room = E.createRoom({ code: genCode(), title: "Live knockout", questions, timer: E.KO_TIMER, auto: true, instant: true, now });
    room.maxPlayers = E.KO_MAX;
    const j = E.joinRoom(room, { name, avatar: b.avatar }, now);
    if (!j.ok) return json(res, 400, { error: j.error });
    room.ko = E.makeKo(j.player.id, tier, E.KO_ROUND_LEN);
    room.ko.pub = true; room.ko.auto = true; room.ko.openedAt = now;
    rooms.set(room.code, room);
    touch(room);
    void flushLive();
    koOpened(room);
    logger.info("ko_quick_created", { code: room.code });
    json(res, 200, { code: room.code, token: j.player.token, id: j.player.id, joined: false, state: playerView(room, j.player) });
  });

  app.post("/lv/r/:code/ko", async (req, res) => {
    const b = req.body || {};
    const token = String(b.t || "");
    if (!token || !allow("ko:" + token, 30, 60_000)) return json(res, 429, { error: "Slow down." });
    const room = await loadRoom(cleanCode(req.params.code));
    if (!room || !room.ko) return json(res, 404, { error: "No challenge with that code." });
    const p = Object.values(room.players).find((x) => x.token === token && !x.kicked);
    if (!p) return json(res, 404, { error: "Join first." });
    const now = Date.now();
    p.lastSeen = now;
    const host = room.players[room.ko.hostId];
    // the host runs it; if the host has left (offline), anyone in the room can take over
    if (p.id !== room.ko.hostId) {
      if (host && !host.kicked && online(room.code, host, now)) return json(res, 403, { error: `Only ${host.name} can do that.` });
      room.ko.hostId = p.id;
    }
    const action = String(b.action);
    if (action === "start") {
      const r = E.koStart(room, now, (x) => online(room.code, x, now));
      if (!r.ok) return json(res, 400, { error: r.error });
    } else if (action === "pub") {
      room.ko.pub = !!b.on; room.version++; room.pversion++;
      if (room.ko.pub && room.phase === "lobby") koOpened(room);
    } else if (action === "per") {
      if (room.phase !== "lobby") return json(res, 400, { error: "Pick this before the game starts." });
      if (!E.KO_PER_CHOICES.includes(Number(b.n))) return json(res, 400, { error: "Pick 5, 7 or 10." });
      room.ko.per = Number(b.n); room.version++; room.pversion++;
    } else if (action === "again") {
      if (room.phase !== "final" && room.phase !== "lobby") return json(res, 400, { error: "Wait for this game to finish." });
      if (room.phase === "final") E.koAgain(room, pickSet(bank(), { tiers: [room.ko.tier], count: 45 }), now);
    } else return json(res, 400, { error: "Unknown action." });
    touch(room);
    pushRoom(room, true);
    json(res, 200, { ok: true, state: playerView(room, p) });
  });

  app.get("/lv/r/:code/peek", async (req, res) => {
    const room = await loadRoom(cleanCode(req.params.code));
    if (!room) return json(res, 404, { error: "No game with that code. Check the screen and try again." });
    json(res, 200, { code: room.code, title: room.title, church: room.church, phase: room.phase, n: E.activePlayers(room).length, max: room.maxPlayers,
      locked: room.locked, teams: room.teams, full: E.activePlayers(room).length >= room.maxPlayers, avatars: E.AVATARS,
      ko: room.ko ? { host: room.players[room.ko.hostId]?.name || "", rule: E.koRule(room.ko) } : undefined });
  });

  app.post("/lv/r/:code/join", async (req, res) => {
    if (!allow("join:" + ipOf(req), 600, 60_000)) return json(res, 429, { error: "Too many joins from this network. Try again in a minute." });
    const room = await loadRoom(cleanCode(req.params.code));
    if (!room) return json(res, 404, { error: "No game with that code." });
    const r = E.joinRoom(room, req.body || {}, Date.now());
    if (!r.ok) return json(res, r.code === "full" ? 403 : 400, { error: r.error, code: r.code });
    touch(room);
    pushRoom(room);
    json(res, 200, { token: r.player.token, id: r.player.id, rejoined: r.rejoined, state: playerView(room, r.player) });
  });

  app.post("/lv/r/:code/answer", async (req, res) => {
    const b = req.body || {};
    const token = String(b.t || "");
    if (!token || !allow("ans:" + token, 40, 60_000)) return json(res, 429, { error: "Slow down." });
    const room = await loadRoom(cleanCode(req.params.code));
    if (!room) return json(res, 404, { error: "No game with that code." });
    const r = E.submitAnswer(room, token, Number(b.qi), b.c, b.ms, Date.now());
    if (!r.ok) return json(res, r.code === "unknown" ? 404 : 409, { error: r.error, code: r.code });
    touch(room);
    if (r.allIn) { E.tick(room, Date.now()); }
    pushRoom(room);
    const a = r.answer;
    const p = Object.values(room.players).find((x) => x.token === token)!;
    json(res, 200, { ok: true, already: !!r.already, c: a.c, ...(room.instant ? { correct: a.ok, a: r.correctIndex, pts: a.pts, speed: a.speed, streakBonus: a.streak, streak: p.streak, score: p.score } : {}) });
  });

  // ---- v3.8.0 voice chat: ICE servers + signaling relay (knockout rooms only) ----
  // TURN is optional and comes only from env, never from git: BA_TURN_URLS (comma-separated) + BA_TURN_USER + BA_TURN_CRED,
  // and a second relay BA_TURN2_URLS + BA_TURN2_USER + BA_TURN2_CRED (v3.8.2). STUN always.
  app.get("/lv/ice", (_req, res) => {
    const ice: any[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
    let turn = 0;
    for (const k of ["BA_TURN", "BA_TURN2"]) {
      const urls = String(process.env[k + "_URLS"] || "").split(",").map((x) => x.trim()).filter((x) => /^turns?:/.test(x));
      if (urls.length) { ice.push({ urls, username: process.env[k + "_USER"] || "", credential: process.env[k + "_CRED"] || "" }); turn++; }
    }
    res.setHeader("Cache-Control", "no-store");
    res.json({ iceServers: ice, max: VOICE_MAX, turn: turn > 0 });
  });
  const vPlayer = (room: E.LRoom, token: string) => Object.values(room.players).find((x) => x.token === token && !x.kicked);
  const vDrain = (room: E.LRoom, id: string) => { const k = room.code + ":" + id; const q = vbox.get(k) || []; vbox.delete(k); return q; };
  app.get("/lv/r/:code/vc", async (req, res) => {
    const token = String(req.query.t || "");
    if (!token || !allow("vcp:" + token, 120, 60_000)) return json(res, 429, { error: "Slow down." });
    const room = rooms.get(cleanCode(req.params.code));
    if (!room || !room.ko) return json(res, 404, { error: "No voice here." });
    const p = vPlayer(room, token);
    if (!p) return json(res, 404, { error: "Join first." });
    const m = voice.get(room.code)?.get(p.id);
    if (m) m.at = Date.now();
    json(res, 200, { roster: vRoster(room), box: m ? vDrain(room, p.id) : [] });
  });
  app.post("/lv/r/:code/vc", async (req, res) => {
    const b = req.body || {};
    const token = String(b.t || "");
    if (!token || !allow("vc:" + token, 900, 60_000)) return json(res, 429, { error: "Slow down." });
    const room = rooms.get(cleanCode(req.params.code)) || (await loadRoom(cleanCode(req.params.code)));
    if (!room || !room.ko) return json(res, 404, { error: "Voice works in group games only." });
    const p = vPlayer(room, token);
    if (!p) return json(res, 404, { error: "Join first." });
    const now = Date.now();
    p.lastSeen = now;
    const a = String(b.a || "");
    let m = voice.get(room.code);
    const me = m?.get(p.id);
    if (me) me.at = now;
    if (a === "join") {
      if (!me) {
        if ((m?.size || 0) >= VOICE_MAX) return json(res, 403, { error: `Voice is full (${VOICE_MAX} people). You can still play.`, code: "full", roster: vRoster(room) });
        if (!m) { m = new Map(); voice.set(room.code, m); }
        m.set(p.id, { id: p.id, muted: true, at: now });
        vbox.delete(room.code + ":" + p.id);
      }
      vBroadcastRoster(room);
    } else if (a === "leave") {
      if (vRemove(room, p.id)) vBroadcastRoster(room);
      return json(res, 200, { ok: true });
    } else if (a === "mute") {
      if (!me) return json(res, 409, { error: "Not in voice.", code: "out" });
      const mu = b.m !== false;
      if (me.muted !== mu) { me.muted = mu; vBroadcastRoster(room); }
    } else if (a === "sig") {
      // one or more { to, d } messages, in order (a phone batches its ICE candidates)
      if (!me) return json(res, 409, { error: "Not in voice.", code: "out" });
      const list: any[] = Array.isArray(b.list) ? b.list.slice(0, 40) : [{ to: b.to, d: b.d }];
      if (JSON.stringify(list).length > 40_000) return json(res, 413, { error: "Too big." });
      for (const x of list) {
        const to = String(x?.to || ""), d = x?.d;
        if (!m?.has(to) || to === p.id || !d || typeof d !== "object") continue;
        vSend(room, to, { type: "sig", from: p.id, d });
      }
    } else return json(res, 400, { error: "Unknown action." });
    json(res, 200, { ok: true, me: p.id, roster: vRoster(room), box: voice.get(room.code)?.has(p.id) ? vDrain(room, p.id) : [] });
  });

  // live stream: SSE. ?t=<player token> or ?key=<host key>
  app.get("/lv/r/:code/sse", async (req, res) => {
    const room = await loadRoom(cleanCode(req.params.code));
    if (!room) return json(res, 404, { error: "No game with that code." });
    const key = req.query.key, token = String(req.query.t || "");
    const role: "host" | "player" = key ? "host" : "player";
    if (role === "host" && !hostOk(room, key)) return json(res, 403, { error: "Not the host." });
    const p = role === "player" ? Object.values(room.players).find((x) => x.token === token) : undefined;
    if (role === "player" && !p) return json(res, 404, { error: "Join first." });
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
    res.write("retry: 2000\n\n");
    const c: Conn = { res, role, token: p?.token, sent: -1, at: Date.now() };
    if (!conns.has(room.code)) conns.set(room.code, new Set());
    conns.get(room.code)!.add(c);
    if (p) { p.lastSeen = Date.now(); room.version++; }
    sse(c, role === "host" ? hostView(room) : playerView(room, p));
    c.sent = role === "host" ? room.version : room.pversion;
    if (p && room.ko && voice.has(room.code)) { // v3.8.0: who is in voice, plus anything that waited while this phone was away
      const k = room.code + ":" + p.id, q = vbox.get(k) || [];
      vbox.delete(k);
      try { for (const msg of [vRoster(room), ...q]) res.write(`event: vc\ndata: ${JSON.stringify(msg)}\n\n`); } catch {}
    }
    req.on("close", () => {
      conns.get(room.code)?.delete(c);
      if (p) { p.lastSeen = Date.now(); room.version++; }
    });
  });

  // long-poll fallback: returns at once when the state moved past ?v, else waits up to 20 s
  app.get("/lv/r/:code/poll", async (req, res) => {
    const room = await loadRoom(cleanCode(req.params.code));
    if (!room) return json(res, 404, { error: "No game with that code." });
    const key = req.query.key, token = String(req.query.t || "");
    const role: "host" | "player" = key ? "host" : "player";
    if (role === "host" && !hostOk(room, key)) return json(res, 403, { error: "Not the host." });
    const p = role === "player" ? Object.values(room.players).find((x) => x.token === token) : undefined;
    if (role === "player" && !p) return json(res, 404, { error: "Join first." });
    if (!allow("poll:" + (token || "host" + room.code), 240, 60_000)) return json(res, 429, { error: "Slow down." });
    if (p) p.lastSeen = Date.now();
    const since = Number(req.query.v);
    const cur = role === "host" ? room.version : room.pversion;
    if (!Number.isFinite(since) || since !== cur) return json(res, 200, role === "host" ? hostView(room) : playerView(room, p));
    const w: Waiter = { res, role, token: p?.token, since, timer: setTimeout(() => finishWait(room.code, w, role === "host" ? hostView(room) : playerView(room, p)), 20_000) };
    if (!waiters.has(room.code)) waiters.set(room.code, new Set());
    waiters.get(room.code)!.add(w);
    req.on("close", () => { clearTimeout(w.timer); waiters.get(room.code)?.delete(w); });
  });

  app.post("/lv/r/:code/host", async (req, res) => {
    const room = await loadRoom(cleanCode(req.params.code));
    if (!room) return json(res, 404, { error: "No game with that code." });
    const b = req.body || {};
    if (!hostOk(room, b.key)) return json(res, 403, { error: "Not the host." });
    const now = Date.now();
    const was = room.phase;
    switch (String(b.action)) {
      case "next": E.advance(room, now); break;
      case "skip": if (room.phase === "intro") E.openAnswers(room, now); else if (room.phase === "question") E.reveal(room, now); break;
      case "end": E.finish(room, now); break;
      case "kick": E.kick(room, String(b.pid || "")); break;
      case "lock": room.locked = !!b.on; room.version++; break;
      case "public": room.public = !!b.on; room.version++; break;
      case "auto": room.auto = !!b.on; room.version++; break;
      case "instant": room.instant = !!b.on; room.version++; room.pversion++; break;
      case "extend": if (room.phase === "question") { room.endsAt += 10_000; room.version++; room.pversion++; } break;
      case "timer": if ([10, 15, 20, 30, 45, 60].includes(Number(b.s))) { room.timer = Number(b.s); room.version++; } break;
      default: return json(res, 400, { error: "Unknown action." });
    }
    touch(room);
    if (room.phase === "final" && was !== "final") void saveResults(room);
    pushRoom(room, true);
    json(res, 200, hostView(room));
  });

  // share card: the host's screen renders the results card and uploads it so WhatsApp previews show it
  app.post("/lv/r/:code/card", async (req, res) => {
    const room = await loadRoom(cleanCode(req.params.code));
    const b = req.body || {};
    if (!room || !hostOk(room, b.key)) return json(res, 403, { error: "Not the host." });
    const m = String(b.jpeg || "").match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return json(res, 400, { error: "Bad image." });
    const buf = Buffer.from(m[1], "base64");
    if (buf.length > 600_000) return json(res, 413, { error: "Image too big." });
    const pool = baPool();
    if (!pool) return json(res, 503, { error: "Storage is off." });
    await saveResults(room);
    await pool.query(`update ${SCH}.live_results set card=$2 where code=$1`, [room.code, buf]);
    json(res, 200, { ok: true, url: `/lv/card/${room.code}.jpg` });
  });

  app.get("/lv/card/:code.jpg", async (req, res) => {
    const pool = baPool();
    const code = cleanCode(req.params.code);
    try {
      const r = pool ? await pool.query(`select card from ${SCH}.live_results where code=$1 and card is not null`, [code]) : { rows: [] as any[] };
      if (!r.rows.length) return res.redirect(302, "/v3/og-live.jpg");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.type("jpeg").send(r.rows[0].card);
    } catch { res.redirect(302, "/v3/og-live.jpg"); }
  });

  app.get("/lv/results/:code", async (req, res) => {
    const code = cleanCode(req.params.code);
    const mem = rooms.get(code);
    if (mem && mem.phase === "final") return json(res, 200, E.summary(mem));
    const pool = baPool();
    try {
      const r = pool ? await pool.query(`select summary from ${SCH}.live_results where code=$1`, [code]) : { rows: [] as any[] };
      if (!r.rows.length) return json(res, 404, { error: "No results for that game yet." });
      json(res, 200, r.rows[0].summary);
    } catch { json(res, 503, { error: "Try again." }); }
  });

  // ---- pages ----
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
  const page = (file: string, req: Request, res: Response, og: { title: string; desc: string; image: string }) => {
    let html = "";
    try { html = fs.readFileSync(path.join(webDir, file), "utf8"); } catch { return res.redirect(302, "/"); }
    const origin = `${req.protocol}://${req.get("host")}`;
    const tags = `<meta property="og:title" content="${esc(og.title)}"><meta property="og:description" content="${esc(og.desc)}"><meta property="og:image" content="${origin}${og.image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:url" content="${origin}${req.originalUrl}"><meta property="og:type" content="website"><meta name="twitter:card" content="summary_large_image">`;
    html = html.replace(/<!--OG-->[\s\S]*?<!--\/OG-->/, tags).replace(/<title>[^<]*<\/title>/, `<title>${esc(og.title)}</title>`);
    res.setHeader("Cache-Control", "no-cache");
    res.type("html").send(html);
  };
  app.get(["/live", "/live/", "/host"], (req, res) => page("live.html", req, res, { title: "Bible Arena Live — church quiz night on the big screen", desc: "Put a Bible quiz on the projector. Up to 200 people play on their phones with a code. Teams, live leaderboard, podium finale. Free.", image: "/v3/og-live.jpg" }));
  app.get(["/join", "/join/"], (req, res) => page("play.html", req, res, { title: "Join Bible Arena Live", desc: "Enter the code on the screen and play along on your phone. No account needed.", image: "/v3/og-live.jpg" }));
  app.get("/j/:code", async (req, res) => {
    const room = await loadRoom(cleanCode(req.params.code)).catch(() => null);
    if (room?.ko) {
      const n = E.activePlayers(room).length;
      return page("play.html", req, res, { title: `⚔️ ${room.players[room.ko.hostId]?.name || "Someone"} challenges you on Bible Arena`, desc: `Bible knockout: ${n} in so far. Tap to join, no account needed. Lose a round and you watch; last one standing wins.`, image: "/v3/og-duel.jpg?v=3.6.0" });
    }
    const title = room ? `Join "${room.title}" on Bible Arena Live` : "Join Bible Arena Live";
    page("play.html", req, res, { title, desc: room?.church ? `${room.church} · tap to play along on your phone, no account needed.` : "Tap to play along on your phone. No account needed.", image: "/v3/og-live.jpg" });
  });
  app.get("/live/r/:code", async (req, res) => {
    const code = cleanCode(req.params.code);
    let title = "Bible Arena Live results", desc = "Church quiz night on Bible Arena Live.";
    let image = "/v3/og-live.jpg";
    try {
      const pool = baPool();
      const r = pool ? await pool.query(`select summary, card is not null as has_card from ${SCH}.live_results where code=$1`, [code]) : { rows: [] as any[] };
      const s = r.rows[0]?.summary || (rooms.get(code)?.phase === "final" ? E.summary(rooms.get(code)!) : null);
      if (s) {
        const medals = ["🥇", "🥈", "🥉"];
        title = `${s.title}${s.church ? " · " + s.church : ""}: the winners`;
        desc = (s.podium || []).map((p: any, i: number) => `${medals[i]} ${p.name}`).join("  ") + (s.teams?.length ? `  ·  ${s.teams[0].emoji} ${s.teams[0].name} won` : "") + ` · ${s.players} players`;
      }
      if (r.rows[0]?.has_card) image = `/lv/card/${code}.jpg`;
    } catch {}
    page("play.html", req, res, { title, desc, image });
  });
}

/** For tests: direct access to the in-memory rooms. */
export const _rooms = rooms;
