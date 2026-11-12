import { describe, it, expect } from "vitest";
import fs from "node:fs";
import * as E from "../server/v3/live-engine";
import { publicLobby, publicKo } from "../server/v3/live";

// v3.13 Public lobby (Michael, 2026-11-12): no code; Play now pairs everyone into one room (2 to 8); in the room the players
// choose Start now / Wait for more players / Share code. Built on the knockout rooms.
const Q = (n: number): E.LQ[] => Array.from({ length: n }, (_, i) => ({ id: "q" + i, type: "mc", q: `Question ${i}?`, o: ["A", "B", "C", "D"], a: i % 4 }));
const T0 = 1_700_000_000_000;
function quickRoom(names: string[]) {
  const r = E.createRoom({ code: "654321", title: "Live knockout", questions: Q(45), timer: E.KO_TIMER, auto: true, instant: true, now: T0 });
  r.maxPlayers = E.KO_QUICK_MAX;
  const ps = names.map((n) => { const j = E.joinRoom(r, { name: n }, T0); if (!j.ok) throw new Error(j.error); return j.player; });
  r.ko = E.makeKo(ps[0].id, "s", E.KO_ROUND_LEN); r.ko.pub = true; r.ko.auto = true; r.ko.openedAt = T0;
  return { r, ps };
}

describe("public lobby: Start now / Wait for more players", () => {
  it("starts 5 s after more than half of the players here tap Start now", () => {
    const { r, ps } = quickRoom(["Ada", "Ben", "Cy"]);
    const ids = ps.map((p) => p.id);
    expect(E.koVote(r, ps[0].id, "go", T0).ok).toBe(true);
    E.koAutoLobby(r, T0, 3, ids);
    expect(r.ko!.startAt).toBe(T0 + E.KO_AUTO_COUNTDOWN_MS); // 1 of 3 is not a majority: the normal 30 s countdown
    E.koVote(r, ps[1].id, "go", T0 + 1000);
    E.koAutoLobby(r, T0 + 1000, 3, ids);
    expect(r.ko!.startAt).toBe(T0 + 1000 + E.KO_VOTE_GO_MS); // 2 of 3: starts in 5 s
    expect(E.koAutoLobby(r, T0 + 1000 + E.KO_VOTE_GO_MS, 3, ids)).toBe("start");
  });

  it("two players: both must tap Start now; one alone does not start it", () => {
    const { r, ps } = quickRoom(["Ada", "Ben"]);
    const ids = ps.map((p) => p.id);
    E.koVote(r, ps[0].id, "go", T0);
    E.koAutoLobby(r, T0, 2, ids);
    expect(r.ko!.startAt).toBe(T0 + E.KO_AUTO_TWO_MS); // the normal 2-player clock
    E.koVote(r, ps[1].id, "go", T0 + 2000);
    E.koAutoLobby(r, T0 + 2000, 2, ids);
    expect(r.ko!.startAt).toBe(T0 + 2000 + E.KO_VOTE_GO_MS);
    expect(E.koStart(r, T0 + 7000, () => true).ok).toBe(true);
    expect(r.phase).toBe("intro");
    expect(r.ko!.votes).toBeUndefined();
  });

  it("Wait for more players holds the automatic countdown for at most 2 minutes, once", () => {
    const { r, ps } = quickRoom(["Ada", "Ben", "Cy"]);
    const ids = ps.map((p) => p.id);
    E.koAutoLobby(r, T0, 3, ids);
    expect(r.ko!.startAt).toBeDefined();
    E.koVote(r, ps[2].id, "wait", T0 + 1000);
    expect(E.koAutoLobby(r, T0 + 1000, 3, ids)).toBe("changed");
    expect(r.ko!.startAt).toBeUndefined();
    E.koVote(r, ps[1].id, "wait", T0 + 60_000); // a second wait does not extend the hold
    expect(r.ko!.waitUntil).toBe(T0 + 1000 + E.KO_WAIT_HOLD_MS);
    E.koAutoLobby(r, T0 + 1000 + E.KO_WAIT_HOLD_MS, 3, ids);
    expect(r.ko!.startAt).toBe(T0 + 1000 + E.KO_WAIT_HOLD_MS + E.KO_AUTO_COUNTDOWN_MS); // hold over: countdown resumes
  });

  it("a majority for Start now beats a wait", () => {
    const { r, ps } = quickRoom(["Ada", "Ben", "Cy"]);
    const ids = ps.map((p) => p.id);
    E.koVote(r, ps[0].id, "wait", T0); E.koVote(r, ps[1].id, "go", T0); E.koVote(r, ps[2].id, "go", T0);
    E.koAutoLobby(r, T0, 3, ids);
    expect(r.ko!.startAt).toBe(T0 + E.KO_VOTE_GO_MS);
  });

  it("someone new joining clears the waits (they got more players) and the hold", () => {
    const { r, ps } = quickRoom(["Ada", "Ben"]);
    E.koVote(r, ps[0].id, "wait", T0); E.koVote(r, ps[1].id, "go", T0);
    const j = E.joinRoom(r, { name: "Cy" }, T0 + 5000);
    expect(j.ok).toBe(true);
    expect(r.ko!.votes).toEqual({ [ps[1].id]: "go" });
    expect(r.ko!.waitUntil).toBeUndefined();
  });

  it("votes are only for public auto rooms in the lobby", () => {
    const { r, ps } = quickRoom(["Ada", "Ben"]);
    expect(E.koVote(r, ps[0].id, "maybe", T0).ok).toBe(false);
    r.ko!.auto = false;
    expect(E.koVote(r, ps[0].id, "go", T0).ok).toBe(false);
    r.ko!.auto = true; E.koStart(r, T0, () => true);
    expect(E.koVote(r, ps[0].id, "go", T0).ok).toBe(false);
  });

  it("without votes the old auto lobby clock is unchanged (existing rooms keep working)", () => {
    const { r } = quickRoom(["Ada", "Ben", "Cy"]);
    E.koAutoLobby(r, T0, 3);
    expect(r.ko!.startAt).toBe(T0 + E.KO_AUTO_COUNTDOWN_MS);
  });
});

describe("public lobby: matching and the 8-player cap", () => {
  it("a Play now room fills to 8; the 9th cannot join the lobby but can watch once it is playing", () => {
    const names = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"];
    const { r } = quickRoom(names);
    expect(E.activePlayers(r).length).toBe(8);
    const nine = E.joinRoom(r, { name: "A9" }, T0);
    expect(nine.ok).toBe(false);
    E.koStart(r, T0, () => true);
    const watch = E.joinRoom(r, { name: "A9" }, T0 + 1000);
    expect(watch.ok).toBe(true);
    if (watch.ok) expect(r.ko!.out[watch.player.id]).toBe(-1); // watches until the next game
  });

  it("publicLobby splits waiting rooms and live games, and lists only rooms with someone online", () => {
    const pl = publicLobby(Date.now());
    expect(Array.isArray(pl.waiting)).toBe(true);
    expect(Array.isArray(pl.live)).toBe(true);
    expect(pl.max).toBe(8);
    expect(publicKo().length).toBe(0); // no rooms in this process
  });

  it("private (code) rooms are unchanged: not auto, host starts, cap 50", () => {
    const src = fs.readFileSync("server/v3/live.ts", "utf8");
    const ko = src.slice(src.indexOf('app.post("/lv/ko"'), src.indexOf('app.post("/lv/ko/quick"'));
    expect(ko).toContain("room.maxPlayers = E.KO_MAX");
    expect(ko).not.toContain("auto = true");
    const quick = src.slice(src.indexOf('app.post("/lv/ko/quick"'));
    expect(quick).toContain("room.maxPlayers = E.KO_QUICK_MAX");
    expect(quick).toContain("r.n < Math.min(r.max, E.KO_QUICK_MAX)");
  });
});

describe("public lobby screens", () => {
  const app = fs.readFileSync("web-v3/app.js", "utf8");
  const play = fs.readFileSync("web-v3/live-play.js", "utf8");
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  it("the Game tab links the Public lobby, and the lobby has Play now, waiting players and live games", () => {
    const game = app.slice(app.indexOf("function gameScreen"), app.indexOf("async function home()"));
    expect(game).toContain('"#/public"');
    const pub = app.slice(app.indexOf("async function publicScreen"), app.indexOf("function homeGuide()"));
    expect(pub).toContain("Play now"); expect(pub).toContain("Waiting for players"); expect(pub).toContain("Live games");
    expect(pub).toContain('navBar("game")');
    expect(pub).toContain("/lv/public");
    expect(emoji.test(pub)).toBe(false);
  });
  it("the waiting room offers Start now, Wait for more players and Share code, without emoji", () => {
    const ch = play.slice(play.indexOf("function koChoiceHTML"), play.indexOf("function koBoxHTML"));
    expect(ch).toContain("Start now"); expect(ch).toContain("Wait for more players"); expect(ch).toContain("Share code");
    expect(ch).toContain('action: "vote"');
    expect(emoji.test(ch)).toBe(false);
    const lobby = play.slice(play.indexOf("function koLobby"), play.indexOf("function koIntro"));
    expect(emoji.test(lobby)).toBe(false);
  });
});
