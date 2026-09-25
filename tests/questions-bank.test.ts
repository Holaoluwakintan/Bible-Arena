import { describe, expect, it } from "vitest";
import {
  VERIFIED_BIBLE_QUIZ_QUESTIONS,
  VERIFIED_BIBLE_OR_MYTH_QUESTIONS,
  VERIFIED_WORD_PUZZLE_QUESTIONS,
  isCompetitiveQuestion,
  validateQuestion,
} from "../domain/questions";
import { VERIFIED_WHO_AM_I_QUESTIONS } from "../domain/who-am-i";

describe("Expanded Question Bank Integrity", () => {
  it("contains at least 50 verified Bible Quiz questions", () => {
    expect(VERIFIED_BIBLE_QUIZ_QUESTIONS.length).toBeGreaterThanOrEqual(50);
    expect(VERIFIED_BIBLE_QUIZ_QUESTIONS.every(isCompetitiveQuestion)).toBe(true);
    const ids = new Set(VERIFIED_BIBLE_QUIZ_QUESTIONS.map((q) => q.id));
    expect(ids.size).toBe(VERIFIED_BIBLE_QUIZ_QUESTIONS.length);
  });

  it("contains at least 20 verified Bible or Myth statements", () => {
    expect(VERIFIED_BIBLE_OR_MYTH_QUESTIONS.length).toBeGreaterThanOrEqual(20);
    expect(VERIFIED_BIBLE_OR_MYTH_QUESTIONS.every(isCompetitiveQuestion)).toBe(true);
    const ids = new Set(VERIFIED_BIBLE_OR_MYTH_QUESTIONS.map((q) => q.id));
    expect(ids.size).toBe(VERIFIED_BIBLE_OR_MYTH_QUESTIONS.length);
  });

  it("contains at least 20 verified Word Puzzle challenges", () => {
    expect(VERIFIED_WORD_PUZZLE_QUESTIONS.length).toBeGreaterThanOrEqual(20);
    expect(VERIFIED_WORD_PUZZLE_QUESTIONS.every(isCompetitiveQuestion)).toBe(true);
    const ids = new Set(VERIFIED_WORD_PUZZLE_QUESTIONS.map((q) => q.id));
    expect(ids.size).toBe(VERIFIED_WORD_PUZZLE_QUESTIONS.length);
  });

  it("contains at least 20 verified Who Am I figures", () => {
    expect(VERIFIED_WHO_AM_I_QUESTIONS.length).toBeGreaterThanOrEqual(20);
    for (const item of VERIFIED_WHO_AM_I_QUESTIONS) {
      expect(item.id).toBeTruthy();
      expect(item.person).toBeTruthy();
      expect(item.clues).toHaveLength(3);
      expect(item.options).toHaveLength(4);
      expect(item.options).toContain(item.person);
      expect(item.explanation).toBeTruthy();
    }
    const ids = new Set(VERIFIED_WHO_AM_I_QUESTIONS.map((q) => q.id));
    expect(ids.size).toBe(VERIFIED_WHO_AM_I_QUESTIONS.length);
  });
});
