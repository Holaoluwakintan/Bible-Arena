export type QuestionType = "multiple_choice" | "true_false" | "unscramble" | "who_am_i";
export type VerificationStatus = "draft" | "review" | "verified" | "rejected";
export type QuestionCategory = "people" | "places" | "events" | "teachings" | "books";
export type Difficulty = "easy" | "medium" | "hard";
export type GameMode = "bible_quiz" | "bible_or_myth" | "word_puzzle" | "daily_challenge";

export interface QuestionOption {
  id: string;
  label: string;
}

export interface BibleReference {
  book: string;
  chapter: number;
  verse?: string;
  translation?: string;
}

export interface BibleQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  options: QuestionOption[];
  correctAnswer: string;
  category: QuestionCategory;
  difficulty: Difficulty;
  explanation: string;
  reference: BibleReference;
  source: string;
  status: VerificationStatus;
}

export function validateQuestion(question: BibleQuestion): string[] {
  const errors: string[] = [];
  const optionIds = new Set(question.options.map((option) => option.id));

  if (!question.id.trim()) errors.push("Question id is required.");
  if (!question.prompt.trim()) errors.push("Question prompt is required.");
  if (question.type === "multiple_choice" && question.options.length !== 4) errors.push("Multiple-choice questions require exactly four options.");
  if (question.type === "true_false" && question.options.length !== 2) errors.push("True/false questions require exactly two options.");
  if (question.type !== "unscramble" && !optionIds.has(question.correctAnswer)) errors.push("Correct answer must match an option id.");
  if (question.type === "unscramble" && !question.correctAnswer.trim()) errors.push("Unscramble questions require a canonical text answer.");
  if (!question.explanation.trim()) errors.push("Question explanation is required.");
  if (!question.reference.book.trim() || question.reference.chapter < 1) errors.push("A valid Bible reference is required.");
  if (!question.source.trim()) errors.push("Question source is required.");
  return errors;
}

export function isCompetitiveQuestion(question: BibleQuestion): boolean {
  return question.status === "verified" && validateQuestion(question).length === 0;
}

export const VERIFIED_BIBLE_QUIZ_QUESTIONS: BibleQuestion[] = [
  { id: "bq-001", type: "multiple_choice", prompt: "Who interpreted Pharaoh's dreams in Egypt?", options: [{ id: "a", label: "Moses" }, { id: "b", label: "Joseph" }, { id: "c", label: "Daniel" }, { id: "d", label: "Samuel" }], correctAnswer: "b", category: "people", difficulty: "easy", explanation: "Joseph interpreted Pharaoh's dreams and advised Egypt to prepare for seven years of famine.", reference: { book: "Genesis", chapter: 41, verse: "15-16" }, source: "Bible Arena verified seed bank", status: "verified" },
  { id: "bq-002", type: "multiple_choice", prompt: "Who led the Israelites across the Red Sea?", options: [{ id: "a", label: "Joshua" }, { id: "b", label: "Aaron" }, { id: "c", label: "Moses" }, { id: "d", label: "Caleb" }], correctAnswer: "c", category: "events", difficulty: "easy", explanation: "God instructed Moses to stretch out his hand, and the sea was divided for Israel to cross.", reference: { book: "Exodus", chapter: 14, verse: "21-22" }, source: "Bible Arena verified seed bank", status: "verified" },
  { id: "bq-003", type: "multiple_choice", prompt: "In which town was Jesus born?", options: [{ id: "a", label: "Nazareth" }, { id: "b", label: "Jerusalem" }, { id: "c", label: "Bethlehem" }, { id: "d", label: "Capernaum" }], correctAnswer: "c", category: "places", difficulty: "easy", explanation: "Jesus was born in Bethlehem of Judea, the city associated with David.", reference: { book: "Matthew", chapter: 2, verse: "1" }, source: "Bible Arena verified seed bank", status: "verified" },
  { id: "bq-004", type: "multiple_choice", prompt: "Who defeated Goliath?", options: [{ id: "a", label: "David" }, { id: "b", label: "Saul" }, { id: "c", label: "Jonathan" }, { id: "d", label: "Gideon" }], correctAnswer: "a", category: "people", difficulty: "easy", explanation: "David trusted God and defeated Goliath with a sling and a stone.", reference: { book: "1 Samuel", chapter: 17, verse: "49-50" }, source: "Bible Arena verified seed bank", status: "verified" },
  { id: "bq-005", type: "multiple_choice", prompt: "Where are the Ten Commandments first recorded as being given to Moses?", options: [{ id: "a", label: "Mount Carmel" }, { id: "b", label: "Mount Sinai" }, { id: "c", label: "Mount of Olives" }, { id: "d", label: "Mount Tabor" }], correctAnswer: "b", category: "places", difficulty: "medium", explanation: "The covenant commands were given to Moses at Mount Sinai.", reference: { book: "Exodus", chapter: 20, verse: "1-17" }, source: "Bible Arena verified seed bank", status: "verified" },
  { id: "bq-006", type: "multiple_choice", prompt: "Who stayed with Naomi and became part of the family line of David?", options: [{ id: "a", label: "Esther" }, { id: "b", label: "Ruth" }, { id: "c", label: "Hannah" }, { id: "d", label: "Miriam" }], correctAnswer: "b", category: "people", difficulty: "easy", explanation: "Ruth faithfully stayed with Naomi and later married Boaz.", reference: { book: "Ruth", chapter: 1, verse: "16-17" }, source: "Bible Arena verified seed bank", status: "verified" },
  { id: "bq-007", type: "multiple_choice", prompt: "What was Jesus' first recorded sign in the Gospel of John?", options: [{ id: "a", label: "Healing a blind man" }, { id: "b", label: "Walking on water" }, { id: "c", label: "Turning water into wine" }, { id: "d", label: "Feeding five thousand" }], correctAnswer: "c", category: "events", difficulty: "medium", explanation: "At Cana, Jesus turned water into wine, revealing his glory to his disciples.", reference: { book: "John", chapter: 2, verse: "7-11" }, source: "Bible Arena verified seed bank", status: "verified" },
  { id: "bq-008", type: "multiple_choice", prompt: "Which apostle was also known as Saul before his conversion?", options: [{ id: "a", label: "Peter" }, { id: "b", label: "Paul" }, { id: "c", label: "Barnabas" }, { id: "d", label: "Silas" }], correctAnswer: "b", category: "people", difficulty: "medium", explanation: "Saul encountered Jesus on the road to Damascus and became known as Paul in his missionary ministry.", reference: { book: "Acts", chapter: 9, verse: "1-19" }, source: "Bible Arena verified seed bank", status: "verified" },
  { id: "bq-009", type: "multiple_choice", prompt: "Which prophet was sent to Nineveh and was swallowed by a great fish?", options: [{ id: "a", label: "Jonah" }, { id: "b", label: "Amos" }, { id: "c", label: "Elijah" }, { id: "d", label: "Micah" }], correctAnswer: "a", category: "people", difficulty: "easy", explanation: "Jonah was sent to Nineveh and spent three days and nights in the great fish.", reference: { book: "Jonah", chapter: 1, verse: "17" }, source: "Bible Arena verified seed bank", status: "verified" },
  { id: "bq-010", type: "multiple_choice", prompt: "Where does Jesus teach the Beatitudes?", options: [{ id: "a", label: "The Sermon on the Mount" }, { id: "b", label: "The Upper Room" }, { id: "c", label: "The Temple courts" }, { id: "d", label: "The Garden of Gethsemane" }], correctAnswer: "a", category: "teachings", difficulty: "medium", explanation: "Matthew records the Beatitudes at the beginning of Jesus' Sermon on the Mount.", reference: { book: "Matthew", chapter: 5, verse: "1-12" }, source: "Bible Arena verified seed bank", status: "verified" },
];

export const VERIFIED_BIBLE_OR_MYTH_QUESTIONS: BibleQuestion[] = [
  { id: "bm-001", type: "true_false", prompt: "The Bible says that Adam and Eve ate an apple in the Garden of Eden.", options: [{ id: "bible", label: "Bible" }, { id: "myth", label: "Myth" }], correctAnswer: "myth", category: "events", difficulty: "easy", explanation: "Genesis names the tree and its fruit but does not identify the fruit as an apple.", reference: { book: "Genesis", chapter: 3, verse: "6" }, source: "Bible Arena verified seed bank", status: "verified" },
  { id: "bm-002", type: "true_false", prompt: "The Bible says that Noah took two of every kind of clean animal onto the ark.", options: [{ id: "bible", label: "Bible" }, { id: "myth", label: "Myth" }], correctAnswer: "myth", category: "events", difficulty: "medium", explanation: "Genesis distinguishes between clean animals, taken in greater numbers, and other animals, taken in pairs.", reference: { book: "Genesis", chapter: 7, verse: "2-3" }, source: "Bible Arena verified seed bank", status: "verified" },
  { id: "bm-003", type: "true_false", prompt: "The Bible says that Jesus fed five thousand men with five loaves and two fish.", options: [{ id: "bible", label: "Bible" }, { id: "myth", label: "Myth" }], correctAnswer: "bible", category: "events", difficulty: "easy", explanation: "The feeding of the five thousand is recorded with five loaves and two fish.", reference: { book: "Matthew", chapter: 14, verse: "17-21" }, source: "Bible Arena verified seed bank", status: "verified" },
  { id: "bm-004", type: "true_false", prompt: "The Bible names the three wise men who visited Jesus.", options: [{ id: "bible", label: "Bible" }, { id: "myth", label: "Myth" }], correctAnswer: "myth", category: "people", difficulty: "medium", explanation: "Matthew records wise men from the east but does not give their number or names.", reference: { book: "Matthew", chapter: 2, verse: "1-12" }, source: "Bible Arena verified seed bank", status: "verified" },
  { id: "bm-005", type: "true_false", prompt: "The Bible says that David used a sling and a stone against Goliath.", options: [{ id: "bible", label: "Bible" }, { id: "myth", label: "Myth" }], correctAnswer: "bible", category: "events", difficulty: "easy", explanation: "David selected five smooth stones and defeated Goliath with a sling and a stone.", reference: { book: "1 Samuel", chapter: 17, verse: "40,49-50" }, source: "Bible Arena verified seed bank", status: "verified" },
];

export const VERIFIED_WORD_PUZZLE_QUESTIONS: BibleQuestion[] = [
  { id: "wp-001", type: "unscramble", prompt: "Unscramble this Bible-related word: H A N O J", options: [], correctAnswer: "jonah", category: "people", difficulty: "easy", explanation: "Jonah was the prophet sent to Nineveh.", reference: { book: "Jonah", chapter: 1, verse: "1-2" }, source: "Bible Arena verified seed bank", status: "verified" },
  { id: "wp-002", type: "unscramble", prompt: "Unscramble this Bible-related word: H T U R", options: [], correctAnswer: "ruth", category: "people", difficulty: "easy", explanation: "Ruth remained faithful to Naomi and became part of David's family line.", reference: { book: "Ruth", chapter: 1, verse: "16-17" }, source: "Bible Arena verified seed bank", status: "verified" },
  { id: "wp-003", type: "unscramble", prompt: "Unscramble this Bible-related word: S U S E J", options: [], correctAnswer: "jesus", category: "people", difficulty: "easy", explanation: "Jesus is the central person of the New Testament Gospels.", reference: { book: "Matthew", chapter: 1, verse: "21" }, source: "Bible Arena verified seed bank", status: "verified" },
  { id: "wp-004", type: "unscramble", prompt: "Unscramble this Bible-related word: C E A P E", options: [], correctAnswer: "peace", category: "teachings", difficulty: "medium", explanation: "Peace is repeatedly presented as a fruit of faithful living and reconciliation.", reference: { book: "Matthew", chapter: 5, verse: "9" }, source: "Bible Arena verified seed bank", status: "verified" },
  { id: "wp-005", type: "unscramble", prompt: "Unscramble this Bible-related word: E G R A C", options: [], correctAnswer: "grace", category: "teachings", difficulty: "medium", explanation: "Grace describes God's generous and undeserved favor.", reference: { book: "Ephesians", chapter: 2, verse: "8-9" }, source: "Bible Arena verified seed bank", status: "verified" },
];

export function getVerifiedQuestions(count = 10): BibleQuestion[] {
  const eligible = VERIFIED_BIBLE_QUIZ_QUESTIONS.filter(isCompetitiveQuestion);
  if (eligible.length < count) throw new Error("Not enough verified Bible Quiz questions for this session.");
  return eligible.slice(0, count);
}

export function getVerifiedQuestionsForMode(mode: GameMode, count: number): BibleQuestion[] {
  const source = mode === "bible_or_myth"
    ? VERIFIED_BIBLE_OR_MYTH_QUESTIONS
    : mode === "word_puzzle"
      ? VERIFIED_WORD_PUZZLE_QUESTIONS
      : VERIFIED_BIBLE_QUIZ_QUESTIONS;
  const eligible = source.filter(isCompetitiveQuestion);
  if (eligible.length < count) throw new Error(`Not enough verified questions for ${mode}.`);
  if (mode !== "daily_challenge") return eligible.slice(0, count);

  const dayKey = new Date().toISOString().slice(0, 10);
  const offset = [...dayKey].reduce((total, character) => total + character.charCodeAt(0), 0) % eligible.length;
  return Array.from({ length: count }, (_, index) => eligible[(offset + index) % eligible.length]);
}
