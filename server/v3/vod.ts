import fs from "node:fs";
import path from "node:path";

let VOD_LIST: Array<[string, string]> = [];
try {
  const vodPath = path.resolve(process.cwd(), "web-v3/vod-365.json");
  if (fs.existsSync(vodPath)) {
    VOD_LIST = JSON.parse(fs.readFileSync(vodPath, "utf-8"));
  }
} catch {}

export function vodForDay(day: string): [string, string] {
  if (!VOD_LIST.length) {
    return ["Thy word is a lamp unto my feet, and a light unto my path.", "Psalm 119:105"];
  }
  const n = Math.floor(Date.parse(day + "T00:00:00Z") / 86_400_000);
  const idx = ((n % VOD_LIST.length) + VOD_LIST.length) % VOD_LIST.length;
  return VOD_LIST[idx];
}
