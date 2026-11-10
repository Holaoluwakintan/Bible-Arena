// Shared reading, step 1: the data model only. Nothing here is shown to anyone.
// Every screen that uses it sits behind FEATURE_FLAGS.sharedReading in domain/feature-flags.ts, which is OFF.
// No network, no storage, no quiz code: the quiz and its KJV-exact checks are untouched.

export const READING_LENGTH_DAYS = [3, 7, 14, 30] as const;
export type ReadingLengthDays = (typeof READING_LENGTH_DAYS)[number];

// The default translation. The version field can hold other codes later (NLT, MSG, ...).
export const DEFAULT_BIBLE_VERSION = "KJV";

// Translations the model accepts today. Only KJV has quiz questions checked against its wording,
// so only KJV portions can be quizzed (see isQuizReady).
export const KNOWN_BIBLE_VERSIONS = ["KJV", "NLT", "MSG"] as const;
export const QUIZ_CHECKED_VERSIONS: readonly string[] = ["KJV"];

export interface BibleBook {
  name: string;
  chapters: number;
}

// The 66 books in canonical order, with chapter counts (1,189 chapters in all).
export const BIBLE_BOOKS: readonly BibleBook[] = [
  { name: "Genesis", chapters: 50 },
  { name: "Exodus", chapters: 40 },
  { name: "Leviticus", chapters: 27 },
  { name: "Numbers", chapters: 36 },
  { name: "Deuteronomy", chapters: 34 },
  { name: "Joshua", chapters: 24 },
  { name: "Judges", chapters: 21 },
  { name: "Ruth", chapters: 4 },
  { name: "1 Samuel", chapters: 31 },
  { name: "2 Samuel", chapters: 24 },
  { name: "1 Kings", chapters: 22 },
  { name: "2 Kings", chapters: 25 },
  { name: "1 Chronicles", chapters: 29 },
  { name: "2 Chronicles", chapters: 36 },
  { name: "Ezra", chapters: 10 },
  { name: "Nehemiah", chapters: 13 },
  { name: "Esther", chapters: 10 },
  { name: "Job", chapters: 42 },
  { name: "Psalms", chapters: 150 },
  { name: "Proverbs", chapters: 31 },
  { name: "Ecclesiastes", chapters: 12 },
  { name: "Song of Solomon", chapters: 8 },
  { name: "Isaiah", chapters: 66 },
  { name: "Jeremiah", chapters: 52 },
  { name: "Lamentations", chapters: 5 },
  { name: "Ezekiel", chapters: 48 },
  { name: "Daniel", chapters: 12 },
  { name: "Hosea", chapters: 14 },
  { name: "Joel", chapters: 3 },
  { name: "Amos", chapters: 9 },
  { name: "Obadiah", chapters: 1 },
  { name: "Jonah", chapters: 4 },
  { name: "Micah", chapters: 7 },
  { name: "Nahum", chapters: 3 },
  { name: "Habakkuk", chapters: 3 },
  { name: "Zephaniah", chapters: 3 },
  { name: "Haggai", chapters: 2 },
  { name: "Zechariah", chapters: 14 },
  { name: "Malachi", chapters: 4 },
  { name: "Matthew", chapters: 28 },
  { name: "Mark", chapters: 16 },
  { name: "Luke", chapters: 24 },
  { name: "John", chapters: 21 },
  { name: "Acts", chapters: 28 },
  { name: "Romans", chapters: 16 },
  { name: "1 Corinthians", chapters: 16 },
  { name: "2 Corinthians", chapters: 13 },
  { name: "Galatians", chapters: 6 },
  { name: "Ephesians", chapters: 6 },
  { name: "Philippians", chapters: 4 },
  { name: "Colossians", chapters: 4 },
  { name: "1 Thessalonians", chapters: 5 },
  { name: "2 Thessalonians", chapters: 3 },
  { name: "1 Timothy", chapters: 6 },
  { name: "2 Timothy", chapters: 4 },
  { name: "Titus", chapters: 3 },
  { name: "Philemon", chapters: 1 },
  { name: "Hebrews", chapters: 13 },
  { name: "James", chapters: 5 },
  { name: "1 Peter", chapters: 5 },
  { name: "2 Peter", chapters: 3 },
  { name: "1 John", chapters: 5 },
  { name: "2 John", chapters: 1 },
  { name: "3 John", chapters: 1 },
  { name: "Jude", chapters: 1 },
  { name: "Revelation", chapters: 22 },
];

export interface ReadingPortion {
  book: string;
  startChapter: number;
  endChapter: number;
  lengthDays: ReadingLengthDays;
  version: string;
}

export type ReadingResult<T> = { ok: true; value: T } | { ok: false; error: string };

const VERSION_CODE = /^[A-Z0-9]{2,8}$/;

export function findBook(name: string): BibleBook | undefined {
  return BIBLE_BOOKS.find((b) => b.name === name);
}

// Builds a portion from loose input. The version defaults to KJV.
export function createReadingPortion(input: {
  book: string;
  startChapter: number;
  endChapter: number;
  lengthDays: number;
  version?: string;
}): ReadingResult<ReadingPortion> {
  const portion: ReadingPortion = {
    book: input.book,
    startChapter: input.startChapter,
    endChapter: input.endChapter,
    lengthDays: input.lengthDays as ReadingLengthDays,
    version: input.version ?? DEFAULT_BIBLE_VERSION,
  };
  const error = portionError(portion);
  return error ? { ok: false, error } : { ok: true, value: portion };
}

export function portionError(p: ReadingPortion): string | null {
  const book = findBook(p.book);
  if (!book) return "unknown book";
  if (!Number.isInteger(p.startChapter) || !Number.isInteger(p.endChapter)) return "chapters must be whole numbers";
  if (p.startChapter < 1 || p.endChapter > book.chapters) return `${p.book} has chapters 1 to ${book.chapters}`;
  if (p.endChapter < p.startChapter) return "the last chapter comes before the first";
  if (!(READING_LENGTH_DAYS as readonly number[]).includes(p.lengthDays)) return "length must be 3, 7, 14 or 30 days";
  if (!VERSION_CODE.test(p.version)) return "version code must be 2 to 8 capital letters or digits";
  return null;
}

// True when the portion's wording can be checked by the quiz (KJV today).
export function isQuizReady(p: ReadingPortion): boolean {
  return QUIZ_CHECKED_VERSIONS.includes(p.version);
}

// ---- Partner pairing ----

export const PAIRING_STATES = ["invited", "portion_chosen", "reading", "finished", "duel_ready"] as const;
export type PairingState = (typeof PAIRING_STATES)[number];

export interface PartnerPairing {
  id: string;
  inviterId: string;
  partnerId: string | null;
  state: PairingState;
  portion: ReadingPortion | null;
  createdAt: string;
}

export function createPairing(id: string, inviterId: string, createdAt: string): PartnerPairing {
  return { id, inviterId, partnerId: null, state: "invited", portion: null, createdAt };
}

// A partner accepts the invite. Not a state change: the pair stays "invited" until a portion is chosen.
export function acceptInvite(pairing: PartnerPairing, partnerId: string): ReadingResult<PartnerPairing> {
  if (pairing.state !== "invited") return { ok: false, error: "this invite is already past the invited step" };
  if (partnerId === pairing.inviterId) return { ok: false, error: "you cannot pair with yourself" };
  if (pairing.partnerId !== null && pairing.partnerId !== partnerId) return { ok: false, error: "this invite already has a partner" };
  return { ok: true, value: { ...pairing, partnerId } };
}

// The one legal order: invited -> portion_chosen -> reading -> finished -> duel_ready.
const NEXT_STATE: Record<PairingState, PairingState | null> = {
  invited: "portion_chosen",
  portion_chosen: "reading",
  reading: "finished",
  finished: "duel_ready",
  duel_ready: null,
};

export function nextPairingState(state: PairingState): PairingState | null {
  return NEXT_STATE[state];
}

// Moves a pair one step on. Choosing a portion needs a partner and a valid portion.
export function advancePairing(pairing: PartnerPairing, portion?: ReadingPortion): ReadingResult<PartnerPairing> {
  const to = NEXT_STATE[pairing.state];
  if (to === null) return { ok: false, error: "the pair is already at duel ready" };
  if (to === "portion_chosen") {
    if (pairing.partnerId === null) return { ok: false, error: "no partner has accepted yet" };
    if (!portion) return { ok: false, error: "a portion is needed to move on" };
    const error = portionError(portion);
    if (error) return { ok: false, error };
    return { ok: true, value: { ...pairing, state: to, portion } };
  }
  return { ok: true, value: { ...pairing, state: to } };
}

// ---- Daily split ----

export interface DayReading {
  day: number;          // 1-based
  startChapter: number;
  endChapter: number;   // below startChapter means a catch-up day with no chapters
}

// Spreads the portion's chapters over its days. Earlier days take the extra chapters,
// so the days stay in order with no gaps: day 1 starts at the first chapter, the last day ends at the last.
export function dailySplit(p: ReadingPortion): DayReading[] {
  const out: DayReading[] = [];
  let cursor = p.startChapter;
  for (let d = 1; d <= p.lengthDays; d++) {
    const remainingChapters = p.endChapter - cursor + 1;
    const remainingDays = p.lengthDays - d + 1;
    const n = remainingChapters > 0 ? Math.ceil(remainingChapters / remainingDays) : 0;
    out.push({ day: d, startChapter: cursor, endChapter: cursor + n - 1 });
    cursor += n;
  }
  return out;
}
