// Bible Arena v3.11.0: deep story mode (server side). Level ids look like "gen.4" (normal) / "gen.b" (boss) / "mgen.4" (Mastery).
// Progress: players.stats.st3 = { levelId: stars 1..3 }. Daily energy: players.stats.st3e = { d: Lagos day, u: new-level attempts used, a: ads watched }.
// A new-level attempt (a level not passed before) costs 1 energy; 5 a day plus 1 from a rewarded ad. Replays of passed levels are free.
// Out of energy: the round still scores (XP, boards) but the level result is not recorded. No schema change (jsonb keys only).
export const ST3_ID = /^(m?)([0-9a-z]{3})\.(\d{1,2}|b)$/;
export const ST3_ENERGY = 5, ST3_AD_MAX = 1, ST3_MAX_KEYS = 1000;
export interface St3Energy { d: string; u: number; a: number }
export interface St3Result { stars: number; passed: boolean; energyOut: boolean; counted: boolean; energy: { u: number; a: number; max: number; left: number } }
function energyOf(stats: any, day: string): St3Energy {
  const e = stats && stats.st3e && stats.st3e.d === day ? stats.st3e : null;
  return { d: day, u: Math.max(0, Number(e?.u) || 0), a: Math.max(0, Math.min(ST3_AD_MAX, Number(e?.a) || 0)) };
}
const view = (e: St3Energy) => ({ u: e.u, a: e.a, max: ST3_ENERGY + e.a, left: Math.max(0, ST3_ENERGY + e.a - e.u) });
/** Applies one story round to a stats object (mutates it). fast = the player answered everything with time to spare (only matters for 3 stars). */
export function story3Apply(stats: any, id: string, count: number, correct: number, fast: boolean, day: string): St3Result | null {
  const m = ST3_ID.exec(id); if (!m) return null;
  return applyLevel(stats, id, m[3] === "b", count, correct, fast, day);
}
// v3.11.1 Endless mode: level ids "e1", "e2"... (every 10th is a boss). Opens after the Revelation boss; must be played in order.
// Same energy and stars as story; stats.endless = highest endless level passed (the "highest endless level" board).
export const EN_ID = /^e(\d{1,5})$/;
export function endlessApply(stats: any, id: string, count: number, correct: number, fast: boolean, day: string): (St3Result & { level: number; best: number; locked?: boolean }) | null {
  const m = EN_ID.exec(id); if (!m) return null;
  const n = Number(m[1]); if (n < 1) return null;
  const best = Math.max(0, Number(stats.endless) || 0);
  const open = (Number(stats.st3?.["rev.b"]) || 0) >= 1 && n <= best + 1;
  if (!open) { const e = energyOf(stats, day); return { stars: 0, passed: false, energyOut: false, counted: false, energy: view(e), level: n, best, locked: true }; }
  const r = applyLevel(stats, id, n % 10 === 0, count, correct, fast, day);
  let nb = best;
  if (r.passed) {
    nb = Math.max(best, n); stats.endless = nb;
    const st = stats.st3 || {}; for (const k of Object.keys(st)) { const x = EN_ID.exec(k); if (x && Number(x[1]) < nb - 300) delete st[k]; } // keep the last 300 endless levels' stars
  }
  return { ...r, level: n, best: nb };
}
function applyLevel(stats: any, id: string, boss: boolean, count: number, correct: number, fast: boolean, day: string): St3Result {
  const need = boss ? 15 : 10, pass = boss ? 13 : 7;
  const st: Record<string, number> = { ...(stats.st3 || {}) };
  const e = energyOf(stats, day);
  if (count !== need) return { stars: 0, passed: false, energyOut: false, counted: false, energy: view(e) };
  const passedBefore = (Number(st[id]) || 0) >= 1;
  let energyOut = false;
  if (!passedBefore) { if (e.u >= ST3_ENERGY + e.a) energyOut = true; else e.u++; }
  let stars = 0;
  if (!energyOut && correct >= pass) {
    stars = correct >= need ? (fast ? 3 : 2) : correct >= need - 1 ? 2 : 1;
    if (st[id] != null || Object.keys(st).length < ST3_MAX_KEYS) st[id] = Math.max(Number(st[id]) || 0, stars);
  }
  stats.st3 = st; stats.st3e = e;
  return { stars, passed: stars > 0, energyOut, counted: true, energy: view(e) };
}
/** +1 energy after a rewarded ad (once a day). */
export function story3Ad(stats: any, day: string): { ok: boolean; energy: ReturnType<typeof view> } {
  const e = energyOf(stats, day);
  if (e.a >= ST3_AD_MAX) return { ok: false, energy: view(e) };
  e.a++; stats.st3e = e;
  return { ok: true, energy: view(e) };
}
