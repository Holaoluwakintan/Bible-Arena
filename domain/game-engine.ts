import type { BibleQuestion, GameMode } from "./questions";

export const DEFAULT_GAME_CONFIG = {
  responseWindowMs: 20_000,
  basePoints: 100,
  maxSpeedBonus: 50,
  completionXp: 50,
} as const;

export type SessionStatus = "active" | "complete" | "abandoned";

export interface AnswerAttempt {
  questionId: string;
  answerId: string | null;
  isCorrect: boolean;
  timedOut: boolean;
  responseMs: number;
  points: number;
}

export interface GameSession {
  id: string;
  mode: GameMode;
  questions: BibleQuestion[];
  currentIndex: number;
  answers: AnswerAttempt[];
  score: number;
  status: SessionStatus;
  startedAt: number;
  completedAt?: number;
}

export interface AnswerFeedback {
  questionId: string;
  isCorrect: boolean;
  timedOut: boolean;
  points: number;
  explanation: string;
  reference: string;
}

export interface AnswerReview {
  questionId: string;
  isCorrect: boolean;
  timedOut: boolean;
  points: number;
  answerLabel: string;
  correctAnswerLabel: string;
  explanation: string;
  reference: string;
}

export interface GameResult {
  sessionId: string;
  mode: GameMode;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  xpEarned: number;
  completedAt: number;
  answers?: Array<Pick<AnswerAttempt, "questionId" | "answerId">>;
  review?: AnswerReview[];
}

export function createGameSession(
  questions: BibleQuestion[],
  options: { id?: string; startedAt?: number; mode?: GameMode } = {},
): GameSession {
  if (questions.length === 0) throw new Error("A game session requires at least one question.");
  return {
    id: options.id ?? `session-${Date.now()}`,
    mode: options.mode ?? "bible_quiz",
    questions: questions.map((question) => ({ ...question, options: question.options.map((option) => ({ ...option })) })),
    currentIndex: 0,
    answers: [],
    score: 0,
    status: "active",
    startedAt: options.startedAt ?? Date.now(),
  };
}

export function getCurrentQuestion(session: GameSession): BibleQuestion | null {
  return session.status === "active" ? session.questions[session.currentIndex] ?? null : null;
}

export function isTimedOut(responseMs: number, responseWindowMs = DEFAULT_GAME_CONFIG.responseWindowMs): boolean {
  return responseMs >= responseWindowMs;
}

export function calculatePoints(isCorrect: boolean, responseMs: number, config = DEFAULT_GAME_CONFIG): number {
  if (!isCorrect || isTimedOut(responseMs, config.responseWindowMs)) return 0;
  const remainingRatio = Math.max(0, 1 - responseMs / config.responseWindowMs);
  return config.basePoints + Math.round(config.maxSpeedBonus * remainingRatio);
}

export function submitAnswer(
  session: GameSession,
  answerId: string | null,
  responseMs: number,
  config = DEFAULT_GAME_CONFIG,
): { session: GameSession; feedback: AnswerFeedback } {
  const question = getCurrentQuestion(session);
  if (!question) throw new Error("This session is not accepting answers.");
  if (session.answers.some((answer) => answer.questionId === question.id)) throw new Error("This question has already been answered.");

  const timedOut = isTimedOut(responseMs, config.responseWindowMs);
  const isCorrect = !timedOut && answerId === question.correctAnswer;
  const points = calculatePoints(isCorrect, responseMs, config);
  const answer: AnswerAttempt = { questionId: question.id, answerId, isCorrect, timedOut, responseMs, points };
  const isLastQuestion = session.currentIndex === session.questions.length - 1;
  const nextSession: GameSession = {
    ...session,
    currentIndex: isLastQuestion ? session.currentIndex : session.currentIndex + 1,
    answers: [...session.answers, answer],
    score: session.score + points,
    status: isLastQuestion ? "complete" : "active",
    completedAt: isLastQuestion ? Date.now() : undefined,
  };

  return {
    session: nextSession,
    feedback: {
      questionId: question.id,
      isCorrect,
      timedOut,
      points,
      explanation: question.explanation,
      reference: `${question.reference.book} ${question.reference.chapter}:${question.reference.verse ?? ""}`,
    },
  };
}

export function calculateAccuracy(session: GameSession): number {
  if (session.answers.length === 0) return 0;
  return Math.round((session.answers.filter((answer) => answer.isCorrect).length / session.answers.length) * 100);
}

export function calculateXp(session: GameSession): number {
  if (session.status !== "complete") return 0;
  return DEFAULT_GAME_CONFIG.completionXp + session.answers.filter((answer) => answer.isCorrect).length * 100;
}

export function calculateResult(session: GameSession): GameResult {
  if (session.status !== "complete" || !session.completedAt) throw new Error("Only completed sessions have results.");
  return {
    sessionId: session.id,
    mode: session.mode,
    score: session.score,
    totalQuestions: session.questions.length,
    correctAnswers: session.answers.filter((answer) => answer.isCorrect).length,
    accuracy: calculateAccuracy(session),
    xpEarned: calculateXp(session),
    completedAt: session.completedAt,
    answers: session.answers.map(({ questionId, answerId }) => ({ questionId, answerId })),
    review: session.answers.map((answer) => {
      const question = session.questions.find((item) => item.id === answer.questionId);
      const answerLabel = question?.options.find((option) => option.id === answer.answerId)?.label ?? (answer.timedOut ? "Time expired" : "No answer");
      const correctAnswerLabel = question?.options.find((option) => option.id === question.correctAnswer)?.label ?? question?.correctAnswer ?? "See the explanation";
      return {
        questionId: answer.questionId,
        isCorrect: answer.isCorrect,
        timedOut: answer.timedOut,
        points: answer.points,
        answerLabel,
        correctAnswerLabel,
        explanation: question?.explanation ?? "Review the verified question explanation.",
        reference: question ? `${question.reference.book} ${question.reference.chapter}:${question.reference.verse ?? ""}` : "Scripture reference unavailable",
      };
    }),
  };
}
