# Bible Arena — Word Puzzle, Daily Challenge, and Achievements

**Status:** Complete

## Word Puzzle

Word Puzzle uses the shared `BibleQuestion` contract with `type: "unscramble"`. Its canonical answer is normalized to lowercase and trimmed before answer validation. The shared game screen renders a text input instead of multiple-choice options, while timing, feedback, scoring, and results remain in the common engine.

The current verified seed bank includes five Bible-related word puzzles with explanations and references.

## Daily Challenge

Daily Challenge uses the shared game session and a deterministic date-based question offset. Players receive the same configured question set for the current calendar date in the local prototype. The progression layer gives the first completed Daily Challenge of a calendar day an additional 100 XP reward. Replaying another Daily Challenge session on the same date does not award the bonus again.

This local implementation is ready for a server-authoritative daily identity once accounts and trusted persistence are added.

## Achievements

Achievements consume durable progression and session history rather than reading screen state. The current catalog includes:

| Achievement | Unlock rule |
|---|---|
| First Step | Complete one session |
| Perfect Form | Complete one session with 100% accuracy |
| Keep Showing Up | Complete five sessions |
| In Rhythm | Reach a three-day streak |
| Myth Buster | Complete a Bible or Myth session |

Unlocked achievements are persisted with the progression record and displayed on Profile with badge icons and descriptions.

## Verification

The milestone has been verified with:

- Word Puzzle answer normalization and content eligibility tests.
- Daily Challenge question-set and one-per-day reward tests.
- Achievement unlock tests.
- Existing question, engine, progression, and design-system tests.
- Full TypeScript compilation.
- Expo static export of the shared game route.
- Metro restart with no TypeScript or LSP errors.

## Next handoff

The next milestone can add AI Battle and Friend Challenges using the existing result, progression, and history boundaries. Daily Challenge should move behind trusted server validation before it becomes a competitive leaderboard source.
