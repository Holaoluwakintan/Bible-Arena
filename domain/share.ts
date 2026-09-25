export interface ShareResultOptions {
  modeName: string;
  score: number;
  accuracy: number;
  streak?: number;
  level?: number;
  customQuote?: string;
  challengeCode?: string;
  learningNote?: string;
}

export const INSPIRATIONAL_VERSES = [
  "\"Your word is a lamp to my feet and a light to my path.\" — Psalm 119:105",
  "\"I have hidden your word in my heart that I might not sin against you.\" — Psalm 119:11",
  "\"The grass withers, the flower fades, but the word of our God will stand forever.\" — Isaiah 40:8",
  "\"For the word of God is alive and active, sharper than any double-edged sword.\" — Hebrews 4:12",
  "\"All Scripture is God-breathed and useful for teaching, rebuking, and training.\" — 2 Timothy 3:16",
];

export function getInspirationalVerse(seed = 0): string {
  const index = Math.abs(seed) % INSPIRATIONAL_VERSES.length;
  return INSPIRATIONAL_VERSES[index];
}

export function generateShareMessage(options: ShareResultOptions): string {
  const { modeName, score, accuracy, streak, level, challengeCode, learningNote } = options;
  const quote = options.customQuote ?? getInspirationalVerse(score);

  const lines = [
    "⚔️ Bible Arena — Session Result ⚔️",
    `Mode: ${modeName}`,
    `Score: ${score.toLocaleString()} pts · Accuracy: ${accuracy}%`,
  ];

  if (streak !== undefined && streak > 0) {
    lines.push(`Streak: ${streak} Days 🔥`);
  }

  if (level !== undefined && level > 0) {
    lines.push(`Player Level: ${level} 🎖️`);
  }

  if (challengeCode) {
    lines.push(`Challenge Code: ${challengeCode}`);
  }

  if (learningNote) lines.push(`Learning takeaway: ${learningNote}`);

  lines.push("");
  lines.push(quote);
  lines.push("");
  lines.push("Can you beat my score? Download & play Bible Arena:");
  lines.push("https://biblearena.app");

  return lines.join("\n");
}
