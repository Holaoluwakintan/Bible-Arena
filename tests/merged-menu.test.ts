import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// The merged build: the shared reading plan and the duel/ranked/results screens sit in one app (web-v3/app.js). Both stay behind
// their flags, which nothing sets. These checks read the page source, since app.js is a browser script.
const ROOT = join(__dirname, "..", "web-v3");
const app = readFileSync(join(ROOT, "app.js"), "utf8");
const EMOJI = /\p{Extended_Pictographic}/u;

function fnBody(name: string): string {
  const start = app.indexOf(`function ${name}(`);
  expect(start).toBeGreaterThan(-1);
  const next = app.indexOf("\n}\n", start);
  return app.slice(start, next + 3);
}

function allFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? allFiles(p) : [p];
  });
}

describe("merged build: flags stay off", () => {
  it("nothing in the web pages sets either flag to true", () => {
    for (const file of allFiles(ROOT).filter((f) => /\.(js|html)$/.test(f))) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/sharedReading\s*:\s*true/);
      expect(text, file).not.toMatch(/chever2Duels\s*:\s*true/);
      expect(text, file).not.toMatch(/sharedReading\s*=\s*true/);
      expect(text, file).not.toMatch(/chever2Duels\s*=\s*true/);
    }
  });

  it("the server flag stays off too", () => {
    const flags = readFileSync(join(__dirname, "..", "domain", "feature-flags.ts"), "utf8");
    expect(flags).toMatch(/sharedReading: false/);
  });
});

describe("merged build: scripts load only behind their flags", () => {
  it("the loader asks for each file only when its flag is true, and boot waits for it", () => {
    const body = fnBody("featureScripts");
    expect(body).toMatch(/f\.sharedReading === true\) want\.push\("\/v3\/reading-screens\.js/);
    expect(body).toMatch(/f\.chever2Duels === true\) want\.push\("\/v3\/duel-screens\.js/);
    expect(body).toMatch(/if \(!want\.length\) return null/);
    expect(app).toMatch(/const loading = featureScripts\(\);\s*if \(loading\) await loading;/);
  });
});

describe("merged build: the menu has both entry points", () => {
  const menu = fnBody("chevrMenuHTML");

  it("links the shared reading plan to #/reading, only when its flag and script are on", () => {
    expect(menu).toMatch(/f\.sharedReading === true && window\.BAReading\) out \+= wrap\("#\/reading"/);
  });

  it("links duels and ranked to #/duels, only when the duel flag and script are on", () => {
    expect(menu).toMatch(/duelV2\(\)\) out \+= wrap\("#\/duels"/);
  });

  it("is placed on the home screen", () => {
    const home = fnBody("home");
    expect(home).toMatch(/\$\{chevrMenuHTML\(\)\}/);
  });

  it("uses icons, not emoji", () => {
    expect(menu).not.toMatch(EMOJI);
  });

  it("the reading route still needs its flag and script", () => {
    expect(app).toMatch(/if \(a === "reading"\) \{[\s\S]*?window\.BA_FLAGS\.sharedReading\) \|\| !window\.BAReading\) return home\(\)/);
  });
});
