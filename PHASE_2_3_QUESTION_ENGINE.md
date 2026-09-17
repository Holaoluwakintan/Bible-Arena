# Bible Arena Phases 2–3 — Question System and Game Engine

**Status:** Complete

Phases 2 and 3 are now implemented together. Verified Bible question content feeds a reusable immutable game-session engine, and the Phase 1 Quick Play entry point opens a fully playable ten-question Bible Quiz.

## Question system

The question contract lives in `domain/questions.ts`. Every question includes a stable ID, content type, prompt, answer options, canonical answer, category, difficulty, explanation, Bible reference, source, and verification status.

Competitive eligibility is explicit. A question must be marked `verified` and must pass validation before it can enter a session. Multiple-choice questions require exactly four options, a canonical answer that matches an option ID, a non-empty explanation, a valid Bible reference, and a recorded source.

The current verified seed bank contains ten Bible Quiz questions covering people, places, events, and teachings. The seed bank is deterministic for development and is intentionally separated from the UI.

## Game engine

The reusable engine lives in `domain/game-engine.ts`. It provides:

- Session creation and immutable state transitions.
- Current-question lookup.
- Response-window timeout rules.
- Canonical answer validation.
- Base points and linear speed bonus scoring.
- Answer feedback with explanation and Bible reference.
- Completion and result calculation.
- Accuracy and XP calculation.

The default Bible Quiz configuration is a twenty-second response window, 100 base points, up to 50 speed-bonus points, and 50 completion XP. Responses at or beyond the time limit are timed out even when the answer is correct.

The engine remains a local development boundary. Before competitive release, answer validation, session integrity, and reward persistence must be repeated in a trusted server or database function.

## Playable flow

The `/quiz` route now supports:

1. Ten verified questions.
2. Visible progress and countdown timer.
3. Answer selection and submission.
4. Immediate explanation and Scripture reference.
5. Timeout handling.
6. Score and speed bonus feedback.
7. Accuracy, correct-answer count, and XP result summary.
8. Replay and return-to-home actions.

## Verification

The combined milestone has been verified with:

- Question eligibility and validation tests.
- Immutable session transition tests.
- Timeout scoring tests.
- Accuracy, score, and XP result tests.
- Full TypeScript compilation.
- Expo static export with the `/quiz` route generated.

## Next handoff

The next milestone should add durable local progression: account-scoped XP, levels, reward events, and streak rules. The current result object provides the stable boundary for recording completed-session progression without embedding progression logic inside the quiz screen.
