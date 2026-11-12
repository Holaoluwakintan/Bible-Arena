// Shared reading, step 1: the data model only. Nothing here is shown to anyone.
// Every screen that uses it sits behind FEATURE_FLAGS.sharedReading in domain/feature-flags.ts, which is OFF.
// No network, no storage, no quiz code: the quiz and its KJV-exact checks are untouched.

// Preset lengths on the pick screen. A custom length (a number and a unit) can be any whole number of days up to READING_MAX_DAYS.
export const READING_LENGTH_DAYS = [1, 3, 7, 14, 30] as const;
export type ReadingLengthDays = number;
export const READING_MAX_DAYS = 3650; // 10 years
export const READING_UNITS = ["hours", "days", "weeks", "months", "years"] as const;
export type ReadingUnit = (typeof READING_UNITS)[number];

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
  lengthLabel?: string; // how the length was typed, e.g. "1 year" or "7 hours"; shown on the progress screen
  // Several books (or the New or Old Testament, or the whole Bible): the books in canonical order. Then book is a label
  // ("New Testament", "Ruth, Esther and Job") and the chapters run 1 to the total across these books, in order.
  books?: string[];
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
  if (p.books !== undefined) {
    if (!Array.isArray(p.books) || p.books.length === 0) return "pick at least one book";
    let total = 0;
    for (const name of p.books) {
      const b = findBook(name);
      if (!b) return `unknown book: ${name}`;
      total += b.chapters;
    }
    if (p.startChapter !== 1 || p.endChapter !== total) return "the chapters do not match the books picked";
  } else {
    const book = findBook(p.book);
    if (!book) return "unknown book";
    if (!Number.isInteger(p.startChapter) || !Number.isInteger(p.endChapter)) return "chapters must be whole numbers";
    if (p.startChapter < 1 || p.endChapter > book.chapters) return `${p.book} has chapters 1 to ${book.chapters}`;
    if (p.endChapter < p.startChapter) return "the last chapter comes before the first";
  }
  if (!Number.isInteger(p.lengthDays) || p.lengthDays < 1 || p.lengthDays > READING_MAX_DAYS) return "length must be a whole number of days from 1 to 3650 (10 years)";
  if (!VERSION_CODE.test(p.version)) return "version code must be 2 to 8 capital letters or digits";
  return null;
}

// ---- Scope: which books a plan covers ----
// One book (with its chapter range), several chosen books, the New Testament, the Old Testament, or the whole Bible.
// Several books, a testament or the whole Bible is one run of chapters: the days are cut from that run, in canonical order.

export const READING_SCOPES = ["book", "books", "nt", "ot", "bible"] as const;
export type ReadingScope = (typeof READING_SCOPES)[number];

const OT_BOOKS: readonly BibleBook[] = BIBLE_BOOKS.slice(0, 39);
const NT_BOOKS: readonly BibleBook[] = BIBLE_BOOKS.slice(39);

export function chaptersIn(books: readonly BibleBook[]): number {
  return books.reduce((n, b) => n + b.chapters, 0);
}

// The books a multi-book scope covers, in canonical order. "books" takes the names the person picked (any order, no repeats).
export function scopeBooks(scope: Exclude<ReadingScope, "book">, names?: unknown): ReadingResult<BibleBook[]> {
  if (scope === "bible") return { ok: true, value: BIBLE_BOOKS.slice() };
  if (scope === "ot") return { ok: true, value: OT_BOOKS.slice() };
  if (scope === "nt") return { ok: true, value: NT_BOOKS.slice() };
  if (!Array.isArray(names) || names.length === 0) return { ok: false, error: "pick at least one book" };
  const wanted = new Set(names.map((n) => String(n)));
  for (const n of wanted) if (!findBook(n)) return { ok: false, error: `unknown book: ${n}` };
  return { ok: true, value: BIBLE_BOOKS.filter((b) => wanted.has(b.name)) };
}

// The label a multi-book plan shows in place of a book name.
export function scopeLabel(scope: Exclude<ReadingScope, "book">, books: readonly BibleBook[]): string {
  if (scope === "nt") return "New Testament";
  if (scope === "ot") return "Old Testament";
  if (scope === "bible") return "The whole Bible";
  if (books.length === 1) return books[0].name;
  if (books.length <= 3) return books.map((b) => b.name).join(", ").replace(/, ([^,]+)$/, " and $1");
  return `${books.length} books`;
}

// Days from chapters and a pace: ceil(chapters / chapters a day). The pace is a whole number of chapters, 1 or more.
export function daysForPace(chapters: number, chaptersPerDay: unknown): ReadingResult<number> {
  const pace = typeof chaptersPerDay === "string" && chaptersPerDay.trim() !== "" ? Number(chaptersPerDay) : chaptersPerDay;
  if (typeof pace !== "number" || !Number.isInteger(pace) || pace < 1) return { ok: false, error: "enter a whole number of chapters a day, 1 or more" };
  if (!Number.isInteger(chapters) || chapters < 1) return { ok: false, error: "the plan needs at least one chapter" };
  const days = Math.ceil(chapters / pace);
  if (days > READING_MAX_DAYS) return { ok: false, error: "at this pace the plan runs past 10 years, so read more chapters a day" };
  return { ok: true, value: days };
}

export interface PortionInput {
  scope?: unknown;          // "book" (the default), "books", "nt", "ot" or "bible"
  book?: unknown;           // scope "book"
  startChapter?: unknown;   // scope "book"
  endChapter?: unknown;     // scope "book"
  books?: unknown;          // scope "books": the names picked
  lengthDays?: unknown;     // the days, when no pace is given
  chaptersPerDay?: unknown; // a pace: when given, the days are the chapters ÷ this, rounded up
  version?: unknown;
}

// Builds a plan's portion from any scope. Single-book plans come out exactly as createReadingPortion makes them.
export function buildReadingPortion(input: PortionInput): ReadingResult<ReadingPortion> {
  const scope = input.scope === undefined || input.scope === null || input.scope === "" ? "book" : String(input.scope);
  if (!(READING_SCOPES as readonly string[]).includes(scope)) return { ok: false, error: "pick one book, several books, the New Testament, the Old Testament or the whole Bible" };
  const version = input.version === undefined ? DEFAULT_BIBLE_VERSION : String(input.version);
  const paced = input.chaptersPerDay !== undefined && input.chaptersPerDay !== null && input.chaptersPerDay !== "";
  let portion: ReadingPortion;
  if (scope === "book") {
    const book = String(input.book ?? "");
    const startChapter = Number(input.startChapter);
    const endChapter = Number(input.endChapter);
    let lengthDays = Number(input.lengthDays);
    let lengthLabel: string | undefined;
    if (paced) {
      const chapters = endChapter - startChapter + 1;
      const days = Number.isInteger(chapters) && chapters > 0 ? daysForPace(chapters, input.chaptersPerDay) : null;
      if (days && !days.ok) return days;
      if (days && days.ok) { lengthDays = days.value; lengthLabel = paceLabel(Number(input.chaptersPerDay)); }
    }
    portion = { book, startChapter, endChapter, lengthDays, version, ...(lengthLabel ? { lengthLabel } : {}) };
  } else {
    const picked = scopeBooks(scope as Exclude<ReadingScope, "book">, input.books);
    if (!picked.ok) return picked;
    const books = picked.value;
    const total = chaptersIn(books);
    let lengthDays = Number(input.lengthDays);
    let lengthLabel: string | undefined;
    if (paced) {
      const days = daysForPace(total, input.chaptersPerDay);
      if (!days.ok) return days;
      lengthDays = days.value;
      lengthLabel = paceLabel(Number(input.chaptersPerDay));
    }
    portion = {
      book: scopeLabel(scope as Exclude<ReadingScope, "book">, books),
      startChapter: 1,
      endChapter: total,
      lengthDays,
      version,
      books: books.map((b) => b.name),
      ...(lengthLabel ? { lengthLabel } : {}),
    };
  }
  const error = portionError(portion);
  return error ? { ok: false, error } : { ok: true, value: portion };
}

function paceLabel(chaptersPerDay: number): string {
  return `${chaptersPerDay} chapter${chaptersPerDay === 1 ? "" : "s"} a day`;
}

// The chapter at position n (1-based) of the plan's run of chapters: for a multi-book plan, the nth chapter across its books.
export function chapterAt(p: ReadingPortion, n: number): { book: string; chapter: number } {
  if (p.books === undefined) return { book: p.book, chapter: n };
  let left = n;
  const list = BIBLE_BOOKS.filter((b) => (p.books as string[]).includes(b.name));
  for (const b of list) {
    if (left <= b.chapters) return { book: b.name, chapter: left };
    left -= b.chapters;
  }
  const last = list[list.length - 1];
  return { book: last.name, chapter: last.chapters };
}

// How a run of chapters reads: "Matthew 1–7", or across books "Genesis 50 – Exodus 2". Empty for a catch-up day.
export function refFor(p: ReadingPortion, start: number, end: number): string {
  if (end < start) return "";
  const a = chapterAt(p, start);
  const b = chapterAt(p, end);
  if (a.book === b.book) return a.chapter === b.chapter ? `${a.book} ${a.chapter}` : `${a.book} ${a.chapter}–${b.chapter}`;
  return `${a.book} ${a.chapter} – ${b.book} ${b.chapter}`;
}

export interface DayPlan extends DayReading {
  ref: string; // the day's reading as a person reads it
}

// The daily split with each day's reading written out.
export function dailyReadings(p: ReadingPortion): DayPlan[] {
  return dailySplit(p).map((d) => ({ ...d, ref: refFor(p, d.startChapter, d.endChapter) }));
}

// Turns a custom length (a number and a unit) into days. Hours under a day count as one day,
// a month is 30 days and a year is 365. Returns an error for zero, negative, fractional or too-long input.
export function customLengthDays(amount: number, unit: ReadingUnit): ReadingResult<number> {
  if (!Number.isInteger(amount) || amount < 1) return { ok: false, error: "enter a whole number of 1 or more" };
  if (!(READING_UNITS as readonly string[]).includes(unit)) return { ok: false, error: "pick hours, days, weeks, months or years" };
  const days = unit === "hours" ? Math.ceil(amount / 24) : amount * { days: 1, weeks: 7, months: 30, years: 365 }[unit as "days" | "weeks" | "months" | "years"];
  if (days > READING_MAX_DAYS) return { ok: false, error: "a custom length goes up to 10 years" };
  return { ok: true, value: days };
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
