import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import * as E from "../server/v3/live-engine";

// The twelve avatar faces: web-v3/avatars/face-01..12 (SVG art, 256 px PNG copies), the picker's list on the server,
// the small helper the screens share, and the duel screen showing the player's own face.
const DIR = join(__dirname, "..", "web-v3", "avatars");
const EMOJI = /\p{Extended_Pictographic}/u;
const IDS = Array.from({ length: 40 }, (_, i) => "face-" + String(i + 1).padStart(2, "0"));

function pngSize(path: string): { w: number; h: number } {
  const b = readFileSync(path);
  expect(b.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe("avatar faces: art", () => {
  it("has forty SVG faces and a 256 px PNG copy of each", () => {
    const files = readdirSync(DIR);
    for (const id of IDS) {
      expect(files).toContain(id + ".svg");
      expect(files).toContain(id + ".png");
      expect(pngSize(join(DIR, id + ".png"))).toEqual({ w: 256, h: 256 });
    }
  });

  it("draws each face as inline SVG with a viewBox, a round frame and no emoji", () => {
    for (const id of IDS) {
      const svg = readFileSync(join(DIR, id + ".svg"), "utf8");
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg).toContain('viewBox="0 0 256 256"');
      expect(svg).toContain("#0B1F4B");
      expect(svg).toContain("#FFC300");
      expect(EMOJI.test(svg)).toBe(false);
    }
  });
});

describe("avatar faces: server", () => {
  it("offers the forty faces to the picker and keeps the first emoji set accepted", () => {
    expect(IDS.length).toBeGreaterThanOrEqual(24);
    expect(E.FACE_AVATARS).toEqual(IDS);
    expect(E.AVATARS.length).toBeGreaterThan(0);
  });

  it("stores a chosen face on the player, falls back to a face when none is sent, and keeps old emoji", () => {
    const r = E.createRoom({ code: "654321", title: "Faces", questions: [{ id: "q0", type: "mc", q: "Q?", o: ["A", "B"], a: 0 }] as E.LQ[], timer: 20, now: 1_700_000_000_000 });
    const pick = E.joinRoom(r, { name: "Ada", avatar: "face-07" }, 1_700_000_000_000);
    expect(pick.ok && pick.player.avatar).toBe("face-07");
    const none = E.joinRoom(r, { name: "Bola" }, 1_700_000_000_000);
    expect(none.ok && IDS).toContain(none.ok ? none.player.avatar : "");
    const old = E.joinRoom(r, { name: "Chi", avatar: "🦁" }, 1_700_000_000_000);
    expect(old.ok && old.player.avatar).toBe("🦁");
    const junk = E.joinRoom(r, { name: "Dele", avatar: "<img onerror=x>" }, 1_700_000_000_000);
    expect(junk.ok && IDS).toContain(junk.ok ? junk.player.avatar : "");
  });
});

describe("avatar faces: browser helpers", () => {
  function load(file: string, ctx: any = { window: {}, console }): any {
    vm.createContext(ctx);
    vm.runInContext(readFileSync(join(__dirname, "..", "web-v3", file), "utf8"), ctx);
    return ctx;
  }

  it("avatars.js tells faces from text avatars and builds the image tag", () => {
    const ctx = load("avatars.js");
    const B = ctx.window.BAFace;
    expect(B.ids).toEqual(IDS);
    expect(B.isFace("face-03")).toBe(true);
    expect(B.isFace("face-41")).toBe(false);
    expect(B.isFace("face-40")).toBe(true);
    expect(B.isFace("🦁")).toBe(false);
    expect(B.html("🦁")).toBe("🦁");
    expect(B.html("face-03", "44px")).toContain('src="/v3/avatars/face-03.svg"');
  });

  it("the duel screen shows the player's own saved face next to their name", () => {
    const ctx: any = { window: {}, console, localStorage: { getItem: () => JSON.stringify({ name: "Ada", avatar: "face-05" }) } };
    const B = load("duel-screens.js", ctx).window.BADuel;
    const html = B.renderResults({ outcome: "won", headline: "Won", sub: "", code: "ABC123", me: { score: 5, correct: 5, total: 10, time: "1.0s" }, opp: null, oppName: "Olu", waHref: "#" });
    expect(html).toContain('src="/v3/avatars/face-05.svg"');
  });

  it("the duel screen falls back to the initial when no face is saved", () => {
    const ctx: any = { window: {}, console, localStorage: { getItem: () => null } };
    const B = load("duel-screens.js", ctx).window.BADuel;
    const html = B.renderResults({ outcome: "won", headline: "Won", sub: "", code: "ABC123", me: { score: 5, correct: 5, total: 10, time: "1.0s" }, opp: null, oppName: "Olu", waHref: "#" });
    expect(html).not.toContain("/v3/avatars/");
  });
});
