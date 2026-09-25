# Bible Arena Daily Challenge

**Status:** Phase 8 — Daily Challenge  
**Version:** 0.1

## Challenge identity

The Daily Challenge is derived from a normalized calendar date. The challenge session identifier is `daily-YYYY-MM-DD`, which remains stable for every player and every launch on that date. The same date produces the same ordered set of five multiple-choice questions from the verified pool.

The current prototype uses the UTC date at application startup. A production account flow should derive the date using the player’s configured timezone or the content locale’s official challenge timezone and should obtain the challenge assignment from a trusted server.

## Player flow

The Home card opens the current challenge. The player answers five questions using the existing quiz interface, receives the standard explanation and Scripture reference after each answer, and sees the standard result summary at completion. The Home card changes to a completed state after the stable daily session identifier is recorded in progression.

A player may replay the completed challenge for practice, but the progression store will not award duplicate XP or another streak increment because the stable session identifier has already been recorded. This is a local prototype safeguard; competitive production enforcement must use a server-side unique constraint or idempotency key.

## Architecture

`src/daily/dailyChallenge.ts` provides date normalization, stable session IDs, deterministic hashing, and question selection. The existing Phase 3 engine is reused with `daily_challenge` mode, and Phase 5 progression consumes the same result contract as every other mode.

## Phase 8 acceptance criteria

Phase 8 is complete when the Daily Challenge can be opened from Home, produces five stable questions for the date, can be completed through the shared quiz flow, marks its daily state in the Home UI, and prevents duplicate progression rewards for the same daily session.

## Next handoff

Phase 9 should add achievements and badges using progression and completed-session events. Daily completion, streak milestones, accuracy, and mode variety are available as future achievement triggers.
