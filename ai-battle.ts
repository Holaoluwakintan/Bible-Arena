import type { BibleQuestion } from "./questions";

export type AiDifficulty = "easy" | "medium" | "hard";

export interface AiDifficultyProfile {
  label: string;
  accuracy: number;
  averageResponseMs: number;
  responseVarianceMs: number;
}

export const AI_DIFFICULTIES: Record<AiDifficulty, AiDifficultyProfile> = {
  easy: { label: "Explorer", accuracy: 0.55, averageResponseMs: 13_000, responseVarianceMs: 1_500 },
  medium: { label: "Challenger", accuracy: 0.72, averageResponseMs: 9_000, responseVarianceMs: 1_000 },
  hard: { label: "Scholar", accuracy: 0.88, averageResponseMs: 6_000, responseVarianceMs: 700 },
};

export interface AiAnswer {
  answerId: string | null;
  isCorrect: boolean;
  responseMs: number;
}

function deterministicValue(seed: string): number {
  let value = 17;
  for (const character of seed) value = (value * 31 + character.charCodeAt(0)) % 10_000;
  return value / 10_000;
}

export function getAiAnswer(question: BibleQuestion, difficulty: AiDifficulty, questionIndex: number): AiAnswer {
  const profile = AI_DIFFICULTIES[difficulty];
  const seed = `${question.id}:${difficulty}:${questionIndex}`;
  const success = deterministicValue(seed) < profile.accuracy;
  const responseRatio = deterministicValue(`${seed}:speed`) - 0.5;
  const responseMs = Math.max(1_500, Math.round(profile.averageResponseMs + responseRatio * profile.responseVarianceMs));
  if (question.type === "unscramble") return { answerId: success ? question.correctAnswer : "incorrect", isCorrect: success, responseMs };
  if (success) return { answerId: question.correctAnswer, isCorrect: true, responseMs };
  const incorrect = question.options.find((option) => option.id !== question.correctAnswer)?.id ?? null;
  return { answerId: incorrect, isCorrect: false, responseMs };
}

export function simulateAiScore(questions: BibleQuestion[], difficulty: AiDifficulty): number {
  return questions.reduce((score, question, index) => {
    const answer = getAiAnswer(question, difficulty, index);
    return score + (answer.isCorrect ? 100 : 0);
  }, 0);
}
