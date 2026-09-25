# Bible Arena Phase 15 — Private Live Multiplayer Rooms

**Status:** Private-room foundation complete

## User flow

Authenticated players open **Play → Live Multiplayer**. A host creates a private room and shares the six-digit code. A second authenticated player joins with that code. Both players see room presence and scores, mark themselves ready, answer the same five verified Bible Quiz questions, and receive a server-authoritative result. Either player can request a rematch after completion.

## Authoritative protocol

The `multiplayer_rooms` table stores the room lifecycle, participants, readiness flags, active question index, per-player answer locks, scores, and winner. Protected tRPC procedures expose `create`, `get`, `join`, `ready`, `answer`, and `rematch`.

The server validates that the caller belongs to the room, the room is in the correct lifecycle state, the submitted question is active, and the player has not already answered it. It resolves the answer against the verified Bible Quiz seed bank, awards points only for a correct canonical option, advances only after both players answer, and calculates the winner or draw on the final round.

The client polls room state every second. This provides reconnect-safe synchronized state without storing a room exclusively in process memory, so the implementation remains safe across server restarts and multiple stateless instances.

## Testing

The pure protocol rules are covered by `tests/multiplayer.test.ts`, including simultaneous readiness, correct and incorrect answers, duplicate answer rejection, stale question rejection, non-member rejection, final winner calculation, and rematch reset. The full suite currently has 22 active tests passing; the existing auth logout test remains skipped.

## Production boundary

This phase uses durable room state plus one-second refresh for a resilient first multiplayer slice. A later high-concurrency release can add WebSockets or server-sent events on top of the same room model. Before public competitive launch, add a server-generated match question seed, round deadlines, timeout resolution, rate limiting, abuse telemetry, and multiplayer session records linked to XP rewards.

## Next milestone

Add server-issued round tokens and timeout jobs, then add a dedicated multiplayer result record so competitive wins and losses feed progression without trusting client-submitted result payloads.
