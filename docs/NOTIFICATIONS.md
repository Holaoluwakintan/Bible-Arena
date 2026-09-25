# Bible Arena Notifications

**Status:** Phase 18 — Notifications  
**Version:** 0.1

## Notification model

Notifications are derived from account activity events and contain a stable ID, source activity ID, type, title, body, timestamp, and read state. A notification ID uses the source activity ID, so retrying activity ingestion cannot create duplicate inbox entries.

Default preferences notify for achievement unlocks, season rewards, and competition events. Routine game-completion activity remains available in Recent History but is muted as a notification by default.

## Player experience

The header bell opens a compact notification center. Unread notifications display a badge count. Players can open individual notifications to mark them read or mark the complete inbox read. The center includes preference controls for achievements, rewards, and competition events.

Read state and preferences are account-scoped and persist locally in versioned records. Changing preferences affects future activity ingestion; existing notifications remain available so players do not lose history.

## Persistence boundary

The prototype stores up to 100 notification records per account in browser `localStorage`. Production should use a server-backed notification projection or queue, authenticated account IDs, pagination, and a reliable read cursor. Push delivery can be added later without changing the activity event contract.

## Phase 18 acceptance criteria

Phase 18 is complete when activity events can generate preference-aware notifications, unread counts are correct, individual and bulk read actions work, preferences persist, and the header provides a usable notification center.

## Next handoff

Phase 19 should add notification delivery channels and a lightweight settings surface so players can choose in-app, email, or push delivery when an authenticated backend exists.
