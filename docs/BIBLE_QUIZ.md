# Bible Arena Bible Quiz

**Status:** Phase 4 — First Game  
**Version:** 0.1

## Player flow

The player can enter Bible Quiz from Home or Play, then complete a ten-question multiple-choice session. Each question displays its category, difficulty, progress position, answer options, and a twenty-second timer.

After an answer is submitted, the interface immediately marks the correct and selected options, displays whether the answer was correct, shows the explanation and Scripture reference, and provides a controlled transition to the next question. A timeout submits a null answer and awards no points.

After the final answer, the player sees score, correct-answer count, accuracy, XP earned, streak progress, and a replay action. The session can be exited before completion without displaying a competitive result.

## Architecture

The screen is a consumer of the Phase 2 question repository and Phase 3 game engine. It does not duplicate canonical answers, scoring formulas, timeout behavior, or result calculations. This keeps future game modes aligned with the same engine contract.

The current player is a guest placeholder and the question repository is in memory. Persistent accounts, server-side answer validation, durable progression, and challenge sharing remain future work.

## Acceptance criteria

Phase 4 is complete when a player can start a ten-question session, answer questions, see immediate learning feedback, experience timeout behavior, complete the session, view a result summary, and replay without a full page reload. The content and engine verification commands and production build must pass.

## Next handoff

Phase 5 should introduce durable XP, levels, and streak state. The result object already exposes score, accuracy, and XP so progression can be attached without changing the quiz interaction contract.
