import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// v3.13.1 audit fixes (Nov 12): voice bar faces and the false "answer didn't reach" line.
const web = (f: string) => readFileSync(join(__dirname, "..", "web-v3", f), "utf8");

describe("live game: voice bar avatars", () => {
  it("draws every voice chip with BAFace (picture or initial), never the raw avatar id", () => {
    const v = web("voice.js");
    expect(v).toContain('BAFace.html(a, "1.6em", n)');
    expect(v).toContain("face(x.avatar, x.name)");
    expect(v).not.toMatch(/esc\(a \|\| ""\)/);
  });
});

describe("live game: answer errors", () => {
  const s = web("live-play.js");
  const pick = s.slice(s.indexOf("async function pick("), s.indexOf("function feedback("));
  it("treats a repeat tap as a silent no-op", () => {
    expect(pick).toMatch(/if \(myPick !== null \|\| !S \|\| S\.phase !== "question"\) return;/);
  });
  it("never calls a server answer (409) a network problem", () => {
    const c409 = pick.slice(pick.indexOf("e.status === 409"), pick.indexOf("fail = \"net\""));
    expect(c409).not.toContain("didn't reach");
    expect(pick).toContain('if (fail === "net")');
  });
  it("accepts an answer the live state already shows as counted", () => {
    expect(pick).toContain("const counted = S.me && S.me.ans;");
  });
  it("clears the error on the next question", () => {
    for (const fn of ["function intro(s) {", "function koIntro(s) {"]) {
      const body = s.slice(s.indexOf(fn), s.indexOf(fn) + 120);
      expect(body).toContain("clearAnswerError()");
    }
  });
});
