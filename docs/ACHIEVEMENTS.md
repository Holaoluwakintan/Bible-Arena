# Bible Arena Achievements

**Status:** Phase 9 — Achievements and Badges  
**Version:** 0.1

## Achievement catalog

The initial catalog contains seven milestones: First Light for completing a first game, Daily Bread for completing a Daily Challenge, Discernment for completing Bible or Myth, Wordsmith for completing Word Puzzle, No Mistakes for a 100% session, On a Roll for reaching a three-day streak, and Rising Scholar for reaching 1,000 total XP.

Each definition has a stable identifier, display name, description, and icon key. UI components render definitions from the catalog rather than duplicating achievement copy.

## Unlock behavior

Achievement evaluation consumes a completed game result and the updated progression record. Mode-specific achievements use the result mode. Perfect-round uses result accuracy. Streak and XP milestones use progression state after the result is awarded.

Unlocks are idempotent. An already-unlocked identifier is never appended again, even if a result is replayed or a browser event is retried. Unlock timestamps are recorded for future detail views and analytics.

## Storage boundary

The prototype stores achievements in a versioned browser `localStorage` record. This lets the profile remain useful across reloads without introducing a database before the account phase. Competitive production should move unlock evaluation and persistence to a trusted server-side boundary with unique constraints.

## Profile behavior

The Profile screen now displays the player’s level card, XP progress, streak, and a dynamic badge collection. An empty state explains how to earn the first badge. Unlocked cards show the achievement name and its milestone description.

## Phase 9 acceptance criteria

Phase 9 is complete when completed sessions can unlock relevant achievements, repeated evaluation does not duplicate unlocks, the achievement state survives local reloads, and the player profile displays the current badge collection.

## Next handoff

Phase 10 should add an AI opponent using deterministic difficulty profiles and the existing game-session contract. AI wins, completed battles, and difficulty milestones can later become achievement triggers without changing the badge store boundary.
