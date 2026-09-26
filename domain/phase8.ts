import type { SessionHistoryEntry } from "./local-storage";
import {
  VERIFIED_BIBLE_OR_MYTH_QUESTIONS,
  VERIFIED_BIBLE_QUIZ_QUESTIONS,
  VERIFIED_WORD_PUZZLE_QUESTIONS,
  type BibleQuestion,
  type Difficulty,
  type GameMode,
} from "./questions";
import { getVerifiedQuestionsForMode } from "./questions";

export type ContentPackId = "people-and-places" | "teachings-and-wisdom" | "new-testament" | "gospels-and-acts" | "psalms-and-wisdom" | "old-testament-heroes";

export interface ContentPack {
  id: ContentPackId;
  title: string;
  subtitle: string;
  categories: BibleQuestion["category"][];
  tradition: "cross-tradition";
  translation: "reference-led";
  reviewStatus: "verified";
  editorialNote: string;
}

export const CONTENT_PACKS: ContentPack[] = [
  { id: "people-and-places", title: "People & Places", subtitle: "Meet the people and places behind the story.", categories: ["people", "places"], tradition: "cross-tradition", translation: "reference-led", reviewStatus: "verified", editorialNote: "Reviewed seed pack focused on biblical people and settings." },
  { id: "teachings-and-wisdom", title: "Teachings & Wisdom", subtitle: "Practice parables, principles, and wise living.", categories: ["teachings", "books"], tradition: "cross-tradition", translation: "reference-led", reviewStatus: "verified", editorialNote: "Reviewed seed pack focused on teachings and wisdom literature." },
  { id: "new-testament", title: "New Testament", subtitle: "Focus on the Gospels and the early church.", categories: ["people", "places", "events", "teachings"], tradition: "cross-tradition", translation: "reference-led", reviewStatus: "verified", editorialNote: "Reviewed seed pack spanning Gospel and early-church questions." },
  { id: "gospels-and-acts", title: "Gospels & Acts", subtitle: "Follow Jesus and the early church.", categories: ["people", "places", "events", "teachings"], tradition: "cross-tradition", translation: "reference-led", reviewStatus: "verified", editorialNote: "Reference-led seed selection; expand with editorially reviewed questions." },
  { id: "psalms-and-wisdom", title: "Psalms & Wisdom", subtitle: "Reflect on prayer, poetry, and wise living.", categories: ["teachings", "books"], tradition: "cross-tradition", translation: "reference-led", reviewStatus: "verified", editorialNote: "Reference-led seed selection; editorial expansion planned." },
  { id: "old-testament-heroes", title: "Old Testament Heroes", subtitle: "Study courage, faith, and leadership.", categories: ["people", "places", "events"], tradition: "cross-tradition", translation: "reference-led", reviewStatus: "verified", editorialNote: "Reference-led seed selection; editorial expansion planned." },
];

const ALL_QUESTIONS = [
  ...VERIFIED_BIBLE_QUIZ_QUESTIONS,
  ...VERIFIED_BIBLE_OR_MYTH_QUESTIONS,
  ...VERIFIED_WORD_PUZZLE_QUESTIONS,
];

export function getAdaptiveDifficulty(sessions: Array<Pick<SessionHistoryEntry, "accuracy">>): Difficulty {
  const recent = sessions.slice(-5);
  if (recent.length < 2) return "easy";
  const average = recent.reduce((total, session) => total + session.accuracy, 0) / recent.length;
  return average >= 85 ? "hard" : average >= 65 ? "medium" : "easy";
}

export function getDailyHabitSnapshot(sessions: Array<Pick<SessionHistoryEntry, "completedAt">>, now = Date.now()) {
  const keys = new Set(sessions.map((session) => new Date(session.completedAt).toLocaleDateString("en-CA")));
  const today = new Date(now).toLocaleDateString("en-CA");
  const yesterday = new Date(now - 86_400_000).toLocaleDateString("en-CA");
  let streak = 0;
  let cursor = keys.has(today) ? now : keys.has(yesterday) ? now - 86_400_000 : 0;
  while (cursor && keys.has(new Date(cursor).toLocaleDateString("en-CA"))) {
    streak += 1;
    cursor -= 86_400_000;
  }
  return { completedToday: keys.has(today), streak, daysActive: keys.size };
}

export function getQuestionsForPack(packId: ContentPackId, count = 5): BibleQuestion[] {
  const pack = CONTENT_PACKS.find((item) => item.id === packId);
  if (!pack) return [];
  const questions = ALL_QUESTIONS.filter((question) => pack.reviewStatus === "verified" && pack.categories.includes(question.category) && question.status === "verified");
  return questions.slice(0, count);
}

export function getAdaptiveQuestionsForMode(mode: GameMode, count: number, sessions: Array<Pick<SessionHistoryEntry, "accuracy">>): BibleQuestion[] {
  const questions = getVerifiedQuestionsForMode(mode, Math.max(count, 10), true);
  if (mode === "daily_challenge") return questions.slice(0, count);
  const target = getAdaptiveDifficulty(sessions);
  const preferred = questions.filter((question) => question.difficulty === target);
  const fallback = questions.filter((question) => question.difficulty !== target);
  return [...preferred, ...fallback].slice(0, count);
}

export interface LearningAnalytics {
  sessions: number;
  averageAccuracy: number;
  questionsAnswered: number;
  strongestMode: string | null;
  weakestCategory: BibleQuestion["category"] | null;
  categoryAccuracy: Array<{ category: BibleQuestion["category"]; accuracy: number; answered: number }>;
}

export function buildLearningAnalytics(sessions: SessionHistoryEntry[]): LearningAnalytics {
  const byMode = new Map<string, { total: number; sessions: number }>();
  const byCategory = new Map<BibleQuestion["category"], { correct: number; total: number }>();
  for (const session of sessions) {
    const mode = byMode.get(session.mode) ?? { total: 0, sessions: 0 };
    mode.total += session.accuracy;
    mode.sessions += 1;
    byMode.set(session.mode, mode);
    for (const answer of session.answers ?? []) {
      const question = ALL_QUESTIONS.find((item) => item.id === answer.questionId);
      if (!question) continue;
      const category = byCategory.get(question.category) ?? { correct: 0, total: 0 };
      category.total += 1;
      if (answer.answerId === question.correctAnswer) category.correct += 1;
      byCategory.set(question.category, category);
    }
  }
  const modeEntries = [...byMode.entries()].sort((a, b) => b[1].total / b[1].sessions - a[1].total / a[1].sessions);
  const categoryAccuracy = [...byCategory.entries()].map(([category, value]) => ({ category, answered: value.total, accuracy: Math.round((value.correct / value.total) * 100) })).sort((a, b) => a.accuracy - b.accuracy);
  return {
    sessions: sessions.length,
    averageAccuracy: sessions.length ? Math.round(sessions.reduce((total, session) => total + session.accuracy, 0) / sessions.length) : 0,
    questionsAnswered: sessions.reduce((total, session) => total + session.totalQuestions, 0),
    strongestMode: modeEntries[0]?.[0] ?? null,
    weakestCategory: categoryAccuracy[0]?.category ?? null,
    categoryAccuracy,
  };
}
