import type { BibleReference } from "./questions";

export interface WhoAmIQuestion {
  id: string;
  person: string;
  clues: [string, string, string]; // [Clue 1 (subtle), Clue 2 (moderate), Clue 3 (specific)]
  options: string[]; // 4 character names
  explanation: string;
  reference: BibleReference;
}

export const WHO_AM_I_SCORING = {
  clue1Points: 300,
  clue2Points: 200,
  clue3Points: 100,
  wrongPoints: 0,
  completionXp: 50,
  correctXp: 100,
} as const;

export function calculateWhoAmIPoints(cluesRevealed: number, isCorrect: boolean): number {
  if (!isCorrect) return WHO_AM_I_SCORING.wrongPoints;
  if (cluesRevealed <= 1) return WHO_AM_I_SCORING.clue1Points;
  if (cluesRevealed === 2) return WHO_AM_I_SCORING.clue2Points;
  return WHO_AM_I_SCORING.clue3Points;
}

export const VERIFIED_WHO_AM_I_QUESTIONS: WhoAmIQuestion[] = [
  {
    id: "wai-001",
    person: "Elijah",
    clues: [
      "Ravens brought me bread and meat by the brook Cherith during a severe drought.",
      "I challenged 450 prophets of Baal on Mount Carmel to see whose God answered by fire.",
      "I was taken up to heaven in a whirlwind with a chariot and horses of fire.",
    ],
    options: ["Elijah", "Elisha", "Jeremiah", "Samuel"],
    explanation: "Elijah was a prophet of Israel during the reign of Ahab. God used him to confront idolatry and miraculously took him up in a whirlwind.",
    reference: { book: "1 Kings", chapter: 17, verse: "4-6; 18:20-40; 2 Kings 2:11" },
  },
  {
    id: "wai-002",
    person: "Esther",
    clues: [
      "My Hebrew name was Hadassah, and I was raised by my older cousin after my parents died.",
      "I became queen of Persia after Queen Vashti was removed from the royal court.",
      "I risked my life by approaching the king unsummoned, saying, 'If I perish, I perish.'",
    ],
    options: ["Esther", "Ruth", "Abigail", "Deborah"],
    explanation: "Esther was an orphan raised by Mordecai who became Queen of Persia and was chosen 'for such a time as this' to deliver her people.",
    reference: { book: "Esther", chapter: 2, verse: "7,17; 4:14-16" },
  },
  {
    id: "wai-003",
    person: "Peter",
    clues: [
      "I was a fisherman on the Sea of Galilee before Jesus called me to catch people.",
      "I stepped out of a boat in the middle of a storm and briefly walked on water.",
      "I denied knowing Jesus three times before the rooster crowed, then wept bitterly.",
    ],
    options: ["Peter", "John", "Andrew", "James"],
    explanation: "Simon Peter was one of Jesus' closest apostles, known for bold declarations, walking on water, and later being restored to shepherd God's sheep.",
    reference: { book: "Matthew", chapter: 14, verse: "28-31; 26:69-75" },
  },
  {
    id: "wai-004",
    person: "Deborah",
    clues: [
      "I was a prophetess and the only female judge recorded as leading ancient Israel.",
      "I held court under a palm tree between Ramah and Bethel in the hill country of Ephraim.",
      "I summoned military commander Barak to lead 10,000 men against Sisera's iron chariots.",
    ],
    options: ["Deborah", "Miriam", "Huldah", "Priscilla"],
    explanation: "Deborah judged Israel with wisdom and courage, accompanying Barak to defeat Sisera's army at Mount Tabor.",
    reference: { book: "Judges", chapter: 4, verse: "4-14; 5:1-31" },
  },
  {
    id: "wai-005",
    person: "Joseph",
    clues: [
      "My father gave me an ornate, richly decorated robe that stirred deep jealousy in my brothers.",
      "I was sold into Egyptian slavery for twenty shekels of silver by Midianite traders.",
      "I interpreted Pharaoh's dreams of seven fat and seven lean cows, saving nations from famine.",
    ],
    options: ["Joseph", "Benjamin", "Daniel", "Nehemiah"],
    explanation: "Joseph was sold into slavery, falsely imprisoned, and elevated to second-in-command of Egypt, declaring 'God meant it for good.'",
    reference: { book: "Genesis", chapter: 37, verse: "3,28; 41:25-40; 50:20" },
  },
  {
    id: "wai-006",
    person: "Gideon",
    clues: [
      "An angel called me a 'mighty warrior' while I was secretly threshing wheat in a winepress.",
      "I placed a wool fleece on the threshing floor twice to seek confirmation of God's sign.",
      "With an army reduced to just 300 men holding trumpets and torches in clay jars, we defeated Midian.",
    ],
    options: ["Gideon", "Samson", "Jephthah", "Saul"],
    explanation: "Gideon led Israel to victory over the Midianites with only 300 men chosen by how they lapped water, blowing trumpets and shattering jars.",
    reference: { book: "Judges", chapter: 6, verse: "11-12,36-40; 7:7-22" },
  },
  {
    id: "wai-007",
    person: "Ruth",
    clues: [
      "I was born in the land of Moab but chose to leave my homeland behind.",
      "I said to my mother-in-law, 'Where you go I will go, and where you stay I will stay.'",
      "I gleaned grain in the fields of Boaz and became the great-grandmother of King David.",
    ],
    options: ["Ruth", "Orpah", "Rahab", "Sarah"],
    explanation: "Ruth's loyalty and devotion to Naomi led her to Bethlehem, where she married Boaz and entered the genealogical lineage of Jesus.",
    reference: { book: "Ruth", chapter: 1, verse: "16; 2:2-3; 4:17-22" },
  },
  {
    id: "wai-008",
    person: "John the Baptist",
    clues: [
      "I wore clothing made of camel's hair with a leather belt and ate locusts and wild honey.",
      "I preached in the wilderness of Judea, saying, 'Repent, for the kingdom of heaven has come near.'",
      "I baptized Jesus in the Jordan River and saw the Spirit of God descending like a dove.",
    ],
    options: ["John the Baptist", "Stephen", "Philip", "Barnabas"],
    explanation: "John the Baptist was the prophet foretold to prepare the way of the Lord, calling people to baptism and proclaiming the Lamb of God.",
    reference: { book: "Matthew", chapter: 3, verse: "1-4,13-17" },
  },
];

export interface WhoAmIRoundAttempt {
  questionId: string;
  selectedPerson: string;
  isCorrect: boolean;
  cluesRevealed: number;
  points: number;
}

export interface WhoAmISession {
  id: string;
  questions: WhoAmIQuestion[];
  currentIndex: number;
  cluesRevealed: number; // 1, 2, or 3 for current question
  attempts: WhoAmIRoundAttempt[];
  score: number;
  status: "active" | "complete";
  startedAt: number;
  completedAt?: number;
}

export interface WhoAmIResult {
  sessionId: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  xpEarned: number;
  completedAt: number;
}

export function createWhoAmISession(
  questions = VERIFIED_WHO_AM_I_QUESTIONS.slice(0, 5),
  id = `wai-${Date.now()}`,
): WhoAmISession {
  if (questions.length === 0) throw new Error("A Who Am I session requires at least one question.");
  return {
    id,
    questions,
    currentIndex: 0,
    cluesRevealed: 1,
    attempts: [],
    score: 0,
    status: "active",
    startedAt: Date.now(),
  };
}

export function revealNextClue(session: WhoAmISession): WhoAmISession {
  if (session.status !== "active") return session;
  if (session.cluesRevealed >= 3) return session;
  return {
    ...session,
    cluesRevealed: session.cluesRevealed + 1,
  };
}

export function submitWhoAmIGuess(
  session: WhoAmISession,
  selectedPerson: string,
): {
  session: WhoAmISession;
  feedback: {
    isCorrect: boolean;
    points: number;
    person: string;
    explanation: string;
    reference: string;
  };
} {
  if (session.status !== "active") throw new Error("Session is not active.");
  const currentQuestion = session.questions[session.currentIndex];
  if (!currentQuestion) throw new Error("No question available.");

  const isCorrect = selectedPerson.toLowerCase() === currentQuestion.person.toLowerCase();
  const points = calculateWhoAmIPoints(session.cluesRevealed, isCorrect);

  const attempt: WhoAmIRoundAttempt = {
    questionId: currentQuestion.id,
    selectedPerson,
    isCorrect,
    cluesRevealed: session.cluesRevealed,
    points,
  };

  const isLast = session.currentIndex === session.questions.length - 1;
  const nextSession: WhoAmISession = {
    ...session,
    attempts: [...session.attempts, attempt],
    score: session.score + points,
    currentIndex: isLast ? session.currentIndex : session.currentIndex + 1,
    cluesRevealed: 1, // Reset for next round
    status: isLast ? "complete" : "active",
    completedAt: isLast ? Date.now() : undefined,
  };

  return {
    session: nextSession,
    feedback: {
      isCorrect,
      points,
      person: currentQuestion.person,
      explanation: currentQuestion.explanation,
      reference: `${currentQuestion.reference.book} ${currentQuestion.reference.chapter}:${currentQuestion.reference.verse ?? ""}`,
    },
  };
}

export function calculateWhoAmIResult(session: WhoAmISession): WhoAmIResult {
  if (session.status !== "complete" || !session.completedAt) {
    throw new Error("Only completed sessions have results.");
  }
  const correctCount = session.attempts.filter((a) => a.isCorrect).length;
  const accuracy = Math.round((correctCount / session.questions.length) * 100);
  const xpEarned = WHO_AM_I_SCORING.completionXp + correctCount * WHO_AM_I_SCORING.correctXp;

  return {
    sessionId: session.id,
    score: session.score,
    totalQuestions: session.questions.length,
    correctAnswers: correctCount,
    accuracy,
    xpEarned,
    completedAt: session.completedAt,
  };
}
