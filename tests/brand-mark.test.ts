import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The Chever brand mark (the C from the duel mockup) and its wordmark, on every screen. web-v3/app.js is a browser script,
// so these checks read its source and the shipped brand files.
const ROOT = join(__dirname, "..", "web-v3");
const app = readFileSync(join(ROOT, "app.js"), "utf8");
const css = readFileSync(join(ROOT, "app.css"), "utf8");
const EMOJI = /\p{Extended_Pictographic}/u;

describe("brand mark: one bar on every screen", () => {
  it("render() draws the brand bar above every screen", () => {
    expect(app).toMatch(/app\.innerHTML = `\$\{brandBar\(\)\}<div class="screen \$\{cls \|\| ""\}">\$\{html\}<\/div>`;/);
  });

  it("the bar carries the C mark and the Chever wordmark, with no emoji", () => {
    const start = app.indexOf("function brandBar(");
    const body = app.slice(start, app.indexOf("\n}\n", start) + 3);
    expect(body).toMatch(/class="cvm-mark"/);
    expect(body).toMatch(/<span class="cvm-word">Chever<\/span>/);
    expect(body).toMatch(/aria-label="Chever"/);
    expect(EMOJI.test(body)).toBe(false);
  });

  it("the mark has a dark-theme and a light-theme colour, and the light look overrides it", () => {
    expect(css).toMatch(/\.cvm-body\{fill:#F5F7FB\}/);
    expect(css).toMatch(/\.cvm-sw\{fill:#FFC300\}/);
    expect(css).toMatch(/body\.cv2-on \.cvm-body\{fill:#022569\}/);
  });

  it("the old per-screen wordmarks are gone, so the name shows once", () => {
    expect(app).not.toMatch(/cv2-brand">Chever</);
  });

  it("the brand files ship with the source: SVG and PNG of the C", () => {
    expect(existsSync(join(ROOT, "brand", "chever-c.svg"))).toBe(true);
    expect(existsSync(join(ROOT, "brand", "chever-c.png"))).toBe(true);
    expect(existsSync(join(ROOT, "brand", "chever-wordmark.svg"))).toBe(true);
  });
});
