
import { ARENA_QUESTION_BANK } from "../domain/question-bank";
import { validateQuestion, getVerifiedQuestionById, ARENA_POOL } from "../domain/questions";
import { buildRound, EMPTY_ARENA_STATS, ARENA_CATEGORIES, getAllMastery, questionsInCategory, isAnswerCorrect, scoreAnswer, correctAnswerLabel } from "../domain/arena";
import { LEVEL_THRESHOLDS, getLevelProgress, applyCompletedSession, unlockAchievements } from "../domain/progression";
let bad = 0;
for (const q of ARENA_POOL) { const e = validateQuestion(q); if (e.length) { bad++; console.log(q.id, e); } }
console.log("pool", ARENA_POOL.length, "bank", ARENA_QUESTION_BANK.length, "invalid", bad);
for (const c of ARENA_CATEGORIES) console.log(c.id, questionsInCategory(c.id).length);
for (const kind of ["quick","category","survival","daily"] as const) {
  const r = buildRound({ kind, category: kind === "category" ? "places" : undefined, stats: EMPTY_ARENA_STATS });
  console.log(kind, r.length, r.map(q=>q.difficulty[0]).join(""), new Set(r.map(q=>q.id)).size === r.length);
}
const order = ARENA_QUESTION_BANK.find(q => q.type === "order_events")!;
console.log("order ok", isAnswerCorrect(order, order.correctAnswer), correctAnswerLabel(order), getVerifiedQuestionById("daily_challenge", order.id)?.id);
console.log("score", scoreAnswer(order, true, 5000, 6));
console.log(LEVEL_THRESHOLDS.slice(0,6), getLevelProgress(2000));
let snap: any = { totalXp: 0, currentStreak: 0, bestStreak: 0, lastEligibleDate: null, rewardEvents: [] };
snap = applyCompletedSession(snap, { sessionId: "a", mode: "bible_quiz", correctAnswers: 5, xpEarned: 0, completedAt: Date.now(), bonusXp: 60 });
snap = applyCompletedSession(snap, { sessionId: "b", mode: "daily_challenge", correctAnswers: 5, xpEarned: 0, completedAt: Date.now() });
console.log("xp", snap.totalXp, "streak", snap.currentStreak);
console.log(unlockAchievements([], { progression: snap as any, sessions: [{mode:"bible_quiz",accuracy:100}], arena: { roundsPlayed: 2, perfectRounds: 1, bestCombo: 6, survivalBest: 11, orderSolved: 0, dailyHistory: ["x"] } }, 1).map(a=>a.key).join(","));
