# Bible Arena Bible or Myth

**Status:** Phase 6 — Bible or Myth  
**Version:** 0.1

## Player flow

Bible or Myth is a five-statement mode designed to test careful reading and correct common misconceptions without overstating what the biblical text says. The player receives one statement at a time and selects **Bible** or **Myth** within a fifteen-second window.

After submission, the selected and canonical choices are shown with correct or incorrect state. The player receives a concise explanation and Scripture reference before continuing. A timeout submits no choice and earns no points. The final result uses the same score, accuracy, XP, streak, replay, and exit flow as Bible Quiz.

## Content policy

Statements marked Bible must be supported by the cited text. Statements marked Myth must explain precisely what is unsupported, incomplete, or inaccurately phrased. The mode should distinguish an absent detail from a theological disagreement and must not treat a denominational interpretation as a universal fact without appropriate context.

The initial seed set includes statements about Eden’s fruit, the number of wise men, the wording about money and evil, Daniel’s lions, and Jonah’s great fish. All five records are verified and eligible for play.

## Architecture

The mode uses the Phase 2 `bible_or_myth` question type, the Phase 3 session and scoring engine, and the Phase 5 progression store. It has no separate scoring or reward implementation. The only mode-specific configuration is five questions, a fifteen-second response window, and Bible-or-Myth presentation controls.

## Phase 6 acceptance criteria

Phase 6 is complete when a player can start the mode from Home or Play, answer five statements, receive immediate explanations and references, experience timeout behavior, complete the session, earn progression rewards, replay, and exit without a full page reload.

## Next handoff

Phase 7 should add the Word Puzzle mode. It should extend the question presentation contract for normalized text answers while continuing to reuse session lifecycle, result calculation, and progression rewards.
