# Bible Arena Provider Adapters

**Status:** Phase 20 — Provider Adapters  
**Version:** 0.1

## Adapter contract

Provider adapters accept a normalized notification message containing notification ID, recipient, title, and body. They return a delivery attempt with success state, execution mode, provider message ID, error details, and attempt timestamp. Email and push use the same contract, so provider-specific code remains outside the activity and notification domains.

The current adapters are safe dry-run providers. A successful dry-run produces a `simulated` outbox status and a stable dry-run message ID. No external network request or message delivery occurs.

## Protected worker

`processOutbox` requires an authorization token matching the worker’s expected secret before processing records. It skips records that are already sent, simulated, or failed, processes queued records through the channel provider, increments attempts, stores timestamps and provider IDs, and marks missing providers or payloads failed. Failed provider attempts can remain queued until the configured maximum attempt count is reached.

The worker is a pure boundary in this phase. Production should invoke it only from an authenticated server-side job, keep provider secrets outside the client, add exponential backoff, and persist updates atomically.

## UI health

The delivery settings panel now reports queued outbox count and adapter mode. Guest users see that delivery remains dry-run until a verified contact and authenticated provider are connected.

## Phase 20 acceptance criteria

Phase 20 is complete when provider contracts exist, dry-run email and push adapters work, the worker is authorization-protected, queued records transition with retry metadata, missing-provider failures are explicit, and delivery health is visible in the UI.

## Next handoff

Phase 21 should connect one real authenticated provider through server-side secrets and a background worker, after deployment and privacy requirements are confirmed.
