import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The Me page on the Chever light look (web-v3/app.js and app.css). It is the live one-app screen: flat icons, no emoji,
// the light theme class, and the same tab bar as Home. Checks read the source, since app.js is a browser script.
const ROOT = join(__dirname, "..", "web-v3");
const app = readFileSync(join(ROOT, "app.js"), "utf8");
const css = readFileSync(join(ROOT, "app.css"), "utf8");
const EMOJI = /\p{Extended_Pictographic}/u;

function fnBody(header: string): string {
  const start = app.indexOf(header);
  expect(start, header).toBeGreaterThan(-1);
  return app.slice(start, app.indexOf("\n}\n", start) + 3);
}

describe("Me page: light look and flat icons", () => {
  const profile = fnBody("async function profile() {");

  it("renders on the Chever light theme with its own class", () => {
    expect(profile).toMatch(/render\(`<div id="pf"><\/div>\$\{meTabbar\(\)\}`, "cv2 cv2-me"\)/);
  });

  it("the page body has no emoji (the achievement badges use flat icons too)", () => {
    expect(EMOJI.test(profile)).toBe(false);
  });

  it("every achievement on the Me page has a flat icon", () => {
    const achBlock = app.slice(app.indexOf("const ACH = {"), app.indexOf("};", app.indexOf("const ACH = {")));
    const keys = [...achBlock.matchAll(/(\w+): \[/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(20);
    const icons = app.slice(app.indexOf("const ACH_ICO = {"), app.indexOf("};", app.indexOf("const ACH_ICO = {")));
    for (const k of keys) expect(icons, k).toMatch(new RegExp(`\\b${k}: `));
    expect(EMOJI.test(icons)).toBe(false);
  });

  it("the Me tab bar is the shared bar's flat icons, with Profile active", () => {
    const bar = fnBody("meTabbar");
    expect(bar).toMatch(/chTabbar\("me"\)/);
    expect(fnBody("navBar")).toMatch(/item\("profile", "#\/me", "me", "Profile"\)/);
    expect(EMOJI.test(bar)).toBe(false);
    expect(profile).not.toMatch(/tabbar\("me"\)/);
  });

  it("the Me page styles are scoped to the light theme and do not restyle other screens", () => {
    expect(css).toMatch(/body\.cv2-on \.cv2-me \.card\{background:#fff/);
    expect(css).toMatch(/body\.cv2-on \.cv2-me \.hero \.rays\{display:none\}/);
    expect(css).toMatch(/body\.cv2-on \.cv2-me \.ach\.got\{/);
    expect(css).not.toMatch(/^\.card\{background:#fff/m);
  });

  it("the flags are unchanged", () => {
    const flags = readFileSync(join(__dirname, "..", "domain", "feature-flags.ts"), "utf8");
    expect(flags).toMatch(/sharedReading:\s*true/);
  });
});
