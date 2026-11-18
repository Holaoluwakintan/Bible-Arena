import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import brand from "../constants/chever-brand.json";

const web = (name: string) => readFileSync(join(__dirname, "..", "web-v3", name), "utf8");
const version = (path: string, source: string) => {
  const prefix = `/v3/${path}?v=`;
  return source.split(prefix)[1]?.match(/^[\d.]+/)?.[0];
};

describe("Chever shared UI assets", () => {
  it("loads the same shared components before surface overrides and precaches the exact app version", () => {
    const sw = web("sw.js");
    const cacheVersion = sw.match(/VERSION = "ba-([\d.]+)"/)?.[1];
    expect(cacheVersion).toBeTruthy();
    for (const [page, local] of [["index.html", "app.css"], ["live.html", "live.css"], ["play.html", "play.css"]]) {
      const html = web(page);
      for (const asset of ["brand-tokens.css", "chever-ui.css", local]) expect(version(asset, html)).toBe(cacheVersion);
      expect(html.indexOf("/v3/chever-ui.css")).toBeLessThan(html.indexOf(`/v3/${local}`));
    }
    for (const asset of ["brand-tokens.css", "chever-ui.css", "app.css", "app.js"]) expect(version(asset, sw)).toBe(cacheVersion);
  });

  it("keeps the projector variant out of the main app and phone controller", () => {
    expect(web("live.html")).toContain("data-chever-presentation");
    expect(web("play.html")).not.toContain("data-chever-presentation");
    expect(web("index.html")).not.toContain("data-chever-presentation");
    expect(web("app.js")).not.toContain('"cv2-on"');
    const manifest = JSON.parse(web("manifest.webmanifest"));
    expect(manifest.background_color).toBe(brand.paper);
    expect(manifest.theme_color).toBe(brand.paper);
  });
});
