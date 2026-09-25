# Bible Arena Activity Feed

**Status:** Phase 17 — Activity Feed  
**Version:** 0.1

## Unified event model

The activity domain represents player history as typed events with stable IDs, account ID, event type, title, detail, timestamp, and optional metadata. Supported event types include completed games, unlocked achievements, claimed season rewards, season milestones, and completed challenges.

Stable event IDs make retries safe. A game uses `game:<sessionId>`, an achievement uses `achievement:<achievementId>`, and a reward uses `reward:<rewardId>`. The same event is never appended twice for one account.

## Recorded activity

Completed sessions add a game summary with correct answers and score. Newly unlocked achievements add one event per badge. Claiming a season reward adds a reward event. The store and type model are ready for challenge completion and season milestone events as those flows become authoritative.

## Player experience

Profile now includes Recent History beneath season rewards. Each event shows a compact type indicator, title, detail, and relative timestamp. Empty accounts receive an explanatory state instead of a blank panel.

## Persistence boundary

Activity is stored in a versioned account-scoped local record and capped at the most recent 100 events. Production should move the feed to a server-backed append-only or queryable event store, keep account authorization on the server, and support pagination rather than relying on a browser record.

## Phase 17 acceptance criteria

Phase 17 is complete when the project has a typed unified activity event, account-scoped durable storage, stable deduplication, recording for core game and reward flows, relative time formatting, and a Profile history view.

## Next handoff

Phase 18 should add notification preferences and an unread activity state so important unlocks and competitive events can be surfaced without requiring the player to open Profile.
