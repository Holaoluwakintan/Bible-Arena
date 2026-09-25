# Bible Arena Question System

**Status:** Phase 2 — Database and Question System  
**Version:** 0.1

## Purpose

The question system is the trusted content boundary for Bible Arena. It separates content definition, verification, retrieval, and future persistence so game modes can share one reliable question contract.

## Domain contract

Every question is represented by the `BibleQuestion` type in `src/domain/questions.ts`. The contract includes a stable identifier, question type, prompt, answer options, canonical answer, category, difficulty, explanation, source metadata, verification status, and timestamps.

The supported question types are `multiple_choice`, `true_false`, `unscramble`, `fill_blank`, `who_am_i`, `verse_completion`, `bible_or_myth`, and `speed`. The initial seed content uses multiple choice, Bible or Myth, Who Am I?, and unscramble formats.

## Verification policy

Only questions with `status: verified` and no validation errors can be returned by `getPlayable` or `selectQuestions`. A verified question must include an explanation, source, and Scripture reference. The reference requirement prevents content from silently becoming competitive authority without supporting evidence.

AI-assisted drafting may be added later, but draft and review content must remain outside the playable pool until a human reviewer verifies it. Rejected content is retained for auditability but is never playable.

## Repository boundary

`src/data/questionRepository.ts` currently provides an in-memory repository with the same query shape expected from a future API or database adapter. It supports filtering by type, category, difficulty, and excluded identifiers. `selectQuestions` performs deterministic Fisher–Yates sampling when a random function is supplied, which keeps future game-session tests reproducible.

The repository is intentionally provider-neutral. Phase 3 may consume this interface without knowing whether the records originate from a local seed, a server endpoint, or a relational database.

## Seed content

`src/data/questionBank.ts` contains a small verified seed set for development and one draft record used to prove that filtering protects the playable pool. Seed questions include source references and explanations. Production content must add a content-review workflow and a real persistence layer before launch.

## Phase 2 acceptance criteria

Phase 2 is complete when the project has a typed question contract, validation for required fields and verification state, a playable-only retrieval path, representative verified seed content, deterministic selection behavior, and documentation for replacing the in-memory adapter.

## Phase 3 handoff

The game engine can now request a set of playable questions without duplicating content rules. It should treat question identifiers and canonical answers as opaque domain data, submit answer attempts through a separate answer boundary, and avoid exposing correct answers before the player responds.
