# Build Status

## Current phase

**Phase 30 — Social Graph & Fellowship System (Friendships, Friends Leaderboard, Direct Friend Duels & Player Search)** is complete.

## Completed phases

Phase 0 established the product foundation and MVP. Phase 1 established the React, TypeScript, Vite, and responsive design foundation. Phase 2 established the typed question contract, verified seed bank, validation rules, and repository boundary. Phase 3 established the reusable session, answer, timer, scoring, XP, and result engine. Phase 4 connected those foundations to the first fully playable ten-question Bible Quiz. Phase 5 added local durable progression with XP, levels, and streaks. Phase 6 added the signature five-statement Bible or Myth mode. Phase 7 added the five-puzzle Word Puzzle mode and normalized text answers. Phase 8 added a deterministic five-question Daily Challenge. Phase 9 added idempotent achievements and profile badges. Phase 10 added deterministic AI Battle. Phase 11 added asynchronous Friend Challenges. Phase 12 added provider-neutral player accounts and local auth-session boundaries. Phase 13 added account-aware weekly and all-time leaderboards. Phase 14 added the authoritative realtime match contract and local transport adapter. Phase 15 added account-scoped seasons and competitive tier progress. Phase 16 added season rewards and account-scoped reward inventory. Phase 17 added unified account activity history. Phase 18 added preference-aware notifications and an in-app notification center. Phase 19 added delivery channel preferences and a queued outbox boundary. Phase 20 added provider adapter contracts and a protected outbox worker. Phase 21 added authenticated provider connection and secret-reference boundaries. Phase 22 added production integration readiness and activation protection. Phase 23 added a selected Resend email adapter and verified-contact primitives. Phase 24 added authoritative ranked matchmaking queue, competitive divisions, seasonal ladder progression (Seedling, Pathfinder, Scribe, Elder), and claimable season reward catalog. Phase 25 added the signature P0 "Who Am I?" progressive clue deduction game mode with tiered scoring (300/200/100 pts), verified seed bank, interactive deduction screen, and session progression recording. Phase 26 expanded the question bank to 110+ verified questions (50 Bible Quiz MCQs, 20 Bible or Myth, 20 Word Puzzles, 20 Who Am I figures) with randomized gameplay shuffling. Phase 27 added the 3-slide interactive onboarding tour, introductory XP reward hook, and settings replay. Phase 28 added scheduled 8:00 PM local daily streak protection push notifications and tRPC token registration. Phase 29 added viral game result sharing with inspirational Scripture verses and challenge invite links across all game modes. Phase 30 established the Social Graph and Friends System with a `friendships` SQLite table, player search, friend requests & approvals, dedicated Friends leaderboard tab, direct 1-tap friend duels, and profile hub navigation.

## Phase 30 result

The application enables viral peer-to-peer fellowship:
- **Friendships & Search**: Players can search other disciples by username/ID, send friend requests, and manage incoming invites.
- **Dedicated Friends Leaderboard**: A new "Friends" tab on the Leaderboards screen ranks player circles by weekly XP and streak.
- **Direct 1-Tap Friend Duels**: Seamlessly triggers Friend Challenge duel codes against any friend directly from the leaderboard or friends hub.
- **Clean Architecture**: Domain types in `domain/friends.ts`, unit tests in `tests/friends.test.ts`, and full type safety across tRPC endpoints.

## Verification

All 13 test suites (48 unit tests) pass cleanly (`npx vitest run`), and TypeScript compilation (`npm run check`) succeeds with 0 errors across the entire monorepo.
