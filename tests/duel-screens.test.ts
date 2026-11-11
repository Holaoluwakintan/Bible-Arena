import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

// The duel, ranked/join and results screens live in web-v3/duel-screens.js (a browser script). Load it in a bare VM
// context so its logic and renderers can be checked here. Nothing in the live site loads this file.
function load(): any {
  const ctx: any = { window: {}, console };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(__dirname, "..", "web-v3", "duel-screens.js"), "utf8"), ctx);
  return ctx.window.BADuel;
}
const B = load();
const L = B.logic;
const EMOJI = /\p{Extended_Pictographic}/u;

const me = (o: any = {}) => ({ isMe: true, finished: true, score: 500, correct: 7, total: 10, timeMs: 42000, answers: [true, true, false, true, true, true, true, false, true, true], ...o });
const opp = (o: any = {}) => ({ name: "Ada Okafor", finished: true, score: 480, correct: 6, total: 10, timeMs: 39000, answers: [true, false, true, true, true, true, true, true, true, false], ...o });

describe("duel screens: outcome logic", () => {
  it("is 'play' until my own set is finished, 'waiting' until the other finishes", () => {
    expect(L.duelState(undefined, opp())).toBe("play");
    expect(L.duelState(me({ finished: false }), opp())).toBe("play");
    expect(L.duelState(me(), undefined)).toBe("waiting");
    expect(L.duelState(me(), opp({ finished: false }))).toBe("waiting");
  });

  it("wins on score, then on the faster time when scores tie (times compared to 0.1 s)", () => {
    expect(L.duelState(me({ score: 500 }), opp({ score: 480 }))).toBe("won");
    expect(L.duelState(me({ score: 470 }), opp({ score: 480 }))).toBe("lost");
    expect(L.duelState(me({ score: 480, timeMs: 39000 }), opp({ score: 480, timeMs: 41000 }))).toBe("won");
    expect(L.duelState(me({ score: 480, timeMs: 41000 }), opp({ score: 480, timeMs: 39000 }))).toBe("lost");
  });

  it("calls an exact tie a draw, including times within the same tenth of a second", () => {
    expect(L.duelState(me({ score: 480, timeMs: 39000 }), opp({ score: 480, timeMs: 39040 }))).toBe("draw");
    expect(L.cmpDuel({ score: 1, timeMs: 1000 }, { score: 1, timeMs: 1000 })).toBe(0);
  });

  it("formats seconds to one decimal and the gap between two times", () => {
    expect(L.secsLabel(42349)).toBe("42.3s");
    expect(L.secsLabel(undefined)).toBe("0.0s");
    expect(L.gapLabel(42000, 39500)).toBe("2.5s");
  });
});

describe("duel screens: helpers", () => {
  it("keeps progress between 0 and 100 and never divides by zero", () => {
    expect(L.percent(3, 10)).toBe(30);
    expect(L.percent(11, 10)).toBe(100);
    expect(L.percent(0, 0)).toBe(0);
    expect(L.percent(-2, 10)).toBe(0);
  });

  it("marks one dot per question: right, wrong, or open when not yet answered", () => {
    expect(L.gridOf([true, false], 4)).toEqual(["right", "wrong", "open", "open"]);
    expect(L.gridOf(undefined, 2)).toEqual(["open", "open"]);
  });

  it("accepts a 4 to 12 character code in any case and strips spaces and dashes", () => {
    expect(L.normalizeCode(" ab3-k9 ")).toEqual({ ok: true, link: false, code: "AB3K9", raw: "ab3-k9" });
    expect(L.normalizeCode("482913").code).toBe("482913");
  });

  it("refuses a code that is too short or too long, with a plain message", () => {
    const short = L.normalizeCode("ab");
    expect(short.ok).toBe(false);
    expect(short.message).toContain("Type the code");
    expect(L.normalizeCode("ABCDEFGHIJKLM").ok).toBe(false);
  });

  it("passes a pasted link through to the app's own parser", () => {
    expect(L.normalizeCode("https://tab.example/d/AB3K9")).toEqual({ ok: true, link: true, code: null, raw: "https://tab.example/d/AB3K9" });
  });

  it("drops emoji from names the server sends (the bot's name carries one)", () => {
    expect(L.plainName("Arena Bot 🤖")).toBe("Arena Bot");
    expect(L.plainName("   ")).toBe("Player");
    expect(L.firstName("Ada Okafor")).toBe("Ada");
  });

  it("writes the headline a person hears for each outcome", () => {
    expect(L.headlineFor("won", { oppName: "Ada Okafor" }).title).toBe("You won");
    expect(L.headlineFor("lost", { oppName: "Ada Okafor" }).title).toBe("Ada took this one");
    expect(L.headlineFor("draw", {}).title).toBe("A draw");
    expect(L.headlineFor("waiting", { quick: true, oppName: "Ada Okafor" }).sub).toContain("Waiting for Ada");
  });
});

describe("duel screens: renderers", () => {
  const duelModel = {
    code: "AB3K9", modeName: "Mixed Arena", tierName: "Scholar", count: 10, creatorName: "Ada Okafor",
    scoreToBeat: 480, needName: false, nameVal: "", churchVal: "", boardHTML: "", tabbarHTML: "",
  };

  it("duel screen: shows the challenge, the score to beat, and the accept button", () => {
    const html = B.renderDuel(duelModel);
    expect(html).toContain('id="acc"');
    expect(html).toContain("Accept and play");
    expect(html).toContain("480");
    expect(html).toContain('href="#/duels"');
    expect(html).toContain("Mixed Arena");
  });

  it("duel screen: asks for a name when the person has not set one", () => {
    expect(B.renderDuel({ ...duelModel, needName: true })).toContain('id="nm"');
    expect(B.renderDuel(duelModel)).not.toContain('id="nm"');
  });

  it("ranked and join screen: has the join form, the code field, and the find-opponent link", () => {
    const html = B.renderRankedJoin({ rankLabel: "Disciple 2", xpLabel: "1,200 XP", setsHTML: "", tabbarHTML: "" });
    expect(html).toContain('id="cvj"');
    expect(html).toContain('name="c"');
    expect(html).toContain('href="#/online"');
    expect(html).toContain("Disciple 2");
    expect(html).toContain("Join by code");
  });

  it("results screen: a won result shows the winner tag and the WhatsApp link", () => {
    const html = B.renderResults({
      code: "AB3K9", outcome: "won", headline: "You won", sub: "Sub", count: 10,
      me: { score: 500, correct: 7, total: 10, time: "42.0s" }, opp: { score: 480, correct: 6, total: 10, time: "39.0s" },
      oppName: "Ada Okafor", myGrid: L.gridOf([true], 3), oppGrid: L.gridOf([false], 3),
      waHref: "https://wa.me/?text=x", rematch: true, chwLabel: "Challenge the winner (Ada)", chwId: "chw", tabbarHTML: "",
    });
    expect(html).toContain("You won");
    expect(html).toContain("Winner");
    expect(html).toContain('id="wa"');
    expect(html).toContain('id="rm"');
    expect(html).toContain('id="chw"');
    expect(html).toContain("cvd-won");
  });

  it("results screen: the waiting state shows the send link and no question grid", () => {
    const html = B.renderResults({
      code: "AB3K9", outcome: "waiting", headline: "Now send it", sub: "Waiting", count: 10,
      me: { score: 500, correct: 7, total: 10, time: "42.0s" }, opp: null, oppName: "", myGrid: [], oppGrid: [],
      waHref: "https://wa.me/?text=x", tabbarHTML: "",
    });
    expect(html).toContain("Now send it");
    expect(html).not.toContain("Question by question");
    expect(html).toContain("send the link");
  });

  it("the board lists places, marks the viewer's row, and drops no names", () => {
    const html = B.renderBoard([
      { pos: 1, name: "Arena Bot 🤖", sub: "10/10 · 30.0s", score: 600 },
      { pos: 2, name: "Michael", me: true, sub: "7/10", score: 500, tag: "challenger" },
    ]);
    expect(html).toContain("cvd-lrow me");
    expect(html).toContain("challenger");
    expect(html).toContain("Arena Bot");
  });

  it("no emoji on any of the three screens or the board (icons only)", () => {
    const outputs = [
      B.renderDuel({ ...duelModel, needName: true, boardHTML: B.renderBoard([{ pos: 1, name: "A 🤖", score: 1 }]) }),
      B.renderRankedJoin({ rankLabel: "Seeker", xpLabel: "0 XP", setsHTML: "<a>set</a>", tabbarHTML: "" }),
      B.renderResults({ code: "X1", outcome: "lost", headline: "Ada took this one", sub: "s", count: 3,
        me: { score: 1, correct: 0, total: 3, time: "1.0s" }, opp: { score: 2, correct: 1, total: 3, time: "2.0s" },
        oppName: "Ada", myGrid: ["wrong", "right", "open"], oppGrid: ["right", "right", "right"], waHref: "#", qm: true, chwLabel: "Take on all comers", chwId: "chw", tabbarHTML: "" }),
    ];
    for (const html of outputs) {
      // The bot's name in a board is the only source of an emoji, and the board strips it.
      expect(EMOJI.test(html)).toBe(false);
    }
  });

  it("escapes names in the markup", () => {
    const html = B.renderDuel({ ...duelModel, creatorName: "<img src=x>" });
    expect(html).not.toContain("<img src=x>");
    expect(html).toContain("&lt;img");
  });

  it("the stylesheet is scoped under .cvd so it cannot restyle the live screens", () => {
    const rules = B.css.split("}").map((s: string) => s.trim()).filter(Boolean);
    expect(rules.length).toBeGreaterThan(10);
    for (const r of rules) expect(r.startsWith(".cvd")).toBe(true);
  });
});
