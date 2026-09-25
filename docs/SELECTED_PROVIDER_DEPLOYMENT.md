# Bible Arena Selected Provider Deployment

**Status:** Phase 23 — Selected Provider Deployment  
**Selected provider:** Resend email  
**Version:** 0.1

## Integration boundary

The repository now contains a server-only Resend adapter. It accepts the normalized provider message used by the delivery worker, maps it to a Resend-style payload, and resolves `RESEND_API_KEY` only inside the authenticated provider boundary. The network request remains injected so the browser and local sandbox cannot send mail accidentally.

Set `DELIVERY_FROM_ADDRESS` to a verified sender identity in the deployment environment. Never place `RESEND_API_KEY` in client-side variables, committed files, or browser local storage.

## Email verification

The contact flow creates a short-lived six-digit verification request with normalized email, expiry, attempt count, and a server-side digest. A valid code produces a verified email contact record. Production should replace the prototype digest with a keyed server-side HMAC, rate-limit requests by account and address, invalidate previous codes, and send codes only through the authenticated provider.

## Deployment configuration

The repository includes `.env.example` with the required server-only names: `RESEND_API_KEY`, `DELIVERY_WORKER_AUTH`, `DELIVERY_FROM_ADDRESS`, `PRIVACY_CONSENT_VERSION`, and `DEPLOYMENT_URL`. Real values must be configured in the deployment secret manager. This task did not receive credentials and did not activate live delivery.

## Required operator steps

Create or select a Resend account, verify the sending domain or address, add the server secrets, deploy the server worker, configure the worker authorization, complete privacy consent recording, implement the account email verification UI, and perform a controlled test delivery. Before enabling production, review retention, unsubscribe behavior, data processing terms, and regional privacy requirements.

## Phase 23 acceptance criteria

Phase 23 is complete when the selected provider adapter exists, server secrets have documented names, sender configuration is explicit, verified email contact primitives exist, readiness can be completed only with operator configuration, and no live delivery is performed without credentials.

## Next handoff

Phase 24 should add the deployed verification UI and server endpoint wiring after the deployment environment has been configured with real secrets. The repository is intentionally ready for that integration but remains safe in unconfigured mode.
