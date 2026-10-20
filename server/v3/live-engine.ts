// Bible Arena Live: the quiz-night engine. Pure state transitions (no IO) so it can be tested
// directly; server/v3/live.ts wires it to HTTP, SSE/long-poll and Postgres snapshots.
import crypto from "node:crypto";

export type Phase = "lobby" | "intro" | "question" | "reveal" | "board" | "final";
export interface LQ {
  id: string; type: "mc" | "tf" | "who" | "gap" | "said" | "custom";
  q: string; o: string[]; a: number; r?: string; x?: string; clues?: string[]; cat?: string; tier?: string;
}
export interface LAnswer { c: number; ms: number; pts: number; ok: boolean; speed: number; streak: number; at: number }
export interface LPlayer {
  id: string; token: string; name: string; avatar: string; team: string | null;
  score: number; streak: number; best: number; correct: number; timeMs: number;
  joinedAt: number; lastSeen: number; answers: Record<string, LAnswer>; kicked?: boolean;
  prevRank?: number; rank?: number;
}
export interface LTeam { id: string; name: string; color: string; emoji: string }
export interface LRoom {
  code: string; hostKey: string; title: string; church: string; createdAt: number;
  teams: LTeam[] | null; questions: LQ[]; timer: number; intro: number;
  phase: Phase; qi: number; phaseAt: number; endsAt: number;
  players: Record<string, LPlayer>; version: number; pversion: number;
  locked: boolean; auto: boolean; instant: boolean; maxPlayers: number; endedAt?: number;
  /** listed in the app's "Live now" so anyone can join (v3.5.0) */
  public?: boolean;
  /** v3.6.0 "Challenge someone": a knockout room played from phones, no projector */
  ko?: LKo;
}
/** Knockout: rounds of a few questions; after each round the bottom half (by points in that round) is out and
 * watches; the last two play a longer final; one winner. "Play again" puts everyone back in the lobby. */
export interface LKo {
  hostId: string; tier: string; game: number;
  round: number; roundStart: number; roundLen: number;
  /** player id -> round they were knocked out in; -1 = joined mid-game or missed the start (watching) */
  out: Record<string, number>;
  lastOut: string[]; winner?: string;
  history: Array<{ round: number; out: string[]; left: number }>;
}
export const KO_MAX = 50;
export const KO_ROUND_LEN = 3;
export const KO_FINAL_LEN = 5;
export const KO_TIMER = 15;
export const KO_REVEAL_MS = 5000;
export const KO_BOARD_MS = 8000;
export const KO_RULE = "3 questions a round. After each round the bottom half (fewest points that round) is knocked out and watches. The last two play a 5-question final.";

export const MAX_PLAYERS = 200;
export const INTRO_MS = 4000;
export const GRACE_MS = 1000;          // answers landing just after zero still count (weak mobile data)
export const LATENCY_CREDIT_MS = 2500; // the most a phone's own clock can shave off the server's
export const AVATARS = ["🦁", "🐑", "🕊️", "🐟", "🌿", "⭐", "🔥", "👑", "📜", "🍇", "🌾", "⛵", "🐪", "🌈", "🏺", "🗝️", "🎺", "🪔", "🛡️", "🌻", "🐝", "🦅", "🍞", "💎"];
export const TEAM_PRESETS: Record<string, Array<[string, string, string]>> = {
  "youth-choir": [["Youth", "#FF5D73", "🔥"], ["Choir", "#5AB8FF", "🎶"]],
  "men-women": [["Men", "#3CC9C0", "🛡️"], ["Women", "#F5B942", "👑"]],
};
const TEAM_COLORS: Array<[string, string]> = [["#FF5D73", "🔥"], ["#5AB8FF", "🎶"], ["#3DDC97", "🌿"], ["#F5B942", "👑"]];
const BLOCK = /\b(fuck|shit|bitch|asshole|bastard|dick|pussy|nigga|nigger|cunt|whore|slut|porn|sex)\b/i;

export const rid = (n = 12) => crypto.randomBytes(n).toString("base64url");

export function cleanName(raw: unknown): string {
  let s = String(raw ?? "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 18);
  if (BLOCK.test(s)) s = "";
  return s;
}

export function makeTeams(preset: unknown, names?: unknown): LTeam[] | null {
  if (preset && typeof preset === "string" && TEAM_PRESETS[preset]) {
    return TEAM_PRESETS[preset].map(([name, color, emoji], i) => ({ id: "t" + i, name, color, emoji }));
  }
  if (preset === "custom" && Array.isArray(names)) {
    const list = names.map((n) => cleanName(n)).filter(Boolean).slice(0, 4);
    if (list.length >= 2) return list.map((name, i) => ({ id: "t" + i, name, color: TEAM_COLORS[i][0], emoji: TEAM_COLORS[i][1] }));
  }
  return null;
}

export function createRoom(opts: {
  code: string; title?: string; church?: string; teams?: LTeam[] | null; questions: LQ[];
  timer?: number; auto?: boolean; instant?: boolean; public?: boolean; now: number;
}): LRoom {
  const timer = [10, 15, 20, 30, 45, 60].includes(Number(opts.timer)) ? Number(opts.timer) : 20;
  return {
    code: opts.code, hostKey: rid(18), title: (String(opts.title || "").trim().slice(0, 60)) || "Bible Quiz Night",
    church: String(opts.church || "").trim().slice(0, 60), createdAt: opts.now,
    teams: opts.teams || null, questions: opts.questions.slice(0, 60), timer, intro: INTRO_MS,
    phase: "lobby", qi: -1, phaseAt: opts.now, endsAt: 0, players: {}, version: 1, pversion: 1,
    locked: false, auto: opts.auto === true, instant: opts.instant !== false, maxPlayers: MAX_PLAYERS,
    public: opts.public === true,
  };
}

const bump = (room: LRoom, players = true) => { room.version++; if (players) room.pversion++; };
export const activePlayers = (room: LRoom) => Object.values(room.players).filter((p) => !p.kicked);
/** Players still in the game: everyone in a normal room; in a knockout, those not yet knocked out. */
export const alivePlayers = (room: LRoom) => activePlayers(room).filter((p) => !room.ko || !(p.id in room.ko.out));

export type JoinResult = { ok: true; player: LPlayer; rejoined: boolean } | { ok: false; error: string; code: string };

export function joinRoom(room: LRoom, input: { name?: unknown; avatar?: unknown; team?: unknown; token?: unknown }, now: number): JoinResult {
  const token = typeof input.token === "string" ? input.token : "";
  if (token) {
    const back = Object.values(room.players).find((p) => p.token === token);
    if (back) {
      if (back.kicked) return { ok: false, error: "The host removed you from this game.", code: "kicked" };
      back.lastSeen = now;
      // a returning player may switch team only while the game has not started
      if (room.phase === "lobby" && room.teams && typeof input.team === "string" && room.teams.some((t) => t.id === input.team)) back.team = input.team;
      bump(room, false);
      return { ok: true, player: back, rejoined: true };
    }
  }
  if (room.phase === "final" && !room.ko) return { ok: false, error: "This game has finished.", code: "ended" };
  if (room.locked) return { ok: false, error: "The host has locked this game.", code: "locked" };
  const live = activePlayers(room);
  if (live.length >= room.maxPlayers) return { ok: false, error: `This room is full (${room.maxPlayers} players). Bigger rooms are coming with Church Premium.`, code: "full" };
  let name = cleanName(input.name);
  if (!name) return { ok: false, error: "Please enter a name (kind words only 🙂).", code: "name" };
  const taken = new Set(live.map((p) => p.name.toLowerCase()));
  if (taken.has(name.toLowerCase())) {
    let i = 2;
    while (taken.has(`${name} ${i}`.toLowerCase())) i++;
    name = `${name.slice(0, 15)} ${i}`;
  }
  const avatar = AVATARS.includes(String(input.avatar)) ? String(input.avatar) : AVATARS[live.length % AVATARS.length];
  let team: string | null = null;
  if (room.teams) {
    team = typeof input.team === "string" && room.teams.some((t) => t.id === input.team) ? input.team : null;
    if (!team) { // balance: the smallest team
      const counts = room.teams.map((t) => ({ id: t.id, n: live.filter((p) => p.team === t.id).length }));
      counts.sort((a, b) => a.n - b.n);
      team = counts[0].id;
    }
  }
  const player: LPlayer = {
    id: rid(6), token: rid(16), name, avatar, team, score: 0, streak: 0, best: 0, correct: 0, timeMs: 0,
    joinedAt: now, lastSeen: now, answers: {},
  };
  room.players[player.id] = player;
  if (room.ko && room.phase !== "lobby") room.ko.out[player.id] = -1; // joined mid-game or after the end: watches until Play again
  bump(room);
  return { ok: true, player, rejoined: false };
}

export function kick(room: LRoom, pid: string): boolean {
  const p = room.players[pid];
  if (!p || p.kicked) return false;
  p.kicked = true;
  bump(room);
  return true;
}

// ---------- scoring ----------
/** Points for one answer: 500–1000 for a correct one (faster = more), plus a streak bonus. */
export function scoreAnswer(ok: boolean, ms: number, limitMs: number, streakBefore: number): { pts: number; speed: number; streak: number } {
  if (!ok) return { pts: 0, speed: 0, streak: 0 };
  const frac = Math.max(0, Math.min(1, ms / limitMs));
  const base = 500;
  const speed = Math.round(500 * (1 - frac));
  const run = streakBefore + 1;
  const streak = run >= 2 ? Math.min(500, (run - 1) * 100) : 0;
  return { pts: base + speed + streak, speed, streak };
}

/** Answer time: the server's measure, but a phone may claim up to LATENCY_CREDIT_MS back for slow data. */
export function effectiveMs(serverMs: number, clientMs: unknown): number {
  const s = Math.max(0, serverMs);
  const c = Number(clientMs);
  if (!Number.isFinite(c) || c < 0) return s;
  return Math.round(Math.max(Math.max(0, s - LATENCY_CREDIT_MS), Math.min(s, c)));
}

export const answerStart = (room: LRoom) => room.phaseAt; // question phase starts after the intro

export function startQuestion(room: LRoom, now: number, index = room.qi + 1): boolean {
  if (index >= room.questions.length) return finish(room, now);
  room.qi = index;
  room.phase = "intro";
  room.phaseAt = now;
  room.endsAt = now + room.intro;
  for (const p of activePlayers(room)) p.prevRank = p.rank;
  bump(room);
  return true;
}

export function openAnswers(room: LRoom, now: number): void {
  room.phase = "question";
  room.phaseAt = now;
  room.endsAt = now + room.timer * 1000;
  bump(room);
}

export type AnswerResult =
  | { ok: true; already?: boolean; answer: LAnswer; correctIndex?: number; allIn: boolean }
  | { ok: false; error: string; code: string };

export function submitAnswer(room: LRoom, token: string, qi: number, choice: unknown, clientMs: unknown, now: number): AnswerResult {
  const p = Object.values(room.players).find((x) => x.token === token);
  if (!p) return { ok: false, error: "Not in this game. Join again.", code: "unknown" };
  if (p.kicked) return { ok: false, error: "The host removed you from this game.", code: "kicked" };
  p.lastSeen = now;
  if (room.ko && p.id in room.ko.out) return { ok: false, error: "You're out of this one. Watch who wins!", code: "out" };
  if (Number(qi) !== room.qi) return { ok: false, error: "That question has closed.", code: "stale" };
  const q = room.questions[room.qi];
  const prev = p.answers[String(room.qi)];
  if (prev) return { ok: true, already: true, answer: prev, correctIndex: room.instant ? q.a : undefined, allIn: false };
  if (room.phase !== "question" || now > room.endsAt + GRACE_MS) return { ok: false, error: "Too late, the answers are closed.", code: "closed" };
  const c = Math.floor(Number(choice));
  if (!Number.isInteger(c) || c < 0 || c >= q.o.length) return { ok: false, error: "Pick one of the answers.", code: "choice" };
  const limit = room.timer * 1000;
  const serverMs = Math.min(limit, now - answerStart(room));
  const ms = Math.min(limit, effectiveMs(serverMs, clientMs));
  const ok = c === q.a;
  const s = scoreAnswer(ok, ms, limit, p.streak);
  const answer: LAnswer = { c, ms, pts: s.pts, ok, speed: s.speed, streak: s.streak, at: now };
  p.answers[String(room.qi)] = answer;
  p.score += s.pts;
  if (ok) { p.streak++; p.correct++; p.best = Math.max(p.best, p.streak); p.timeMs += ms; } else p.streak = 0;
  bump(room, false);
  const live = alivePlayers(room);
  const allIn = live.length > 0 && live.every((x) => x.answers[String(room.qi)]);
  return { ok: true, answer, correctIndex: room.instant ? q.a : undefined, allIn };
}

export function reveal(room: LRoom, now: number): void {
  if (room.phase !== "question" && room.phase !== "intro") return;
  room.phase = "reveal";
  room.phaseAt = now;
  // a no-answer streak breaks: players who did not answer lose their run
  for (const p of activePlayers(room)) if (!p.answers[String(room.qi)]) p.streak = 0;
  ranks(room);
  bump(room);
}

export function showBoard(room: LRoom, now: number): void {
  room.phase = "board";
  room.phaseAt = now;
  ranks(room);
  bump(room);
}

export function finish(room: LRoom, now: number): boolean {
  room.phase = "final";
  room.phaseAt = now;
  room.endedAt = now;
  ranks(room);
  bump(room);
  return true;
}

/** Host's "next" button: lobby → Q1 intro; reveal → board; board → next intro (or final). */
export function advance(room: LRoom, now: number): void {
  if (room.ko) return koAdvance(room, now);
  switch (room.phase) {
    case "lobby": if (activePlayers(room).length && room.questions.length) startQuestion(room, now, 0); break;
    case "intro": openAnswers(room, now); break;
    case "question": reveal(room, now); break;
    case "reveal": room.qi >= room.questions.length - 1 ? finish(room, now) : showBoard(room, now); break;
    case "board": startQuestion(room, now); break;
    default: break;
  }
}

/** Timer-driven transitions; returns true when the state changed. */
export const AUTO_REVEAL_MS = 7000;
export const AUTO_BOARD_MS = 6000;
export function tick(room: LRoom, now: number): boolean {
  if (room.phase === "intro" && now >= room.endsAt) { openAnswers(room, now); return true; }
  if (room.ko) {
    if (room.phase === "reveal" && now >= room.phaseAt + KO_REVEAL_MS) { koAdvance(room, now); return true; }
    if (room.phase === "board" && now >= room.phaseAt + KO_BOARD_MS) { koAdvance(room, now); return true; }
  }
  if (room.auto && room.phase === "reveal" && now >= room.phaseAt + AUTO_REVEAL_MS) { advance(room, now); return true; }
  if (room.auto && room.phase === "board" && now >= room.phaseAt + AUTO_BOARD_MS) { advance(room, now); return true; }
  if (room.phase === "question") {
    const live = alivePlayers(room);
    const allIn = live.length > 0 && live.every((x) => x.answers[String(room.qi)]);
    if (now >= room.endsAt + GRACE_MS) { reveal(room, now); return true; }
    if (allIn) { // a short beat after the last answer, so the room feels the moment
      const last = Math.max(...live.map((x) => x.answers[String(room.qi)].at));
      if (now >= last + 900) { reveal(room, now); return true; }
    }
  }
  return false;
}

export function compare(a: LPlayer, b: LPlayer): number {
  return b.score - a.score || a.timeMs - b.timeMs || a.joinedAt - b.joinedAt;
}

export function ranks(room: LRoom): LPlayer[] {
  const list = activePlayers(room).sort(compare);
  let last: LPlayer | null = null;
  list.forEach((p, i) => {
    p.rank = last && last.score === p.score && last.timeMs === p.timeMs ? last.rank : i + 1;
    last = p;
  });
  return list;
}

export interface TeamTotal { id: string; name: string; color: string; emoji: string; members: number; total: number; avg: number; correct: number }
/** Team standings: ranked by the AVERAGE points per member so a bigger team has no edge. */
export function teamTotals(room: LRoom): TeamTotal[] {
  if (!room.teams) return [];
  const live = activePlayers(room);
  return room.teams.map((t) => {
    const m = live.filter((p) => p.team === t.id);
    const total = m.reduce((s, p) => s + p.score, 0);
    return { ...t, members: m.length, total, avg: m.length ? Math.round(total / m.length) : 0, correct: m.reduce((s, p) => s + p.correct, 0) };
  }).sort((a, b) => b.avg - a.avg || b.total - a.total);
}

export function distribution(room: LRoom, qi = room.qi): number[] {
  const q = room.questions[qi];
  const d = q ? q.o.map(() => 0) : [];
  for (const p of activePlayers(room)) { const a = p.answers[String(qi)]; if (a && d[a.c] != null) d[a.c]++; }
  return d;
}

export function answeredCount(room: LRoom, qi = room.qi): number {
  return activePlayers(room).filter((p) => p.answers[String(qi)]).length;
}

export function summary(room: LRoom) {
  const list = ranks(room);
  const totalAns = list.reduce((s, p) => s + Object.keys(p.answers).length, 0);
  const totalOk = list.reduce((s, p) => s + p.correct, 0);
  let hardest: { q: string; pct: number } | null = null;
  room.questions.forEach((q, i) => {
    if (i > room.qi) return;
    const n = list.filter((p) => p.answers[String(i)]).length;
    if (!n) return;
    const pct = Math.round((100 * list.filter((p) => p.answers[String(i)]?.ok).length) / n);
    if (!hardest || pct < hardest.pct) hardest = { q: q.type === "who" ? `Who am I? (${q.o[q.a]})` : q.q, pct };
  });
  let fastest: { name: string; ms: number } | null = null;
  for (const p of list) for (const a of Object.values(p.answers)) if (a.ok && (!fastest || a.ms < fastest.ms)) fastest = { name: p.name, ms: a.ms };
  return {
    code: room.code, title: room.title, church: room.church, at: room.endedAt || Date.now(),
    players: list.length, questions: Math.min(room.questions.length, room.qi + 1),
    accuracy: totalAns ? Math.round((100 * totalOk) / totalAns) : 0,
    podium: list.slice(0, 3).map((p) => ({ name: p.name, avatar: p.avatar, score: p.score, team: p.team, rank: p.rank })),
    top: list.slice(0, 10).map((p) => ({ name: p.name, avatar: p.avatar, score: p.score, rank: p.rank, team: p.team })),
    teams: teamTotals(room), hardest, fastest,
  };
}


// ---------- knockout (v3.6.0 "Challenge someone") ----------
export function makeKo(hostId: string, tier: string): LKo {
  return { hostId, tier, game: 1, round: 0, roundStart: 0, roundLen: KO_ROUND_LEN, out: {}, lastOut: [], history: [] };
}
/** Points and correct-answer time a player earned in the current knockout round. */
export function roundPoints(room: LRoom, p: LPlayer): { pts: number; ms: number; ok: number } {
  const ko = room.ko; let pts = 0, ms = 0, ok = 0;
  if (!ko) return { pts, ms, ok };
  for (let i = ko.roundStart; i < ko.roundStart + ko.roundLen && i <= room.qi; i++) {
    const a = p.answers[String(i)];
    if (a) { pts += a.pts; if (a.ok) { ms += a.ms; ok++; } }
  }
  return { pts, ms, ok };
}
/** Who is still in, best first in this round (round points, then faster correct answers, then total, then who joined first). */
export function koStandings(room: LRoom): LPlayer[] {
  const list = alivePlayers(room);
  const rp = new Map(list.map((p) => [p.id, roundPoints(room, p)]));
  return list.sort((a, b) => rp.get(b.id)!.pts - rp.get(a.id)!.pts || rp.get(a.id)!.ms - rp.get(b.id)!.ms || b.score - a.score || a.joinedAt - b.joinedAt);
}
function koNewRound(room: LRoom, now: number, startQi: number): boolean {
  const ko = room.ko!;
  ko.round++;
  ko.roundStart = startQi;
  ko.roundLen = alivePlayers(room).length <= 2 ? KO_FINAL_LEN : KO_ROUND_LEN;
  ko.lastOut = [];
  if (startQi + ko.roundLen > room.questions.length) ko.roundLen = Math.max(1, room.questions.length - startQi);
  if (startQi >= room.questions.length) return koEnd(room, now);
  return startQuestion(room, now, startQi);
}
function koEnd(room: LRoom, now: number): boolean {
  const ko = room.ko!;
  const top = koStandings(room)[0];
  ko.winner = top ? top.id : undefined;
  return finish(room, now);
}
/** End of a round: the bottom half is knocked out (at least one, never everyone). */
export function koCut(room: LRoom, now: number): void {
  const ko = room.ko!;
  const list = koStandings(room);
  const n = list.length;
  if (n <= 1) { koEnd(room, now); return; }
  const keep = n === 2 ? 1 : Math.ceil(n / 2);
  const out = list.slice(keep);
  for (const p of out) ko.out[p.id] = ko.round;
  ko.lastOut = out.map((p) => p.id);
  ko.history.push({ round: ko.round, out: ko.lastOut.slice(), left: keep });
  if (keep === 1) { ko.winner = list[0].id; finish(room, now); return; }
  showBoard(room, now);
}
/** Start (from the lobby): needs two players online; anyone who is not here right now watches this game. */
export function koStart(room: LRoom, now: number, isOnline: (p: LPlayer) => boolean): { ok: true } | { ok: false; error: string } {
  const ko = room.ko!;
  if (room.phase !== "lobby") return { ok: false, error: "The challenge has already started." };
  const here = activePlayers(room).filter((p) => isOnline(p));
  if (here.length < 2) return { ok: false, error: "You need at least 2 players. Share the link!" };
  for (const p of activePlayers(room)) if (!isOnline(p)) ko.out[p.id] = -1;
  ko.round = 0;
  koNewRound(room, now, 0);
  return { ok: true };
}
export function koAdvance(room: LRoom, now: number): void {
  const ko = room.ko!;
  switch (room.phase) {
    case "intro": openAnswers(room, now); break;
    case "question": reveal(room, now); break;
    case "reveal":
      if (room.qi >= ko.roundStart + ko.roundLen - 1 || room.qi >= room.questions.length - 1) koCut(room, now);
      else startQuestion(room, now, room.qi + 1);
      break;
    case "board": koNewRound(room, now, room.qi + 1); break;
    default: break;
  }
}
/** "Play again": everyone (knocked out or not, plus anyone who joined meanwhile) back in the lobby with a new set. */
export function koAgain(room: LRoom, questions: LQ[], now: number): void {
  const ko = room.ko!;
  room.questions = questions.slice(0, 60);
  room.phase = "lobby"; room.qi = -1; room.phaseAt = now; room.endsAt = 0; delete room.endedAt;
  room.createdAt = now; // a room that keeps being played stays alive
  ko.game++; ko.round = 0; ko.roundStart = 0; ko.roundLen = KO_ROUND_LEN; ko.out = {}; ko.lastOut = []; ko.history = []; delete ko.winner;
  for (const p of Object.values(room.players)) {
    p.score = 0; p.streak = 0; p.best = 0; p.correct = 0; p.timeMs = 0; p.answers = {}; delete p.rank; delete p.prevRank;
  }
  bump(room);
}
