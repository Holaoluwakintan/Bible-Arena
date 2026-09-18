import { describe, expect, it } from "vitest";
import {
  calculateWhoAmIPoints,
  calculateWhoAmIResult,
  createWhoAmISession,
  revealNextClue,
  submitWhoAmIGuess,
  VERIFIED_WHO_AM_I_QUESTIONS,
  WHO_AM_I_SCORING,
} from "../domain/who-am-i";

describe("Who Am I? Game Domain", () => {
  it("awards points correctly according to clues revealed", () => {
    expect(calculateWhoAmIPoints(1, true)).toBe(300);
    expect(calculateWhoAmIPoints(2, true)).toBe(200);
    expect(calculateWhoAmIPoints(3, true)).toBe(100);
    expect(calculateWhoAmIPoints(1, false)).toBe(0);
    expect(calculateWhoAmIPoints(2, false)).toBe(0);
    expect(calculateWhoAmIPoints(3, false)).toBe(0);
  });

  it("reveals up to three clues per question and caps at 3", () => {
    let session = createWhoAmISession();
    expect(session.cluesRevealed).toBe(1);

    session = revealNextClue(session);
    expect(session.cluesRevealed).toBe(2);

    session = revealNextClue(session);
    expect(session.cluesRevealed).toBe(3);

    // Should not exceed 3
    session = revealNextClue(session);
    expect(session.cluesRevealed).toBe(3);
  });

  it("validates that all verified seed questions have 3 non-empty clues and 4 options containing the person", () => {
    expect(VERIFIED_WHO_AM_I_QUESTIONS.length).toBeGreaterThanOrEqual(5);

    for (const question of VERIFIED_WHO_AM_I_QUESTIONS) {
      expect(question.id).toBeTruthy();
      expect(question.person).toBeTruthy();
      expect(question.clues.length).toBe(3);
      for (const clue of question.clues) {
        expect(clue.trim().length).toBeGreaterThan(10);
      }
      expect(question.options.length).toBe(4);
      expect(question.options).toContain(question.person);
      expect(question.reference.book).toBeTruthy();
      expect(question.reference.chapter).toBeGreaterThan(0);
      expect(question.explanation.trim().length).toBeGreaterThan(15);
    }
  });

  it("plays through a full 5-question session and calculates result", () => {
    const questions = VERIFIED_WHO_AM_I_QUESTIONS.slice(0, 3);
    let session = createWhoAmISession(questions);
    expect(session.status).toBe("active");

    // Question 1: Guess correctly on Clue 1 (300 pts)
    const q1 = questions[0];
    const res1 = submitWhoAmIGuess(session, q1.person);
    session = res1.session;
    expect(res1.feedback.isCorrect).toBe(true);
    expect(res1.feedback.points).toBe(300);
    expect(session.score).toBe(300);
    expect(session.currentIndex).toBe(1);
    expect(session.cluesRevealed).toBe(1); // resets for next question

    // Question 2: Reveal Clue 2 then guess correctly (200 pts)
    session = revealNextClue(session);
    expect(session.cluesRevealed).toBe(2);
    const q2 = questions[1];
    const res2 = submitWhoAmIGuess(session, q2.person);
    session = res2.session;
    expect(res2.feedback.isCorrect).toBe(true);
    expect(res2.feedback.points).toBe(200);
    expect(session.score).toBe(500);
    expect(session.currentIndex).toBe(2);

    // Question 3: Guess incorrectly (0 pts)
    const res3 = submitWhoAmIGuess(session, "Wrong Person");
    session = res3.session;
    expect(res3.feedback.isCorrect).toBe(false);
    expect(res3.feedback.points).toBe(0);
    expect(session.score).toBe(500);
    expect(session.status).toBe("complete");

    // Result calculation
    const result = calculateWhoAmIResult(session);
    expect(result.score).toBe(500);
    expect(result.totalQuestions).toBe(3);
    expect(result.correctAnswers).toBe(2);
    expect(result.accuracy).toBe(67);
    // 50 completion + 2 * 100
    expect(result.xpEarned).toBe(WHO_AM_I_SCORING.completionXp + 2 * WHO_AM_I_SCORING.correctXp);
  });
});
