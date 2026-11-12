import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The Chever home guide (web-v3/app.js): shown only when a Chever preview flag is on. Nothing sets the flags, so the live home
// is the old one. These checks read the page source, since app.js is a browser script.
const ROOT = join(__dirname, "..", "web-v3");
const app = readFileSync(join(ROOT, "app.js"), "utf8");
const css = readFileSync(join(ROOT, "app.css"), "utf8");
const EMOJI = /\p{Extended_Pictographic}/u;

function fnBody(name: string): string {
  const start = app.indexOf(`function ${name}(`);
  expect(start, name).toBeGreaterThan(-1);
  const next = app.indexOf("\n}\n", start);
  return app.slice(start, next + 3);
}

describe("home guide: flags and routing", () => {
  it("is gated by the existing preview flags, and the live home stays the default", () => {
    expect(fnBody("homeGuideOn")).toMatch(/f\.sharedReading === true \|\| f\.chever2Duels === true/);
    expect(fnBody("home")).toMatch(/^function home\(\) \{\n  if \(homeGuideOn\(\)\) return homeGuide\(\);/m);
  });

  it("the guide renders on the cv2 light theme with its own class", () => {
    expect(fnBody("homeGuide")).toMatch(/render\(`\$\{homeGuideHTML\(\)\}`, "cv2 cv2-home"\)/);
  });
});

describe("home guide: content and order", () => {
  const full = fnBody("homeGuideHTML");
  // The markup itself: the template after "return", so the order is the order on screen (not the order of the helper consts).
  const html = full.slice(full.indexOf("return `<div class=\"gh\">"));

  it("says what the app is, with the brand name", () => {
    // The brand mark and wordmark are drawn once, by render(), on every screen (see brand-mark.test.ts).
    expect(app).toMatch(/app\.innerHTML = `\$\{brandBar\(\)\}/);
    expect(html).toMatch(/Know the Word\. Challenge the world\./);
  });

  it("shows streak and win rate at the top", () => {
    expect(html).toMatch(/p\.streak/);
    expect(full).toMatch(/duelsPlayed/);
    expect(html).toMatch(/win rate/);
    expect(html.indexOf("day streak")).toBeLessThan(html.indexOf("Play a quick round"));
  });

  it("puts the solo game first, then multiplayer, then the reading plan", () => {
    const solo = html.indexOf("Solo match");
    const match = html.indexOf("Match with someone");
    const priv = html.indexOf("Create private room");
    const join = html.indexOf("Join with code");
    const read = html.indexOf("${readingBlock}");
    expect(solo).toBeGreaterThan(-1);
    expect(solo).toBeLessThan(match);
    expect(match).toBeLessThan(priv);
    expect(priv).toBeLessThan(join);
    expect(join).toBeLessThan(read);
    expect(html.indexOf("Play a quick round")).toBeLessThan(html.indexOf("Play with people"));
    expect(full).toMatch(/<h3>Reading plan<\/h3>/);
  });

  it("keeps the ranked and find-match card behind the duel flag, and links it to duels", () => {
    expect(full).toMatch(/const ranked = duelV2\(\)/);
    expect(html).toMatch(/\$\{ranked \? homeGuideRow\("#\/duels", "trophy", "Ranked and find match"/);
  });

  it("keeps Create private room and the 6-digit Join with code", () => {
    expect(html).toMatch(/homeGuideRow\("#\/ko\/new", "plus", "Create private room"/);
    expect(html).toMatch(/id="homejoin"/);
    expect(html).toMatch(/name="c"[^>]*placeholder="6-digit code"/);
    expect(html).toMatch(/inputmode="numeric"/);
  });

  it("offers the reading plan: guests get start, join, create; signed-in people get continue or a new plan", () => {
    expect(full).toMatch(/const reading = !!\(window\.BA_FLAGS && window\.BA_FLAGS\.sharedReading === true && window\.BAReading\)/);
    expect(full).toMatch(/Go in faith/);
    expect(full).toMatch(/Join someone/);
    expect(full).toMatch(/Create a plan/);
    expect(full).toMatch(/Continue your daily plan/);
    expect(full).toMatch(/Create a new plan/);
    expect(full).toMatch(/signedIn = !!\(ME\.user && !isGuest\(\)\)/);
  });

  it("the join form goes through the same code handler as the rest of the app", () => {
    expect(fnBody("homeGuide")).toMatch(/bindCodeBox\("homejoin"\)/);
  });
});

describe("home guide: no emoji, icons only", () => {
  it("the guide markup has no emoji", () => {
    expect(fnBody("homeGuideHTML")).not.toMatch(EMOJI);
    expect(css.split("\n").filter((l) => /\.gh-/.test(l))).not.toEqual([]);
    expect(fnBody("homeGuideRow")).not.toMatch(EMOJI);
    expect(fnBody("homeIco")).not.toMatch(EMOJI);
    expect(fnBody("homeGuide")).not.toMatch(EMOJI);
  });

  it("no waving hand anywhere in the guide", () => {
    expect(fnBody("homeGuideHTML")).not.toMatch(/\u{1F44B}/u);
    expect(fnBody("homeGuideHTML")).not.toMatch(/Welcome, Friend/);
  });

  it("the guide tab bar uses icons, not emoji", () => {
    const html = fnBody("homeGuideHTML");
    expect(html).toMatch(/\$\{navBar\("home"\)\}/);
    expect(fnBody("navBar")).toMatch(/item\("home", "#\/", "home", "Home"\)/);
  });
});

describe("home guide: styles stay scoped", () => {
  it("the guide CSS is scoped to the cv2-home screen under the light theme", () => {
    const rules = css.split("\n").filter((l) => /\.gh-|\.gh\b|cv2-home/.test(l));
    expect(rules.length).toBeGreaterThan(5);
    for (const r of rules) expect(r, r).toMatch(/cv2-home|body\.cv2-on \.cv2-home/);
  });
});
