import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// One app: the onboarding screen on the Chever look, with flat line icons for the levels (no emoji), the C bar on top,
// and the fill-in-the-gap word tiles readable on the light look. web-v3/app.js is a browser script, so these checks read
// its source. Nothing here changes question data or scoring.
const ROOT = join(__dirname, "..", "web-v3");
const app = readFileSync(join(ROOT, "app.js"), "utf8");
const css = readFileSync(join(ROOT, "app.css"), "utf8");
const EMOJI = /\p{Extended_Pictographic}/u;

function fnBody(src: string, header: string): string {
  const start = src.indexOf(header);
  expect(start).toBeGreaterThan(-1);
  return src.slice(start, src.indexOf("\n}\n", start) + 3);
}

describe("one app: level icons are flat line icons", () => {
  const tier = src => src.slice(src.indexOf("const TIER = {"), src.indexOf("const MODES = {"));

  it("the three levels keep their names and subtitles", () => {
    const t = tier(app);
    expect(t).toMatch(/name: "Believer", sub: "Warm-up"/);
    expect(t).toMatch(/name: "Scholar", sub: "Deeper"/);
    expect(t).toMatch(/name: "Theologian", sub: "Hardest"/);
  });

  it("the level icons are inline SVG, not emoji", () => {
    const t = tier(app);
    expect(t).toMatch(/icon: LVL_SVG\(/);
    expect(EMOJI.test(t)).toBe(false);
    expect(app).toMatch(/const LVL_SVG = \(d\) => `<svg class="lvl-ico"/);
  });

  it("the onboarding screen has no emoji and uses the level icons", () => {
    const body = fnBody(app, "function onboarding(after) {");
    expect(EMOJI.test(body)).toBe(false);
    expect(body).toMatch(/\$\{TIER\[k\]\.icon\}/);
    expect(body).toMatch(/Choose your level/);
    expect(body).toMatch(/Enter the Arena/);
    expect(body).toMatch(/What should we call you\?/);
  });

  it("the onboarding screen is drawn on the Chever light look and the C bar comes with render()", () => {
    const body = fnBody(app, "function onboarding(after) {");
    expect(body).toMatch(/, "cv2 cv2-onboard"\);/);
    expect(app).toMatch(/app\.innerHTML = `\$\{brandBar\(\)\}<div class="screen \$\{cls \|\| ""\}">/);
  });

  it("the level picker sheet and the level chip use the same icons", () => {
    expect(fnBody(app, "function tierSheet(done) {")).toMatch(/\$\{TIER\[k\]\.icon\}/);
    expect(app).toMatch(/<button class="chip on" id="tierchip">\$\{TIER\[S\.tier\]\.icon\}/);
  });
});

describe("one app: fill-in-the-gap tiles read on the light look", () => {
  it("the word tiles are light with navy text on the Chever quiz screen", () => {
    expect(css).toMatch(/body\.cv2-on \.cv2-quiz \.wchip\{background:#FFF8E7;[^}]*color:#0B1F4B/);
  });

  it("the blanks are light, and the chosen one is gold with dark text", () => {
    expect(css).toMatch(/body\.cv2-on \.cv2-quiz \.blank\{color:#0B1F4B;background:#FFF8E7/);
    expect(css).toMatch(/body\.cv2-on \.cv2-quiz \.blank\.filled\{background:#FFC300;border-color:#FFC300;color:#0B1F4B\}/);
  });

  it("a filled blank carries the filled class", () => {
    expect(app).toMatch(/class="blank \$\{bi === nextEmpty \? "next" : ""\} \$\{f != null \? "filled" : ""\}"/);
  });
});
