# Bible Arena Notification Delivery

**Status:** Phase 19 — Notification Delivery  
**Version:** 0.1

## Delivery channels

The delivery domain supports email and push channels in addition to the existing in-app inbox. Email requires an enabled preference, verified email address, and authenticated provider. Push requires an enabled preference, registered device, and authenticated push provider. Unverified or unregistered channels cannot produce delivery records.

The settings surface is available from the notification center. It clearly communicates why external channels are unavailable in the current guest/local prototype rather than presenting toggles that appear to work.

## Outbox boundary

Eligible notification events produce stable outbox IDs in the form `outbox:<notificationId>:<channel>`. Records begin in `queued` status and are account-scoped. The local store deduplicates IDs and retains a capped history. It does not attempt to send messages.

A production worker should claim queued records, send through a verified provider, record sent or failed status, apply bounded retries, and preserve an audit trail. Provider credentials must remain server-side, and delivery authorization must be checked against the account’s current preferences at send time.

## Activity integration

New notification events from achievement and reward activity are passed through the delivery outbox boundary. Re-ingesting the same notifications is safe. Changing delivery preferences can enqueue eligible existing notifications for the local prototype; a production implementation should define a clear policy for backfill versus future-only delivery.

## Phase 19 acceptance criteria

Phase 19 is complete when delivery channels and gating rules are typed, account preferences persist, eligible notifications create stable queued outbox records, duplicate enqueue is prevented, settings are visible, and no external delivery is claimed without a verified provider.

## Next handoff

Phase 20 should add provider adapters and a server-side delivery worker after selecting authenticated email and push providers. The outbox contract is ready to feed that worker.
