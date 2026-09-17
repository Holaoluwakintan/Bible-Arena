# Bible Arena Game Engine

**Status:** Phase 3 — Game Engine  
**Version:** 0.1

## Purpose

The game engine is the shared runtime for Bible Arena modes. It keeps session state, answer validation, timing, scoring, progression, feedback, and result calculation separate from React components and persistence.

## Engine layers

| Layer | Responsibility | Implementation |
|---|---|---|
| Session | Creates a playable session and tracks current question | `createGameSession`, `getCurrentQuestion` |
| Answer | Validates the active question answer and advances progression | `submitAnswer` |
| Timer | Determines whether a response exceeded the configured window | `isTimedOut` |
| Scoring | Calculates base points and speed bonus | `calculatePoints` |
| Progression | Converts completed score into XP and accuracy | `calculateXp`, `calculateAccuracy` |
| Result | Produces a stable completed-session summary | `calculateResult` |

## Session behavior

A session begins in the `active` state when it is created with at least one question. Only the current question can be answered. A submitted question cannot be answered twice. The session becomes `complete` after the final question and records its completion timestamp. An unfinished session can be marked `abandoned`.

The engine is immutable at the public boundary. Each answer returns a new session and feedback object instead of mutating the original session. This makes UI state transitions predictable and makes replayable tests straightforward.

## Scoring rules

A correct answer earns the configured base points plus a speed bonus. The speed bonus decreases linearly from its maximum at zero milliseconds to zero at the configured time limit. An incorrect or timed-out answer earns zero points. A response at or beyond the time limit is timed out even when its answer identifier matches the canonical answer.

The initial default is 100 base points, up to 50 speed-bonus points, and a 20-second question window. These values are configuration, not hard-coded UI behavior. XP is calculated only for a completed session and is currently `50 + half of the final score`, rounded to a whole number.

## Security boundary

The current engine is a client-side foundation for local development. Before competitive release, answer validation and reward persistence must be repeated in a trusted server or database function. The client should receive question options without exposing the canonical answer and should submit an answer attempt rather than self-awarding points.

## Phase 3 acceptance criteria

Phase 3 is complete when the project has typed session and result contracts, reusable timer and scoring calculations, immutable answer progression, timeout behavior, completion and abandonment states, deterministic verification cases, and a documented boundary for server-side trust.

## Phase 4 handoff

The Bible Quiz interface can now request ten questions from the Phase 2 repository, create a session, render `getCurrentQuestion`, submit an answer, show returned feedback, and render `calculateResult` after completion. The UI should not reimplement scoring or answer progression.
