# Bible Arena Season Rewards

**Status:** Phase 16 — Season Rewards  
**Version:** 0.1

## Reward catalog

Autumn Ascension contains four tier rewards: Autumn Learner at Seedling, Pathfinder Accent at Pathfinder, Scribe Badge at Scribe, and Elder Frame at Elder. Rewards have stable IDs, tier ownership, reward types, display names, descriptions, and implementation values.

The reward types are provider-neutral: titles, badge variants, profile accents, and avatar frames. The current Profile uses the catalog to present reward names and descriptions rather than embedding tier-specific copy in the UI.

## Eligibility and claims

A player is eligible for every reward at or below the highest season tier reached. Claiming a reward requires eligibility. Claims are idempotent: claiming an already-claimed reward returns the existing inventory without adding a duplicate. The first claimed reward becomes the active reward by default.

The current prototype displays eligible rewards in Profile and provides a Claim action. Locked higher-tier rewards are not presented as claimable. A future inventory surface can allow players to equip any claimed cosmetic, and the store already exposes an equip boundary.

## Persistence boundary

Reward inventory is stored in a versioned local record keyed by account ID. Production should move claims to a server-authoritative inventory with season ownership, one-time grant constraints, and audit records. Cosmetic values should be validated against the reward catalog on the server.

## Phase 16 acceptance criteria

Phase 16 is complete when tier rewards are defined, eligibility follows season progress, claims are duplicate-safe, locked rewards cannot be claimed, inventory is account-scoped, and the Profile presents available and claimed rewards.

## Next handoff

Phase 17 should add a notification and activity feed so reward unlocks, achievements, challenge events, and season milestones have a unified player-facing history.
