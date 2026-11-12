import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The Ranks and Duels screens on the Chever light look (web-v3/app.js and app.css). Same tab bar as Home and Me, flat icons,
// no emoji on these screens, and styles scoped to the light theme. Checks read the source, since app.js is a browser script.
const ROOT = join(__dirname, "..", "web-v3");
const app = readFileSync(join(ROOT, "app.js"), "utf8");
const css = readFileSync(join(ROOT, "app.css"), "utf8");
const EMOJI = /\p{Extended_Pictographic}/u;

function fnBody(header: string): string {
  const start = app.indexOf(header);
  expect(start, header).toBeGreaterThan(-1);
  return app.slice(start, app.indexOf("\n}\n", start) + 3);
}

describe("Ranks and Duels: light look and flat icons", () => {
  const ranks = fnBody("async function ranks(tab) {");
  const duels = fnBody("async function duelsScreen() {");
  const league = fnBody("async function leagueBoard(el, per) {");

  it("the shared Chever tab bar is flat-icon and has Home, Duels, Ranks and Me", () => {
    const bar = fnBody("function chTabbar(active) {");
    expect(bar).toMatch(/homeIco\(icon\)/);
    expect(bar).toMatch(/tab\("#\/duels", "swords", "Duels", "duels"\)/);
    expect(bar).toMatch(/tab\("#\/ranks", "ranks", "Ranks", "ranks"\)/);
    expect(EMOJI.test(bar)).toBe(false);
  });

  it("the Me tab bar is unchanged: it is the same shared bar with Me active", () => {
    expect(fnBody("function meTabbar() {")).toMatch(/chTabbar\("me"\)/);
  });

  it("Ranks renders on the light theme with its own class and the shared tab bar", () => {
    expect(ranks).toMatch(/\$\{chTabbar\("ranks"\)\}`, "cv2 cv2-ranks"\)/);
    expect(ranks).not.toMatch(/tabbar\("ranks"\)/);
  });

  it("Duels renders on the light theme with its own class and the shared tab bar", () => {
    expect(duels).toMatch(/\$\{chTabbar\("duels"\)\}`, "cv2 cv2-duels"\)/);
    expect(duels).not.toMatch(/tabbar\("duels"\)/);
  });

  it("the Ranks and Duels screens have no emoji (the church league board included)", () => {
    expect(EMOJI.test(ranks)).toBe(false);
    expect(EMOJI.test(duels)).toBe(false);
    expect(EMOJI.test(league)).toBe(false);
  });

  it("the Ranks and Duels styles are scoped to their own screens", () => {
    expect(css).toMatch(/body\.cv2-on \.cv2-ranks \.card,body\.cv2-on \.cv2-duels \.card/);
    expect(css).toMatch(/body\.cv2-on \.cv2-ranks \.lb\.me\{/);
    expect(css).toMatch(/body\.cv2-on \.cv2-duels \.hero \.rays\{display:none\}/);
    expect(css).not.toMatch(/^\.card\{background:#fff/m);
  });

  it("the leaderboard data path is unchanged (the same API call and the same score field)", () => {
    expect(ranks).toMatch(/api\("\/api\/v3\/leaderboard\?scope=" \+ tab\)/);
    expect(ranks).toMatch(/fmt\(x\.score\)/);
  });

  it("the flags are unchanged", () => {
    const flags = readFileSync(join(__dirname, "..", "domain", "feature-flags.ts"), "utf8");
    expect(flags).toMatch(/sharedReading:\s*true/);
  });
});
