# Bible Arena Authenticated Delivery

**Status:** Phase 21 — Authenticated Delivery  
**Version:** 0.1

## Provider connections

Provider connections define channel, provider name, server-only secret reference, health state, last check time, and optional error. The initial references are `RESEND_API_KEY` for email and `FCM_SERVER_KEY` for push. The browser receives only provider names and health labels; secret values never enter client state or UI.

Connection health distinguishes `not_configured`, `configured`, `healthy`, and `error`. This phase validates the secret-reference boundary and configured state without making a network call.

## Authenticated adapter

`createAuthenticatedProvider` requires a server-side secret map and refuses to construct an adapter when the referenced secret is missing. The adapter receives the resolved secret only inside its injected server request function and returns the existing delivery-attempt contract. This makes provider-specific HTTP code replaceable and testable without hard-coding a vendor SDK.

The current verification uses an injected fake request. No real provider credentials are present, and no external delivery is performed.

## Client safety

Delivery settings expose provider health and explain the server-only boundary. They do not display secret references as values, accept credentials, or attempt client-side provider calls. Guest accounts remain in dry-run mode.

## Phase 21 acceptance criteria

Phase 21 is complete when provider connections have typed health states, secret references resolve only in a server boundary, missing credentials block adapter creation, configured adapters produce live-attempt contracts through injected requests, and the UI exposes safe health information.

## Next handoff

Phase 22 should connect one selected provider in a deployed server environment with secret management, privacy review, verified contact flows, and an authenticated worker invocation. This should be treated as an external integration decision rather than simulated locally.
