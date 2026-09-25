# Bible Arena: Content, Moderation, and Privacy Governance

## Scripture content

- Every question must include a non-empty explanation, a Bible reference, a translation when applicable, and a source.
- New questions remain in `draft` or `review` until checked by a reviewer; only `verified` questions are eligible for scored sessions.
- Do not present a doctrinally sensitive interpretation as an uncontested fact. Flag wording for review and prefer explicit denominational or translation context where needed.
- Reports are stored in `question_reports` with a reason and optional detail. Reviewers should resolve the source question, not silently edit historical session results.

## Player safety and competitive integrity

- Friend, multiplayer, and matchmaking mutations are authenticated and scoped to the requesting player.
- Completed matches record suspicious-risk signals such as unusually short duration, incomplete telemetry, or repeated pairings in `multiplayer_matches`.
- Players can submit a moderation flag through `reports.match`; administrators review open flags through `moderation.openFlags`.
- Suspicion is a review signal, not an automatic ban. Human review and an auditable decision are required before account action.

## Privacy controls

- `privacy.export` returns the authenticated player's account, progression, sessions, challenges, matches, and friendships without exposing other users' private account fields.
- `privacy.deleteAccount` deletes the authenticated account. Foreign-key cascades remove associated progression, sessions, tokens, and social records.
- Export and deletion must be offered from a clearly labeled authenticated settings/account surface before production launch.
- Production deployments should retain encrypted database backups according to the operator's documented retention policy and restrict backup access.
