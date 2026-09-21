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
  {
    id: "wai-009",
    person: "Moses",
    clues: [
      "I was placed in a papyrus basket among the reeds of the Nile River as an infant.",
      "I saw a bush that burned with fire yet was not consumed on Mount Horeb.",
      "I stretched out my staff over the sea, and God parted the waters for Israel to pass through.",
    ],
    options: ["Moses", "Aaron", "Joshua", "Caleb"],
    explanation: "Moses was called by God at the burning bush to deliver Israel from Egyptian bondage and receive the Law at Sinai.",
    reference: { book: "Exodus", chapter: 2, verse: "3; 3:2; 14:21" },
  },
  {
    id: "wai-010",
    person: "David",
    clues: [
      "I was the youngest of eight brothers and tended sheep in the hills around Bethlehem.",
      "I played the lyre to soothe King Saul whenever an harmful spirit troubled him.",
      "I defeated a nine-foot Philistine champion with five smooth stones and a sling.",
    ],
    options: ["David", "Jonathan", "Solomon", "Saul"],
    explanation: "David, a man after God's own heart, rose from humble shepherd to Israel's greatest king and sweet psalmist.",
    reference: { book: "1 Samuel", chapter: 16, verse: "11,23; 17:40-50" },
  },
  {
    id: "wai-011",
    person: "Daniel",
    clues: [
      "I resolved not to defile myself with the royal food and wine while exiled in Babylon.",
      "I interpreted King Nebuchadnezzar's dream of a great statue made of four metals.",
      "I was lowered into a den of hungry lions because I would not cease praying to the living God.",
    ],
    options: ["Daniel", "Ezekiel", "Nehemiah", "Jeremiah"],
    explanation: "Daniel served faithfully in the royal courts of Babylon and Persia, steadfastly trusting God in the lion's den.",
    reference: { book: "Daniel", chapter: 1, verse: "8; 2:31-45; 6:16-22" },
  },
  {
    id: "wai-012",
    person: "Abraham",
    clues: [
      "God commanded me to leave my country, my people, and my father's household for a land he would show me.",
      "God made a covenant with me that my offspring would be as numerous as the stars in the night sky.",
      "I walked up Mount Moriah willing to offer my son Isaac until an angel called out to stop me.",
    ],
    options: ["Abraham", "Isaac", "Jacob", "Noah"],
    explanation: "Abraham is revered as the father of faith, trusting God's promises even when Sarah and he were advanced in years.",
    reference: { book: "Genesis", chapter: 12, verse: "1; 15:5; 22:10-12" },
  },
  {
    id: "wai-013",
    person: "Noah",
    clues: [
      "I was described as a righteous man, blameless among the people of my generation.",
      "I constructed a gigantic vessel of gopher wood according to precise heavenly dimensions.",
      "I sent out a raven and later a dove, which returned with an olive leaf in its beak.",
    ],
    options: ["Noah", "Enoch", "Methuselah", "Lot"],
    explanation: "Noah walked faithfully with God, built the ark to preserve humanity and animal life, and saw the rainbow covenant.",
    reference: { book: "Genesis", chapter: 6, verse: "9,14; 8:10-11" },
  },
  {
    id: "wai-014",
    person: "Jonah",
    clues: [
      "I boarded a ship sailing to Tarshish in an attempt to run away from the presence of the Lord.",
      "I told the terrified sailors to cast me into the raging sea so the storm would calm.",
      "I sat sulking under a leafy plant east of Nineveh after God spared the city.",
    ],
    options: ["Jonah", "Amos", "Micah", "Hosea"],
    explanation: "Jonah attempted to evade preaching repentance to Nineveh, was swallowed by a great fish, and witnessed God's sovereign mercy.",
    reference: { book: "Jonah", chapter: 1, verse: "3,12; 4:5-6" },
  },
  {
    id: "wai-015",
    person: "Mary",
    clues: [
      "The angel Gabriel greeted me, saying, 'Do not be afraid, you have found favor with God.'",
      "I visited my relative Elizabeth in the Judean hill country and sang the Magnificat.",
      "I wrapped my firstborn son in swaddling clothes and laid him in a manger in Bethlehem.",
    ],
    options: ["Mary", "Elizabeth", "Martha", "Anna"],
    explanation: "Mary humbly surrendered to God's will: 'Behold, I am the servant of the Lord; let it be to me according to your word.'",
    reference: { book: "Luke", chapter: 1, verse: "28-30,46-55; 2:7" },
  },
  {
    id: "wai-016",
    person: "Paul",
    clues: [
      "I was born in Tarsus and studied under the renowned rabbi Gamaliel in Jerusalem.",
      "A blinding celestial light knocked me to the ground on the road leading to Damascus.",
      "I was shipwrecked on the island of Malta and was unhurt when a viper bit my hand.",
    ],
    options: ["Paul", "Peter", "Barnabas", "Silas"],
    explanation: "Paul was transformed from a persecutor into Christ's apostle to the Gentiles, authoring 13 epistles in the New Testament.",
    reference: { book: "Acts", chapter: 9, verse: "3-6; 22:3; 28:3-5" },
  },
  {
    id: "wai-017",
    person: "Solomon",
    clues: [
      "When God appeared to me in a dream asking what I wanted, I asked for wisdom to govern his people.",
      "Two mothers came before me claiming the same living baby, and I proposed dividing the child in two.",
      "I wrote hundreds of proverbs and assembled cedar beams from Lebanon to build the holy Temple.",
    ],
    options: ["Solomon", "David", "Rehoboam", "Hezekiah"],
    explanation: "Solomon was renowned throughout the ancient world for God-given wisdom, magnificent wealth, and constructing the Temple in Jerusalem.",
    reference: { book: "1 Kings", chapter: 3, verse: "9,16-28; 5:5" },
  },
  {
    id: "wai-018",
    person: "Joshua",
    clues: [
      "I was one of only two spies who brought back an encouraging report after scouting Canaan.",
      "I took command of Israel's armies following the death of Moses on Mount Nebo.",
      "I declared to all the tribes: 'As for me and my house, we will serve the Lord.'",
    ],
    options: ["Joshua", "Caleb", "Gideon", "Barak"],
    explanation: "Joshua succeeded Moses, commanded the fall of Jericho, and led the conquest and inheritance division of the Promised Land.",
    reference: { book: "Numbers", chapter: 14, verse: "6-9; Joshua 1:1-2; 24:15" },
  },
  {
    id: "wai-019",
    person: "Samson",
    clues: [
      "An angel announced to my mother that no razor was ever to come upon my head.",
      "I posed a riddle to the Philistines: 'Out of the eater came something to eat; out of the strong came something sweet.'",
      "In my final moments, I pushed against two central pillars, destroying the temple of Dagon.",
    ],
    options: ["Samson", "Jephthah", "Gideon", "Saul"],
    explanation: "Samson was a Nazirite judge of immense physical power who judged Israel for twenty years and defeated thousands of Philistines.",
    reference: { book: "Judges", chapter: 13, verse: "5; 14:14; 16:29-30" },
  },
  {
    id: "wai-020",
    person: "Nehemiah",
    clues: [
      "I served as cupbearer to King Artaxerxes in the royal fortress of Susa.",
      "I wept when I heard that the wall of Jerusalem was broken down and its gates burned with fire.",
      "Under my leadership, the people worked with tools in one hand and weapons in the other to rebuild the wall in 52 days.",
    ],
    options: ["Nehemiah", "Ezra", "Zerubbabel", "Mordecai"],
    explanation: "Nehemiah was a godly leader of immense prayer and organizational courage who orchestrated the rebuilding of Jerusalem's ruined walls.",
    reference: { book: "Nehemiah", chapter: 1, verse: "3,11; 4:17; 6:15" },
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
