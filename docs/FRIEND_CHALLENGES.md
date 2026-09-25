# Bible Arena Friend Challenges

**Status:** Phase 11 — Friend Challenges  
**Version:** 0.1

## Player flow

A player opens Challenge a Friend from Play, creates a five-question Bible Quiz challenge, and receives a six-character invite code. The code can be copied or shared outside the prototype. Another player enters the code to join the challenge and completes an asynchronous turn. The challenge remains pending until both results are recorded, then displays the winner or a draw.

The current interface supports creating a challenge, joining by code, playing the creator or opponent turn, recording the result, and starting another challenge. The challenge questions and mode are stored in the challenge record so both turns use the same content configuration.

## Lifecycle

Challenges move through `open`, `in_progress`, `complete`, and `expired` states. A new challenge is open until an opponent joins or the creator begins a turn. Joining sets the opponent and moves the challenge to in progress. When both player results exist, the challenge becomes complete. A challenge expires after its configured lifetime and cannot be joined or completed.

Codes use an alphabet that excludes ambiguous characters such as `I`, `O`, `1`, and `0`. Code creation accepts an injectable random source for deterministic tests. Production should enforce code uniqueness in the persistence layer.

## Persistence boundary

The prototype stores challenges in a versioned browser `localStorage` record. It supports challenge lookup by normalized code, joining, result recording, lifecycle refresh, and local expiration. This is sufficient for a single-browser prototype but cannot coordinate separate players across devices.

A production implementation should replace the store with server-side challenge records, authenticated player IDs, unique invite-code constraints, server-controlled expiration, and protected result submission. The client must not be trusted to alter question IDs or result scores.

## Phase 11 acceptance criteria

Phase 11 is complete when a player can create a challenge, receive a stable invite code, join or resume a challenge, play a turn, see pending state until the other result exists, compare completed scores, and receive clear expiration and error states.

## Next handoff

Phase 12 should add account profiles and authentication. Challenge creator and opponent IDs can then become durable account references instead of guest placeholders.
