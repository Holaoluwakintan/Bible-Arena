#!/usr/bin/env node
// Bible Arena Live: simulated quiz night. N headless players join a real room, answer on SSE or
// long-poll, some drop and reconnect mid-game, and the script checks every score adds up.
// Usage: node scripts/live-sim.mjs <base-url> [players=40] [questions=5]
const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const N = Number(process.argv[3] || 40);
const QN = Number(process.argv[4] || 5);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
async function post(path, body) {
  const t = Date.now();
  const r = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j, ms: Date.now() - t };
}
const pct = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };
const stats = { joinMs: [], answerMs: [], pushLag: [], errors: [], answers: 0, accepted: 0, reconnects: 0, sse: 0, poll: 0 };

// --- host creates the room ---
const create = await post("/lv/rooms", { title: "Grace Chapel Youth Quiz Night (load test)", church: "Simulation", teams: "youth-choir", timer: 15, instant: true,
  bank: { cats: ["people", "events", "places", "myth", "who", "verse"], tiers: ["b", "s"], count: QN } });
if (create.status !== 200) { console.error("create failed", create); process.exit(1); }
const { code, hostKey } = create.j;
log(`room ${code} with ${create.j.questions} questions; ${N} players joining`);
let phaseChangedAt = 0, hostPhase = "lobby", actionId = 0, expectPhase = "";
const NEXT = { lobby: "intro", board: "intro", reveal: "board" };
const hostAct = async (action, expect) => { phaseChangedAt = Date.now(); actionId++; expectPhase = expect || ""; const r = await post(`/lv/r/${code}/host`, { key: hostKey, action }); if (r.status !== 200) stats.errors.push("host " + action + " " + r.status); hostPhase = r.j.phase; return r.j; };

// --- players ---
class Player {
  constructor(i) { this.i = i; this.name = "Sim " + (i + 1); this.mode = i % 3 === 2 ? "poll" : "sse"; this.v = -1; this.state = null; this.ptsSum = 0; this.answered = new Set(); this.alive = true; this.ctl = null; }
  async join() {
    const r = await post(`/lv/r/${code}/join`, { name: this.name, avatar: "🐑", team: this.i % 2 ? "t1" : "t0", token: this.token });
    stats.joinMs.push(r.ms);
    if (r.status !== 200) { stats.errors.push(`join ${this.i} ${r.status} ${r.j.error}`); return false; }
    this.token = r.j.token; this.id = r.j.id; this.onState(r.j.state);
    return true;
  }
  onState(s) {
    if (!s) return;
    // push latency: host presses Next → this phone hears the new phase
    if (expectPhase && s.phase === expectPhase && this.lagFor !== actionId) { this.lagFor = actionId; stats.pushLag.push(Date.now() - phaseChangedAt); }
    this.state = s; this.v = s.v;
    if (s.phase === "question" && !this.answered.has(s.qi) && !(s.me && s.me.ans)) this.answer(s);
  }
  async answer(s) {
    this.answered.add(s.qi);
    const delay = 300 + Math.random() * 5000;
    await sleep(delay);
    const c = Math.floor(Math.random() * s.q.o.length);
    stats.answers++;
    let r;
    for (let k = 0; k < 3; k++) { try { r = await post(`/lv/r/${code}/answer`, { t: this.token, qi: s.qi, c, ms: Math.round(delay) }); break; } catch (e) { await sleep(400); } }
    if (!r) { stats.errors.push("answer network " + this.i); return; }
    stats.answerMs.push(r.ms);
    if (r.status === 200) { stats.accepted++; if (!r.j.already) this.ptsSum += r.j.pts || 0; }
    else stats.errors.push(`answer ${this.i} q${s.qi} ${r.status} ${r.j.error}`);
  }
  async listen() {
    while (this.alive) {
      try { if (this.mode === "sse") await this.sse(); else await this.poll(); }
      catch (e) { if (this.alive && !(e && e.name === "AbortError")) await sleep(500); }
    }
  }
  async sse() {
    stats.sse++;
    this.ctl = new AbortController();
    const r = await fetch(`${BASE}/lv/r/${code}/sse?t=${encodeURIComponent(this.token)}`, { signal: this.ctl.signal, headers: { Accept: "text/event-stream" } });
    if (!r.ok) throw new Error("sse " + r.status);
    const dec = new TextDecoder(); let buf = "";
    for await (const chunk of r.body) {
      buf += dec.decode(chunk, { stream: true });
      let k;
      while ((k = buf.indexOf("\n\n")) >= 0) {
        const ev = buf.slice(0, k); buf = buf.slice(k + 2);
        for (const line of ev.split("\n")) if (line.startsWith("data: ")) { try { this.onState(JSON.parse(line.slice(6))); } catch (e) {} }
      }
    }
  }
  async poll() {
    stats.poll++;
    this.ctl = new AbortController();
    const r = await fetch(`${BASE}/lv/r/${code}/poll?t=${encodeURIComponent(this.token)}&v=${this.v}`, { signal: this.ctl.signal });
    if (r.ok) this.onState(await r.json()); else { stats.errors.push("poll " + r.status); await sleep(1000); }
  }
  async drop() { // weak data: the connection dies, the phone rejoins with its saved token
    stats.reconnects++;
    try { this.ctl && this.ctl.abort(); } catch (e) {}
    await sleep(1500 + Math.random() * 2000);
    await this.join();
  }
}

const players = Array.from({ length: N }, (_, i) => new Player(i));
// join in waves, like people arriving
for (let i = 0; i < N; i += 10) { await Promise.all(players.slice(i, i + 10).map((p) => p.join())); await sleep(150); }
players.forEach((p) => p.listen());
await sleep(2500);
let hv = await (await fetch(`${BASE}/lv/r/${code}/poll?key=${hostKey}&v=-1`)).json();
log(`lobby: ${hv.n} players (teams ${hv.teams.map((t) => t.name + " " + t.members).join(", ")})`);

const qn = create.j.questions;
for (let q = 0; q < qn; q++) {
  await hostAct("next", "intro"); // lobby or board → intro
  // a few phones drop mid-question and come back
  if (q === 1) players.filter((p) => p.i % 7 === 3).forEach((p) => p.drop());
  // wait for the reveal (everyone answered or time up: intro 4 s + 15 s + grace)
  const deadline = Date.now() + 26000;
  while (Date.now() < deadline) {
    hv = await (await fetch(`${BASE}/lv/r/${code}/poll?key=${hostKey}&v=-1`)).json();
    if (hv.phase === "reveal") break;
    await sleep(400);
  }
  log(`Q${q + 1}: ${hv.phase}, ${hv.answered}/${hv.n} answered, dist ${JSON.stringify(hv.dist)}`);
  await sleep(800);
  if (q < qn - 1) await hostAct("next", "board"); // reveal → board
  else await hostAct("next", "final"); // last reveal → final
  await sleep(1200);
}
await sleep(2000);
hv = await (await fetch(`${BASE}/lv/r/${code}/poll?key=${hostKey}&v=-1`)).json();
players.forEach((p) => { p.alive = false; try { p.ctl && p.ctl.abort(); } catch (e) {} });

// --- checks ---
const byName = new Map(hv.players.map((p) => [p.name, p]));
let mismatches = 0;
for (const p of players) { const s = byName.get(p.name); if (!s || s.score !== p.ptsSum) { mismatches++; if (mismatches < 5) console.log("score mismatch", p.name, s && s.score, p.ptsSum); } }
const phoneFinal = players.filter((p) => p.state && p.state.phase === "final").length;
const teamOk = hv.teams.every((t) => { const m = hv.players.filter((p) => p.team === t.id); const tot = m.reduce((a, p) => a + p.score, 0); return t.members === m.length && t.total === tot && t.avg === (m.length ? Math.round(tot / m.length) : 0); });
const res = await fetch(`${BASE}/lv/results/${code}`); const summary = res.ok ? await res.json() : null;
const out = {
  base: BASE, code, players: N, questions: qn, finalPhase: hv.phase, playersInRoom: hv.n,
  answersSent: stats.answers, answersAccepted: stats.accepted, scoreMismatches: mismatches, phonesSawFinal: phoneFinal,
  teamTotalsConsistent: teamOk, reconnects: stats.reconnects, sseStreams: stats.sse, pollRequests: stats.poll,
  joinMs: { p50: pct(stats.joinMs, 50), p95: pct(stats.joinMs, 95) }, answerMs: { p50: pct(stats.answerMs, 50), p95: pct(stats.answerMs, 95) },
  pushLagMs: { p50: pct(stats.pushLag, 50), p95: pct(stats.pushLag, 95), n: stats.pushLag.length },
  resultsSaved: !!summary, podium: summary && summary.podium.map((p) => `${p.name} ${p.score}`), teams: hv.teams.map((t) => `${t.name}: ${t.members} players, avg ${t.avg}`),
  errors: stats.errors.slice(0, 15), errorCount: stats.errors.length,
};
console.log(JSON.stringify(out, null, 2));
const pass = hv.phase === "final" && hv.n === N && mismatches === 0 && phoneFinal === N && teamOk && stats.errors.length === 0 && stats.accepted === stats.answers;
console.log(pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
