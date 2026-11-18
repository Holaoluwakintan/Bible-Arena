import corpus from "../../web-v3/vod-365.json";
import { verseForDay } from "../../web-v3/daily-verse.mjs";

export function vodForDay(day: string): [string, string] {
  const verse = verseForDay(corpus, day);
  if (!verse) throw new RangeError("Invalid verse date");
  return [verse[0], verse[1]];
}
