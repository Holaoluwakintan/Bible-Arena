# Bible Arena Phase 5 — Progression, History, and Bible or Myth

**Status:** Complete

## Progression

The app now has a local progression boundary backed by AsyncStorage. Completed sessions produce idempotent reward events, total XP, level calculations, current streak, best streak, and last eligible calendar date.

The initial level thresholds and titles are centralized in `domain/progression.ts`. A completed session awards 50 completion XP plus 100 XP for each correct answer. Recording the same session again does not create duplicate rewards or duplicate history entries.

Streaks use the device's local calendar date. Completing multiple sessions on one date preserves the current streak. Completing an eligible session on the next consecutive date increments the streak. A later non-consecutive date starts a new streak at one.

## Local history

`domain/local-storage.ts` defines the durable local record format. It stores a compact progression snapshot and up to twenty recent completed-session records. The shared `ProgressionProvider` loads the data at app startup and exposes `recordSession` to gameplay screens.

The Profile screen now shows total XP, level name, XP until the next level, current and best streaks, total session count, and recent Bible Quiz or Bible or Myth results.

This is intentionally a local guest boundary. Production account sync should replace or extend the storage adapter without moving persistence logic into the screen components.

## Bible or Myth

Bible or Myth reuses the same question contract and game engine as Bible Quiz. Its verified seed bank contains five true/false statements with a Bible or Myth response pair, explanation, and Scripture reference. The mode is available from Play and is passed through the shared `/quiz` route as a mode parameter.

The shared engine still owns session progression, timing, canonical answer validation, scoring, feedback, and results. The screen changes only its content source and mode label.

## Verification

The milestone has been verified with:

- Progression tests for level thresholds, idempotent rewards, and streak transitions.
- Existing question-system and game-engine tests.
- Full TypeScript compilation.
- Expo static export with Home, Play, Profile, Settings, and Quiz routes.
- Metro restart with no TypeScript or LSP errors.

## Next handoff

The next milestone can add Daily Challenge and Word Puzzle modes using the same provider, question contract, and game engine. Achievement unlocking should consume reward events rather than inspect UI state.
