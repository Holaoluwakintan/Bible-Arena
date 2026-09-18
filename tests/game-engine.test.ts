import { describe, expect, it } from "vitest";

import {
  calculateAccuracy,
  calculatePoints,
  calculateResult,
  createGameSession,
  getCurrentQuestion,
  isTimedOut,
  submitAnswer,
} from "../domain/game-engine";
import { getVerifiedQuestions, getVerifiedQuestionsForMode, isCompetitiveQuestion, validateQuestion } from "../domain/questions";

describe("Bible Arena question system", () => {
  it("returns a complete verified ten-question competitive set", () => {
    const questions = getVerifiedQuestions(10);
    expect(questions).toHaveLength(10);
    expect(questions.every(isCompetitiveQuestion)).toBe(true);
    expect(new Set(questions.map((question) => question.id)).size).toBe(10);
  });

  it("rejects a verified multiple-choice question with a missing canonical option", () => {
    const question = { ...getVerifiedQuestions(1)[0], correctAnswer: "missing" };
    expect(validateQuestion(question)).toContain("Correct answer must match an option id.");
    expect(isCompetitiveQuestion(question)).toBe(false);
  });

  it("selects verified Word Puzzle and Daily Challenge sets", () => {
    expect(getVerifiedQuestionsForMode("word_puzzle", 5).every(isCompetitiveQuestion)).toBe(true);
    expect(getVerifiedQuestionsForMode("daily_challenge", 5)).toHaveLength(5);
  });
});

describe("Bible Arena game engine", () => {
  it("creates a session and advances immutable state after an answer", () => {
    const questions = getVerifiedQuestions(2);
    const session = createGameSession(questions, { id: "test-session", startedAt: 100 });
    const result = submitAnswer(session, questions[0].correctAnswer, 1_000);

    expect(session.currentIndex).toBe(0);
    expect(result.session.currentIndex).toBe(1);
    expect(result.session.score).toBe(148);
    expect(result.feedback.isCorrect).toBe(true);
    expect(getCurrentQuestion(result.session)?.id).toBe(questions[1].id);
  });

  it("treats a response at the time limit as timed out", () => {
    expect(isTimedOut(20_000)).toBe(true);
    expect(calculatePoints(true, 20_000)).toBe(0);
  });

  it("calculates a completed result and XP", () => {
    const questions = getVerifiedQuestions(2);
    let session = createGameSession(questions, { id: "result-session", startedAt: 100 });
    session = submitAnswer(session, questions[0].correctAnswer, 1_000).session;
    session = submitAnswer(session, "wrong", 2_000).session;
    const result = calculateResult(session);

    expect(result.correctAnswers).toBe(1);
    expect(result.accuracy).toBe(50);
    expect(result.score).toBe(148);
    expect(result.xpEarned).toBe(150);
  });
});
