// Bible Arena v3.9.0: one stricter filter for player display names (live rooms, duels, boards, profile),
// the same idea as the team/church name filter (server/v3/churches.ts). No imports: used by the engine and its tests.
// Matched inside joined words (catches "f u c k", "BigFuck99"):
const BAD = ["fuck", "fuk", "fvck", "bitch", "asshole", "bastard", "pussy", "nigger", "nigga", "whore", "slut", "porn", "hitler",
  "ashawo", "olosho", "oloshi", "werey", "satanrules", "vagina", "boobs", "bullshit", "motherf"];
// Whole words only, so Bible and normal names stay fine (Shittim, grape, Dickson, Sussex, cockpit, Peniel):
const WORDS = new Set(["shit", "shitty", "cunt", "rape", "rapist", "nude", "nudes", "dick", "cock", "sex", "sexy", "mumu", "penis", "kill", "killer"]);
export function badName(v: unknown): boolean {
  const lower = String(v ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const leet = lower.replace(/[@4]/g, "a").replace(/3/g, "e").replace(/[1!|]/g, "i").replace(/0/g, "o").replace(/[5$]/g, "s").replace(/7/g, "t");
  for (const s of [lower, leet]) {
    const words = s.replace(/[^a-z]+/g, " ").split(" ").filter(Boolean);
    const flat = words.join("");
    if (BAD.some((b) => flat.includes(b)) || words.some((w) => WORDS.has(w))) return true;
  }
  return false;
}
