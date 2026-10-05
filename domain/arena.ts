import { ARENA_POOL, type BibleQuestion, type Difficulty, type QuestionCategory } from "./questions";
import { toLocalDateKey } from "./progression";

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export interface ArenaCategory {
  id: QuestionCategory;
  title: string;
  tagline: string;
  icon: string;
  color: string;
  tint: string;
}

export const ARENA_CATEGORIES: ArenaCategory[] = [
  { id: "people", title: "People", tagline: "Heroes, kings, prophets & apostles", icon: "person.2.fill", color: "#A78BFA", tint: "rgba(167,139,250,0.14)" },
  { id: "places", title: "Places", tagline: "Cities, mountains, rivers & roads", icon: "map.fill", color: "#2DD4BF", tint: "rgba(45,212,191,0.14)" },
  { id: "events", title: "Events", tagline: "Miracles, battles & turning points", icon: "bolt.fill", color: "#FB7185", tint: "rgba(251,113,133,0.14)" },
  { id: "teachings", title: "Teachings", tagline: "Parables, psalms & wise words", icon: "lightbulb.fill", color: "#FBBF24", tint: "rgba(251,191,36,0.14)" },
  { id: "books", title: "Books & Words", tagline: "Books of the Bible & what words mean", icon: "book.fill", color: "#60A5FA", tint: "rgba(96,165,250,0.14)" },
];

export function getCategory(id: string | undefined | null): ArenaCategory | undefined {
  return ARENA_CATEGORIES.find((category) => category.id === id);
}

export const QUESTION_TYPE_LABEL: Record<string, string> = {
  multiple_choice: "Multiple choice",
  true_false: "True or false",
  fill_verse: "Fill the verse",
  who_said: "Who said it?",
  order_events: "Put in order",
  unscramble: "Unscramble",
  who_am_i: "Who am I?",
};

/* ------------------------------------------------------------------ */
/* Pool (dedupe legacy seed items that the v2 bank rewrites)           */
/* ------------------------------------------------------------------ */

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
const v2Prompts = new Set(ARENA_POOL.filter((q) => q.id.startsWith("arena-")).map((q) => normalize(q.prompt)));
export const ROUND_POOL: BibleQuestion[] = ARENA_POOL.filter((q) => q.id.startsWith("arena-") || !v2Prompts.has(normalize(q.prompt)));

export function questionsInCategory(category: QuestionCategory): BibleQuestion[] {
  return ROUND_POOL.filter((q) => q.category === category);
}

/* ------------------------------------------------------------------ */
/* Local arena stats                                                   */
/* ------------------------------------------------------------------ */

export interface DailyRecord { date: string; correct: number; total: number; score: number }

export interface ArenaStats {
  /** questionId -> times answered correctly */
  correct: Record<string, number>;
  /** questionId -> times seen */
  seen: Record<string, number>;
  xpByDay: Record<string, number>;
  daily?: DailyRecord;
  dailyHistory: string[];
  dailyGoalXp: number;
  survivalBest: number;
  bestCombo: number;
  perfectRounds: number;
  roundsPlayed: number;
  orderSolved: number;
  soundOn: boolean;
  hapticsOn: boolean;
}

export const EMPTY_ARENA_STATS: ArenaStats = {
  correct: {}, seen: {}, xpByDay: {}, dailyHistory: [], dailyGoalXp: 300,
  survivalBest: 0, bestCombo: 0, perfectRounds: 0, roundsPlayed: 0, orderSolved: 0,
  soundOn: false, hapticsOn: true,
};

export function normalizeArena(raw: Partial<ArenaStats> | undefined | null): ArenaStats {
  return { ...EMPTY_ARENA_STATS, ...(raw ?? {}), correct: { ...(raw?.correct ?? {}) }, seen: { ...(raw?.seen ?? {}) }, xpByDay: { ...(raw?.xpByDay ?? {}) }, dailyHistory: [...(raw?.dailyHistory ?? [])] };
}

export interface CategoryMastery { category: ArenaCategory; mastered: number; total: number; pct: number; stars: 0 | 1 | 2 | 3; seen: number }

export function getCategoryMastery(stats: ArenaStats, category: ArenaCategory): CategoryMastery {
  const pool = questionsInCategory(category.id);
  const mastered = pool.filter((q) => (stats.correct[q.id] ?? 0) > 0).length;
  const seen = pool.filter((q) => (stats.seen[q.id] ?? 0) > 0).length;
  const pct = pool.length ? Math.round((mastered / pool.length) * 100) : 0;
  const stars = pct >= 85 ? 3 : pct >= 50 ? 2 : pct >= 20 ? 1 : 0;
  return { category, mastered, total: pool.length, pct, stars, seen };
}

export function getAllMastery(stats: ArenaStats): CategoryMastery[] {
  return ARENA_CATEGORIES.map((category) => getCategoryMastery(stats, category));
}

/** The category we suggest next: least mastered, ties broken by least seen. */
export function suggestNextCategory(stats: ArenaStats, exclude?: string): ArenaCategory {
  const ranked = getAllMastery(stats).filter((m) => m.category.id !== exclude).sort((a, b) => a.pct - b.pct || a.seen - b.seen);
  return (ranked[0] ?? getAllMastery(stats)[0]).category;
}

export function todayKey(now = Date.now()): string { return toLocalDateKey(now); }

export function xpToday(stats: ArenaStats, now = Date.now()): number { return stats.xpByDay[todayKey(now)] ?? 0; }

export function dailyDoneToday(stats: ArenaStats, now = Date.now()): boolean { return stats.daily?.date === todayKey(now); }

export function msUntilTomorrow(now = Date.now()): number {
  const next = new Date(now); next.setHours(24, 0, 0, 0); return next.getTime() - now;
}

/* ------------------------------------------------------------------ */
/* Round building                                                      */
/* ------------------------------------------------------------------ */

export type RoundKind = "quick" | "category" | "survival" | "daily";

function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function seededRandom(seed: number): () => number {
  let t = seed >>> 0;
  return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}

/** Mix difficulty by how well the player knows this pool: new players get mostly easy, masters mostly hard. */
function difficultyPlan(count: number, masteryPct: number): Difficulty[] {
  const hard = masteryPct >= 60 ? 0.4 : masteryPct >= 25 ? 0.3 : 0.2;
  const easy = masteryPct >= 60 ? 0.2 : masteryPct >= 25 ? 0.3 : 0.4;
  const plan: Difficulty[] = [];
  for (let i = 0; i < count; i += 1) {
    const r = i / count;
    plan.push(r < easy ? "easy" : r < 1 - hard ? "medium" : "hard");
  }
  return plan;
}

export function buildRound(options: { kind: RoundKind; category?: QuestionCategory; stats: ArenaStats; count?: number; now?: number }): BibleQuestion[] {
  const { kind, category, stats } = options;
  const now = options.now ?? Date.now();
  if (kind === "daily") {
    const random = seededRandom(hashString(`daily:${todayKey(now)}`));
    const plan: Difficulty[] = ["easy", "easy", "medium", "medium", "medium", "hard", "hard"];
    const used = new Set<string>();
    return plan.map((difficulty, index) => {
      const cat = ARENA_CATEGORIES[index % ARENA_CATEGORIES.length].id;
      const candidates = ROUND_POOL.filter((q) => q.id.startsWith("arena-") && q.difficulty === difficulty && !used.has(q.id) && (index < 5 ? q.category === cat : true));
      const pick = candidates[Math.floor(random() * candidates.length)];
      used.add(pick.id);
      return pick;
    });
  }
  const count = options.count ?? (kind === "survival" ? 60 : 10);
  const pool = category ? questionsInCategory(category) : ROUND_POOL;
  const mastery = category ? getCategoryMastery(stats, getCategory(category)!).pct : Math.round(getAllMastery(stats).reduce((t, m) => t + m.pct, 0) / ARENA_CATEGORIES.length);
  // Prefer questions not yet answered correctly, then unseen, then the rest.
  const weight = (q: BibleQuestion) => (stats.correct[q.id] ? 2 : 0) + (stats.seen[q.id] ? 1 : 0) + Math.random() * 1.5;
  const byDifficulty = (d: Difficulty) => [...pool.filter((q) => q.difficulty === d)].sort((a, b) => weight(a) - weight(b));
  const buckets: Record<Difficulty, BibleQuestion[]> = { easy: byDifficulty("easy"), medium: byDifficulty("medium"), hard: byDifficulty("hard") };
  if (kind === "survival") {
    // Survival climbs: easy → medium → hard, then whatever is left.
    const ladder = [...shuffle(buckets.easy.slice(0, 8)), ...shuffle(buckets.medium.slice(0, 14)), ...shuffle(buckets.hard)];
    const rest = shuffle(pool.filter((q) => !ladder.includes(q)));
    return [...ladder, ...rest].slice(0, count);
  }
  const plan = difficultyPlan(count, mastery);
  const picked: BibleQuestion[] = [];
  for (const d of plan) {
    const order: Difficulty[] = d === "easy" ? ["easy", "medium", "hard"] : d === "medium" ? ["medium", "easy", "hard"] : ["hard", "medium", "easy"];
    for (const option of order) {
      const next = buckets[option].shift();
      if (next) { picked.push(next); break; }
    }
  }
  // Keep the climb (easy → hard) but avoid two order-puzzles back to back.
  return picked.filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

export function windowMsFor(question: BibleQuestion): number {
  if (question.type === "order_events") return 35_000;
  if (question.type === "unscramble") return 30_000;
  if (question.difficulty === "hard") return 25_000;
  return 20_000;
}

export const DIFFICULTY_POINTS: Record<Difficulty, number> = { easy: 100, medium: 150, hard: 200 };

export function comboMultiplier(streak: number): number {
  return streak >= 6 ? 3 : streak >= 3 ? 2 : 1;
}

export function scoreAnswer(question: BibleQuestion, isCorrect: boolean, responseMs: number, streakAfter: number): number {
  if (!isCorrect) return 0;
  const window = windowMsFor(question);
  const speed = Math.max(0, 1 - responseMs / window);
  const base = DIFFICULTY_POINTS[question.difficulty] + Math.round(50 * speed);
  return base * comboMultiplier(streakAfter);
}

export function isAnswerCorrect(question: BibleQuestion, answer: string | null): boolean {
  if (answer === null) return false;
  if (question.type === "unscramble") return answer.trim().toLowerCase().replace(/\s+/g, " ") === question.correctAnswer.trim().toLowerCase();
  return answer === question.correctAnswer;
}

export function referenceLabel(question: BibleQuestion): string {
  if (question.referenceText) return question.referenceText;
  const { book, chapter, verse } = question.reference;
  return verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`;
}

export function correctAnswerLabel(question: BibleQuestion): string {
  if (question.type === "order_events") return question.correctAnswer.split(">").map((id) => question.options.find((o) => o.id === id)?.label ?? id).join(" → ");
  if (question.type === "unscramble") return question.correctAnswer.toUpperCase();
  return question.options.find((o) => o.id === question.correctAnswer)?.label ?? question.correctAnswer;
}

/* ------------------------------------------------------------------ */
/* Verse of the day (KJV, public domain)                               */
/* ------------------------------------------------------------------ */

const VERSES: Array<{ text: string; ref: string }> = [
  { text: "Thy word is a lamp unto my feet, and a light unto my path.", ref: "Psalm 119:105" },
  { text: "Study to shew thyself approved unto God, a workman that needeth not to be ashamed, rightly dividing the word of truth.", ref: "2 Timothy 2:15" },
  { text: "Trust in the LORD with all thine heart; and lean not unto thine own understanding.", ref: "Proverbs 3:5" },
  { text: "I can do all things through Christ which strengtheneth me.", ref: "Philippians 4:13" },
  { text: "Thy word have I hid in mine heart, that I might not sin against thee.", ref: "Psalm 119:11" },
  { text: "Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee.", ref: "Joshua 1:9" },
  { text: "The grass withereth, the flower fadeth: but the word of our God shall stand for ever.", ref: "Isaiah 40:8" },
  { text: "Heaven and earth shall pass away, but my words shall not pass away.", ref: "Matthew 24:35" },
  { text: "This is the day which the LORD hath made; we will rejoice and be glad in it.", ref: "Psalm 118:24" },
  { text: "Let the word of Christ dwell in you richly in all wisdom.", ref: "Colossians 3:16" },
  { text: "The entrance of thy words giveth light; it giveth understanding unto the simple.", ref: "Psalm 119:130" },
  { text: "For the word of God is quick, and powerful, and sharper than any twoedged sword.", ref: "Hebrews 4:12" },
  { text: "Blessed are they that hear the word of God, and keep it.", ref: "Luke 11:28" },
  { text: "Seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.", ref: "Matthew 6:33" },
];

export function verseOfTheDay(now = Date.now()) {
  return VERSES[hashString(todayKey(now)) % VERSES.length];
}
