# Bible Arena Live Multiplayer

**Status:** Phase 14 — Live Multiplayer  
**Version:** 0.1

## Realtime contract

The multiplayer domain defines a server-authoritative `MatchState` containing match identity, code, mode, questions, phase, current question index, players, server time, and creation time. Clients exchange typed `MatchEvent` messages rather than mutating match state directly.

The supported lifecycle is `lobby`, `ready`, `active`, `complete`, and `cancelled`. Player join and readiness events are applied through `applyAuthoritativeEvent`. The transition to active requires two connected players who are both ready. The contract is designed so a server can validate event actors, answer timing, question progression, and final scores before broadcasting state.

## Local transport

`createLocalTransport` implements the `RealtimeTransport` interface for this phase. It provides connect, disconnect, state access, subscriptions, and event sending in one process. It is intentionally an adapter, not a production multiplayer service. The Live Multiplayer screen uses it to preview a synchronized lobby, match code, player presence, and readiness transitions.

A production implementation should replace the adapter with a persistent realtime transport and server-side match store. WebSockets or a hosted realtime provider are viable options. The selected transport must support authenticated channels, reconnect behavior, heartbeat or presence, event ordering, server timestamps, and authoritative result finalization.

## Player experience

The Play screen now offers Live Multiplayer. A player can create a lobby, see a match code, observe server phase and player count, mark readiness, and simulate an opponent join in the local preview. The UI explicitly identifies the preview boundary so it does not imply that the local adapter coordinates separate devices.

## Phase 14 acceptance criteria

Phase 14 is complete when the project has a typed authoritative match contract, lifecycle and readiness transitions, a realtime transport interface, a deterministic local adapter, a lobby UI, synchronized state updates, and a documented production transport boundary.

## Next handoff

Phase 15 should add Seasons and period-scoped competitive metadata. Live match results can later be finalized into season records through the existing leaderboard ingestion boundary.
