# Bible Arena Production Provider Integration

**Status:** Phase 22 — Production Provider Integration  
**Version:** 0.1

## Readiness model

Production integration is represented by a configuration containing environment, provider connections, privacy consent version, worker authorization state, and deployment URL. Verified contacts contain channel, target, verification status, and verification timestamp.

The readiness checker reports blocking and warning issues without exposing secret values. Blocking checks include at least one configured provider, privacy consent, worker authorization, and one verified contact. Production additionally reports a deployment URL warning when it is absent.

## Activation boundary

`createProductionIntegration` refuses to activate until the readiness report is clear. Once ready, it returns the provider set and activation timestamp for a protected worker invocation. This function does not choose providers, send messages, or create credentials.

## Client behavior

The delivery panel shows that the local session is not production-ready and reports the number of remaining blocking checks. It does not expose secret values or invite users to enter provider credentials into the browser. Real secrets belong in a deployed server secret manager.

## Required production steps

A real deployment still requires selecting one email or push provider, configuring its server secret, recording privacy consent, implementing verified-contact flows, configuring worker authorization, deploying the server boundary, and completing a privacy review. Those are intentionally explicit external integration steps rather than simulated in this repository.

## Phase 22 acceptance criteria

Phase 22 is complete when production configuration and contact verification are typed, readiness blockers are deterministic, unready activation is refused, ready activation has a server-only boundary, and safe readiness status is visible in the UI.

## Next handoff

Phase 23 should implement the selected provider’s deployed adapter and verified contact flow after the user chooses a provider and supplies or configures credentials through the deployment environment.
