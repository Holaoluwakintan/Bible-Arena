import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { compareDuel, duelOutcome, sqlDuelRule, timeSteps } from "../server/v3/duel-outcome";

// The client (web-v3/app.js, vanilla JS) carries its own copy of the rule as duelCmp; load it so
// both sides are held to the same cases.
const appJs = fs.readFileSync(path.resolve(__dirname, "../web-v3/app.js"), "utf8");
const fnSrc = appJs.match(/function duelCmp\(a, b\) \{[^\n]*\}\n/)?.[0];
const clientCmp = new Function(`${fnSrc}; return duelCmp;`)() as (a: any, b: any) => number;

const both = (a: any, b: any) => {
  const server = compareDuel(a, b);
  expect(clientCmp(a, b)).toBe(server);
  expect(compareDuel(b, a)).toBe((-server || 0) as any);
  return server;
};

describe("duel outcome: score, then time, then draw", () => {
  it("finds the client rule in app.js", () => {
    expect(fnSrc).toBeTruthy();
  });

  it("a normal win: the higher score wins, whatever the time", () => {
    expect(both({ score: 1200, timeMs: 30000 }, { score: 960, timeMs: 7000 })).toBe(1);
    expect(duelOutcome({ score: 1200, timeMs: 30000 }, { score: 960, timeMs: 7000 })).toEqual({ result: "win", by: "score" });
    expect(duelOutcome({ score: 960, timeMs: 7000 }, { score: 1200, timeMs: 30000 })).toEqual({ result: "loss", by: "score" });
  });

  it("a tie broken by time: equal scores, the faster total time wins", () => {
    expect(both({ score: 960, timeMs: 6800 }, { score: 960, timeMs: 7400 })).toBe(1);
    expect(duelOutcome({ score: 960, timeMs: 7400 }, { score: 960, timeMs: 6800 })).toEqual({ result: "loss", by: "time" });
    expect(duelOutcome({ score: 960, timeMs: 6800 }, { score: 960, timeMs: 7400 })).toEqual({ result: "win", by: "time" });
  });

  it("a true tie: same score and same time is a draw, for both players", () => {
    expect(both({ score: 960, timeMs: 7000 }, { score: 960, timeMs: 7000 })).toBe(0);
    expect(duelOutcome({ score: 960, timeMs: 7000 }, { score: 960, timeMs: 7000 })).toEqual({ result: "draw", by: null });
  });

  it("the reported bug: 960 vs 960, both shown as 7.0s, is a draw (a few ms is not a win)", () => {
    expect(both({ score: 960, timeMs: 7012 }, { score: 960, timeMs: 6987 })).toBe(0);
    expect(timeSteps(7012)).toBe(timeSteps(6987));
  });

  it("time is compared at the tenths the screen shows", () => {
    expect(both({ score: 500, timeMs: 7040 }, { score: 500, timeMs: 7060 })).toBe(1); // 7.0s vs 7.1s
    expect(both({ score: 0, timeMs: null }, { score: 0, timeMs: 0 })).toBe(0);
  });

  it("the rivals SQL encodes the same three cases", () => {
    const r = sqlDuelRule("m", "o");
    expect(r.win).toContain("m.score > o.score");
    expect(r.loss).toContain("o.score > m.score");
    expect(r.draw).toContain("m.score = o.score");
    expect(r.draw).toContain("round(coalesce(m.time_ms, 0) / 100.0) = round(coalesce(o.time_ms, 0) / 100.0)");
  });
});
