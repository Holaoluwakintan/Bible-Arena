import { getVerifiedQuestionById, type GameMode } from "../domain/questions";
import { calculatePoints } from "../domain/game-engine";
import { getDb } from "./db";

export type SubmittedAnswer = { questionId: string; answerId: string | null };

export function recordAuthoritativeSession(input: {
  userId: number;
  id: string;
  mode: GameMode;
  answers: SubmittedAnswer[];
}) {
  if (input.answers.length < 1 || input.answers.length > 20) throw new Error("Invalid answer count.");
  const uniqueIds = new Set(input.answers.map((answer) => answer.questionId));
  if (uniqueIds.size !== input.answers.length) throw new Error("Duplicate question answers are not allowed.");

  let correctAnswers = 0;
  for (const answer of input.answers) {
    const question = getVerifiedQuestionById(input.mode, answer.questionId);
    if (!question) throw new Error("Question does not belong to a verified server question bank.");
    if (answer.answerId === question.correctAnswer) correctAnswers += 1;
  }

  const totalQuestions = input.answers.length;
  const score = correctAnswers * calculatePoints(true, 0);
  const accuracy = Math.round((correctAnswers / totalQuestions) * 100);
  const xpEarned = 50 + correctAnswers * 100;
  const completedAt = Math.floor(Date.now() / 1000);
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const insert = db.prepare(`
      INSERT OR IGNORE INTO session_records
        (id, userId, mode, score, accuracy, correctAnswers, totalQuestions, xpEarned, completedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(input.id, input.userId, input.mode, score, accuracy, correctAnswers, totalQuestions, xpEarned, completedAt);

    if (insert.changes === 0) {
      const existing = db.prepare("SELECT * FROM session_records WHERE id = ? AND userId = ?").get(input.id, input.userId);
      if (!existing) throw new Error("Session already belongs to another user.");
      db.exec("COMMIT");
      return existing;
    }

    const current = db.prepare("SELECT totalXp, currentStreak, bestStreak, lastEligibleDate, achievementsJson FROM player_progress WHERE userId = ?").get(input.userId) as any;
    const nextXp = Number(current?.totalXp ?? 0) + xpEarned;
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const nextStreak = current?.lastEligibleDate === today ? Number(current.currentStreak) : current?.lastEligibleDate === yesterday ? Number(current.currentStreak) + 1 : 1;
    const bestStreak = Math.max(Number(current?.bestStreak ?? 0), nextStreak);
    const achievementsJson = current?.achievementsJson ?? "[]";
    db.prepare(`
      INSERT INTO player_progress (userId, totalXp, currentStreak, bestStreak, lastEligibleDate, achievementsJson, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(userId) DO UPDATE SET
        totalXp = excluded.totalXp, currentStreak = excluded.currentStreak,
        bestStreak = excluded.bestStreak, lastEligibleDate = excluded.lastEligibleDate,
        updatedAt = excluded.updatedAt
    `).run(input.userId, nextXp, nextStreak, bestStreak, today, achievementsJson, completedAt);
    db.exec("COMMIT");
    return { id: input.id, userId: input.userId, mode: input.mode, score, accuracy, correctAnswers, totalQuestions, xpEarned, completedAt };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
