// Bible Arena v3: who won a duel. One rule, used by the API, the rivals board and the tests
// (web-v3/app.js carries the same rule as duelCmp; tests/duel-outcome.test.ts checks both agree).
//   1. Higher score wins.
//   2. Equal scores: the faster total time wins, compared in tenths of a second
//      (the precision the result screen shows, so a "win on time" is always visible).
//   3. Equal score and equal time: a draw. Nobody gets a win.
export const TIME_STEP_MS = 100;

export type DuelSide = { score: number; timeMs: number | null | undefined };
export type DuelOutcome = { result: "win" | "loss" | "draw"; by: "score" | "time" | null };

export const timeSteps = (ms: number | null | undefined) => Math.round(Math.max(0, Number(ms) || 0) / TIME_STEP_MS);

/** 1 if a beats b, -1 if b beats a, 0 for a draw. */
export function compareDuel(a: DuelSide, b: DuelSide): 1 | -1 | 0 {
  const sa = Number(a.score) || 0, sb = Number(b.score) || 0;
  if (sa !== sb) return sa > sb ? 1 : -1;
  const ta = timeSteps(a.timeMs), tb = timeSteps(b.timeMs);
  if (ta !== tb) return ta < tb ? 1 : -1;
  return 0;
}

/** The outcome from a's side. */
export function duelOutcome(a: DuelSide, b: DuelSide): DuelOutcome {
  const c = compareDuel(a, b);
  if (c === 0) return { result: "draw", by: null };
  const by = (Number(a.score) || 0) !== (Number(b.score) || 0) ? "score" : "time";
  return { result: c > 0 ? "win" : "loss", by };
}

/** SQL fragments for the same rule, for two duel_entries aliases (m = me, o = opponent). */
export function sqlDuelRule(m: string, o: string) {
  const t = (x: string) => `round(coalesce(${x}.time_ms, 0) / ${TIME_STEP_MS}.0)`;
  const beats = (x: string, y: string) => `(${x}.score > ${y}.score or (${x}.score = ${y}.score and ${t(x)} < ${t(y)}))`;
  return { win: beats(m, o), loss: beats(o, m), draw: `(${m}.score = ${o}.score and ${t(m)} = ${t(o)})` };
}
