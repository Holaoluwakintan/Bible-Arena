# Bible Arena Word Puzzle

**Status:** Phase 7 — Puzzle World  
**Version:** 0.1

## Player flow

Word Puzzle is a five-puzzle unscramble mode. Each puzzle presents shuffled letters from a verified Bible word or place. The player types an answer and submits it with the Check action or the Enter key.

Answers are normalized by trimming leading and trailing whitespace and folding repeated spaces and letter case. The engine compares the normalized submission against the canonical answer and the canonical option label. This allows harmless formatting differences without weakening the content contract.

After submission, the player receives correct or incorrect feedback, an explanation, and a Scripture reference. The final puzzle produces the same score, accuracy, XP, streak, replay, and exit behavior as the other completed modes.

## Content policy

Every puzzle has one canonical answer, a category, difficulty, explanation, source, and verified Scripture reference. The initial content includes Jericho, Galilee, tabernacle, Bethlehem, and resurrection. Puzzle prompts identify whether the answer is a word or place without revealing the canonical answer.

## Architecture

The mode uses the Phase 2 `unscramble` question type, the Phase 3 game engine with normalized text matching, and the Phase 5 progression store. It has no separate scoring or reward implementation. Puzzle mode intentionally has no countdown in the first UI pass because the initial design goal is pattern play rather than speed pressure.

## Phase 7 acceptance criteria

Phase 7 is complete when a player can start Word Puzzle from Play, solve five verified puzzles, submit normalized text answers, receive explanations and references, complete the session, earn progression rewards, replay, and exit without a full page reload.

## Next handoff

Phase 8 should add Daily Challenge as a deterministic date-based session that selects a stable content set, prevents duplicate competitive rewards, and reuses the existing mode and progression boundaries.
