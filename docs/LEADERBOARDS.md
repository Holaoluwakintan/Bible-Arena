# Bible Arena Leaderboards

**Status:** Phase 13 — Leaderboards  
**Version:** 0.1

## Ranking scopes

The leaderboard domain supports `weekly` and `all_time` scopes. Weekly periods begin on Monday at 00:00 UTC and end at the next Monday boundary. All-time rankings use the full available record range. The period calculation is isolated from UI code so a future locale or server-defined competition timezone can replace the prototype rule.

## Aggregation

Completed game results are stored as leaderboard records with session ID, account ID, display name, score, XP, mode, and completion timestamp. Records are grouped by player within the selected scope. A player’s row contains cumulative score, cumulative XP, and completed-session count.

Rows sort by score descending, then XP descending, then display name for a stable final tie-break. Ranks are assigned after sorting. A session ID prevents the same result from being recorded twice.

## Player experience

The Ranks screen now loads dynamic rows, highlights the active account, shows the account’s current position, and provides weekly and all-time scope tabs. Demo records seed the local prototype so a new player sees a meaningful board before completing a game.

## Persistence boundary

The prototype stores leaderboard records in browser `localStorage`. This supports local development and dynamic updates from completed sessions, but it is not authoritative across devices. Production should use a server-side aggregation or materialized ranking view with authenticated account IDs, period partitions, and protected result ingestion.

## Phase 13 acceptance criteria

Phase 13 is complete when completed results update account-aware leaderboard records, weekly boundaries are deterministic, all-time and weekly scopes aggregate correctly, duplicate session records are ignored, and the Ranks screen renders dynamic rankings and the active player’s position.

## Next handoff

Phase 14 should introduce live multiplayer only after choosing a server-authoritative realtime transport. The leaderboard record boundary is ready to consume finalized multiplayer results once that transport exists.
