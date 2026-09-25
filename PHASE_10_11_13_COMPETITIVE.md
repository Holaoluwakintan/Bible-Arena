# Bible Arena — AI Battle, Friend Challenges, and Leaderboards

**Status:** Complete as local-first foundations

## AI Battle

AI Battle uses deterministic opponent simulation rather than generative behavior. Each difficulty maps to a fixed accuracy target and response-time distribution:

| Difficulty | Opponent label | Accuracy target |
|---|---|---:|
| Easy | Explorer | 55% |
| Medium | Challenger | 72% |
| Hard | Scholar | 88% |

The opponent answer is derived from the question ID, difficulty, and question index. Replaying the same configured battle produces the same AI choices and response timing. The UI compares the player's shared-engine score against the simulated opponent score.

## Friend Challenges

The local Friend Challenge boundary supports creating a seven-day challenge with a deterministic six-digit share code, listing local challenges, and joining an open challenge. The lifecycle is `open → completed`, with an `expired` state derived from the expiry timestamp.

The current join flow is intentionally device-local. A production version should persist challenges against authenticated account IDs, resolve codes through a trusted API, validate ownership, and record separate creator and opponent session results.

## Leaderboards

The leaderboard aggregator supports weekly and all-time scopes. The current local preview aggregates the active guest's completed sessions and displays the resulting score, session count, and average accuracy. Weekly scope uses the local calendar week's Monday boundary.

The data shape is provider-neutral and ready for account-backed ranking queries. Before competitive release, leaderboard ingestion should use trusted completed-session results, account IDs, privacy-safe display names, and server-side period boundaries.

## Verification

The milestone has been verified with:

- Deterministic AI answer and scoring tests.
- Friend Challenge share-code, join, and expiry tests.
- Weekly and all-time leaderboard aggregation tests.
- Full prior question, engine, progression, mode, and achievement tests.
- TypeScript compilation.
- Expo static export of AI Battle, Challenges, Leaderboards, and existing routes.

## Next handoff

The next milestone should add authenticated player accounts and server-backed challenge and leaderboard persistence. Live Multiplayer can then replace local adapters with an authoritative realtime transport.
