// Bible Arena Live: turns the v3 question bank (web-v3/bank.json) into projector-friendly
// multiple-choice questions, and picks sets by category, difficulty and book.
import type { LQ } from "./live-engine";

type Tier = "b" | "s" | "t";
export interface BankItem {
  id: string; m: string; k: string; tiers: Tier[]; cat?: string; q?: string; o?: string[]; a?: number | string;
  clues?: string[]; text?: string; g?: Record<Tier, { blanks: number[]; decoys: string[] }>; r?: string; x?: string;
}

export const CATS: Record<string, { name: string; icon: string }> = {
  people: { name: "People", icon: "👤" }, events: { name: "Events", icon: "⚡" }, places: { name: "Places", icon: "🗺️" },
  teachings: { name: "Teachings", icon: "📖" }, numbers: { name: "Numbers", icon: "🔢" }, books: { name: "Books of the Bible", icon: "📚" },
  said: { name: "Who Said It?", icon: "💬" }, who: { name: "Who Am I?", icon: "🎭" }, myth: { name: "Bible or Myth", icon: "🧐" },
  verse: { name: "Complete the Verse", icon: "✍️" },
};
export const LEVELS: Record<Tier, string> = { b: "Easy", s: "Medium", t: "Hard" };

const OT = ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi"];
const NT = ["Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"];
export const BOOKS = [...OT, ...NT];

export function bookOf(ref?: string): string | null {
  if (!ref) return null;
  const m = ref.trim().match(/^((?:[123]\s)?[A-Za-z]+(?:\s(?:of\s)?[A-Za-z]+)?)/);
  if (!m) return null;
  let b = m[1].replace(/^Psalm$/, "Psalms").replace(/^Song of Songs$/, "Song of Solomon");
  if (!BOOKS.includes(b)) { const first = b.split(" ").slice(0, b.match(/^[123]\s/) ? 2 : 1).join(" "); b = BOOKS.includes(first) ? first : b; }
  return BOOKS.includes(b) ? b : null;
}
export const testamentOf = (book: string | null) => (book ? (NT.includes(book) ? "nt" : "ot") : null);

export function catOf(it: BankItem): string | null {
  if (it.k === "gap") return "verse";
  if (it.k === "who") return "who";
  if (it.k === "tf") return "myth";
  if (it.k === "who_said") return "said";
  if (it.k === "mc") return it.cat && CATS[it.cat] ? it.cat : "events";
  return null; // "order" questions do not suit a 4-button live round
}

const WORD = /[A-Za-z\u2019]+/g;
function hash(s: string): number { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/** One bank item → one live question (null when the item cannot be asked with 2–4 buttons). */
export function toLive(it: BankItem, tier: Tier = "s"): LQ | null {
  const cat = catOf(it);
  if (!cat) return null;
  const base = { id: it.id, r: it.r, x: it.x, cat, tier: it.tiers[0] };
  if (it.k === "mc" || it.k === "who_said") {
    if (!it.o || it.o.length < 2 || typeof it.a !== "number") return null;
    return { ...base, type: it.k === "mc" ? "mc" : "said", q: String(it.q), o: it.o.slice(0, 4), a: it.a };
  }
  if (it.k === "who") {
    if (!it.o || typeof it.a !== "number") return null;
    return { ...base, type: "who", q: "Who am I?", clues: (it.clues || []).slice(0, 4), o: it.o.slice(0, 4), a: it.a };
  }
  if (it.k === "tf") {
    return { ...base, type: "tf", q: String(it.q), o: ["Bible fact", "Myth"], a: it.a === "fact" ? 0 : 1 };
  }
  if (it.k === "gap" && it.text && it.g) {
    const toks = [...it.text.matchAll(WORD)];
    const spec = it.g[tier] || it.g.s || it.g.b;
    const blanks = (it.g.b?.blanks || spec.blanks).filter((i) => toks[i]);
    if (!blanks.length) return null;
    // the most meaningful blank: the longest word, ties broken by position
    const bi = blanks.slice().sort((x, y) => toks[y][0].length - toks[x][0].length || x - y)[0];
    const answer = toks[bi][0];
    const pool = [...(spec.decoys || []), ...(it.g.t?.decoys || []), ...(it.g.s?.decoys || []), ...(it.g.b?.decoys || [])];
    const decoys: string[] = [];
    for (const d of pool) if (d.toLowerCase() !== answer.toLowerCase() && !decoys.some((x) => x.toLowerCase() === d.toLowerCase())) decoys.push(d);
    if (decoys.length < 3) return null;
    const t = toks[bi];
    const q = it.text.slice(0, t.index) + "_____" + it.text.slice((t.index || 0) + answer.length);
    const opts = [answer, ...decoys.slice(0, 3)];
    // deterministic shuffle so the right answer is not always first
    const h = hash(it.id);
    const a = h % 4;
    [opts[0], opts[a]] = [opts[a], opts[0]];
    return { ...base, type: "gap", q, o: opts, a, tier: tier };
  }
  return null;
}

export function bankMeta(items: BankItem[]) {
  const cats: Record<string, Record<string, number>> = {};
  const books: Record<string, number> = {};
  for (const it of items) {
    const c = catOf(it);
    if (!c) continue;
    cats[c] = cats[c] || { b: 0, s: 0, t: 0, all: 0 };
    cats[c].all++;
    for (const t of it.tiers) cats[c][t]++;
    const b = bookOf(it.r);
    if (b) books[b] = (books[b] || 0) + 1;
  }
  return {
    cats: Object.entries(CATS).filter(([k]) => cats[k]).map(([k, v]) => ({ id: k, ...v, counts: cats[k] })),
    levels: LEVELS,
    books: BOOKS.filter((b) => books[b]).map((b) => ({ name: b, count: books[b], t: testamentOf(b) })),
    total: items.filter((i) => catOf(i)).length,
  };
}

export interface Pick { cats?: string[]; tiers?: string[]; books?: string[]; testament?: string; count?: number }

export function matches(it: BankItem, p: Pick): boolean {
  const c = catOf(it);
  if (!c) return false;
  if (p.cats && p.cats.length && !p.cats.includes(c)) return false;
  if (p.tiers && p.tiers.length && !it.tiers.some((t) => p.tiers!.includes(t))) return false;
  const b = bookOf(it.r);
  if (p.books && p.books.length && !(b && p.books.includes(b))) return false;
  if (p.testament === "ot" || p.testament === "nt") { if (testamentOf(b) !== p.testament) return false; }
  return true;
}

export function countMatches(items: BankItem[], p: Pick): number { return items.filter((i) => matches(i, p)).length; }

/** Random set, spread across the chosen categories (round-robin) so a night never feels samey. */
export function pickSet(items: BankItem[], p: Pick, rnd: () => number = Math.random): LQ[] {
  const n = Math.max(1, Math.min(50, Number(p.count) || 15));
  const tiers = (p.tiers || []).filter((t) => t === "b" || t === "s" || t === "t") as Tier[];
  const tier: Tier = tiers.includes("t") && !tiers.includes("b") ? "t" : tiers.includes("b") && !tiers.includes("t") ? "b" : "s";
  const groups = new Map<string, BankItem[]>();
  for (const it of items) if (matches(it, p)) { const c = catOf(it)!; if (!groups.has(c)) groups.set(c, []); groups.get(c)!.push(it); }
  for (const g of groups.values()) for (let i = g.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [g[i], g[j]] = [g[j], g[i]]; }
  const keys = [...groups.keys()].sort(() => rnd() - 0.5);
  const out: LQ[] = [];
  let guard = 0;
  while (out.length < n && keys.length && guard++ < 5000) {
    for (let k = 0; k < keys.length && out.length < n; k++) {
      const g = groups.get(keys[k])!;
      const it = g.pop();
      if (!it) { keys.splice(k, 1); k--; continue; }
      const lq = toLive(it, tier);
      if (lq) out.push(lq);
    }
  }
  return out;
}

/** Validates host-written questions ("custom quiz" for this Sunday's sermon text). */
export function cleanCustom(list: unknown): LQ[] {
  if (!Array.isArray(list)) return [];
  const out: LQ[] = [];
  list.slice(0, 50).forEach((raw: any, i) => {
    if (!raw || typeof raw !== "object") return;
    const q = String(raw.q || "").replace(/\s+/g, " ").trim().slice(0, 240);
    const o = (Array.isArray(raw.o) ? raw.o : []).map((x: unknown) => String(x ?? "").replace(/\s+/g, " ").trim().slice(0, 90)).filter(Boolean).slice(0, 4);
    const a = Number(raw.a);
    if (!q || o.length < 2 || !Number.isInteger(a) || a < 0 || a >= o.length) return;
    const r = String(raw.r || "").trim().slice(0, 60) || undefined;
    out.push({ id: `c${i + 1}`, type: "custom", q, o, a, r, x: String(raw.x || "").trim().slice(0, 240) || undefined, cat: "custom" });
  });
  return out;
}
