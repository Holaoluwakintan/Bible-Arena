# Bible Arena Phase 18 — Concurrency, Reconnect Recovery, and Tournament Seasons

**Status:** Complete foundation

## Conditional multiplayer writes

Multiplayer rooms now carry a monotonically increasing `roomVersion`. Join, ready, answer, timeout, and rematch mutations include the version observed by the client and update the row only when the stored version still matches. A competing final answer or timeout therefore causes one write to succeed and the other to receive a reloadable `Room changed` error instead of both transitions being committed from the same state.

The room version is incremented on each successful state transition and is included in WebSocket snapshots. Timeout recovery through the room query uses the same conditional write path.

## Reconnect and offline recovery

The room screen exposes connection state as **Connecting**, **Live connection active**, **Reconnecting**, or **Offline · retrying automatically**. Closed sockets reconnect with bounded exponential backoff, resubscribe to the room, and receive a fresh authoritative snapshot. HTTP remains available for initial room loading and mutation recovery.

## Tournament seasons and divisions

Completed multiplayer matches are assigned to an active monthly tournament season. The Leaderboards screen now supports All games and Multiplayer boards, with Multiplayer scopes for the active Season, This week, and All time. Multiplayer rows show wins, losses, draws, match count, XP, and a division calculated from competitive points: Bronze, Silver, Gold, Platinum, or Diamond.

## Verification

The suite covers room protocol behavior, realtime message validation, ranking aggregation, and division thresholds. Final verification reports 26 active tests passing, TypeScript clean, Expo web export successful, and server bundle build successful.

## Next hardening

A production ranked ladder can next add season rollover jobs, promotion/demotion rules, anti-abuse review, and queue-based matchmaking with regional latency selection.
