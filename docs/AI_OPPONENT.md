# Bible Arena AI Opponent

**Status:** Phase 10 — AI Opponent  
**Version:** 0.1

## Battle flow

AI Battle is a five-question multiple-choice session against **The Scholar**, the standard AI profile. The player answers through the familiar quiz interaction while the AI answers the same question in the background. The interface shows the opponent profile and running AI score, then presents a final player-versus-AI comparison.

The player’s completed session still produces the normal result contract, so XP, streaks, and achievements are awarded through existing boundaries. The AI score is used only for the battle comparison and is not treated as player progression.

## Difficulty profiles

The initial catalog contains three deterministic profiles: The Curious One at 55% accuracy, The Scholar at 75%, and The Master at 92%. Each profile defines an accuracy probability and a response-time range. A simulation chooses a correct or incorrect option according to the profile and calculates points through the shared scoring function.

The random function is injectable for reproducible tests. Production gameplay may use a seeded match-specific random source if exact replayability is required.

## Trust boundary

The current AI is a predictable local opponent, not a generative model. This is deliberate for fairness, low latency, and testability. A future server implementation should calculate AI outcomes from a trusted match configuration so clients cannot alter opponent scores or difficulty.

## Phase 10 acceptance criteria

Phase 10 is complete when a player can start AI Battle from Play, answer five questions against a named difficulty profile, see the opponent’s running score, complete the battle, compare final scores, replay, exit, and receive normal progression rewards.

## Next handoff

Phase 11 should add asynchronous Friend Challenges using stable challenge payloads, invite codes, expiration, and result comparison. The AI Battle result comparison can inform the shared challenge result contract.
