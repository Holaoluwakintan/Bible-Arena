import { describe, expect, it } from "vitest";

import { getMatchXp, getRematchPatch, getRoomReadyPatch, getTimeoutPatch, resolveRoomAnswer, type MultiplayerRoomState } from "../domain/multiplayer";

const lobby: MultiplayerRoomState = {
  hostUserId: 1, guestUserId: 2, status: "lobby", currentQuestionIndex: 0, hostReady: 0, guestReady: 0,
  hostAnsweredIndex: -1, guestAnsweredIndex: -1, hostScore: 0, guestScore: 0, winnerUserId: null,
};

const playing: MultiplayerRoomState = { ...lobby, status: "playing", hostReady: 1, guestReady: 1, roundToken: "round-1", roundDeadline: new Date("2099-01-01T00:00:00Z") };

describe("Bible Arena multiplayer protocol", () => {
  it("starts only after both players are ready", () => {
    expect(getRoomReadyPatch(lobby, 1, true)).toEqual({ hostReady: 1 });
    expect(getRoomReadyPatch({ ...lobby, hostReady: 1 }, 2, true)).toEqual({ guestReady: 1, status: "playing" });
  });

  it("scores a correct answer once and advances after both players answer", () => {
    const hostAnswer = resolveRoomAnswer(playing, 1, 0, "b", "b", 2);
    expect(hostAnswer.isCorrect).toBe(true);
    expect((hostAnswer.patch as { hostScore?: number }).hostScore).toBe(100);
    expect(hostAnswer.patch.hostAnsweredIndex).toBe(0);

    const guestAnswer = resolveRoomAnswer({ ...playing, ...hostAnswer.patch }, 2, 0, "a", "b", 2);
    expect(guestAnswer.isCorrect).toBe(false);
    expect(guestAnswer.patch.currentQuestionIndex).toBe(1);
    expect(guestAnswer.patch.hostAnsweredIndex).toBe(-1);
    expect(guestAnswer.patch.guestAnsweredIndex).toBe(-1);
  });

  it("completes the final round with a winner or draw and supports rematch", () => {
    const finalState = { ...playing, currentQuestionIndex: 1, hostScore: 100, guestScore: 200, hostAnsweredIndex: 1 };
    const result = resolveRoomAnswer(finalState, 2, 1, "b", "b", 2);
    expect(result.patch.status).toBe("complete");
    expect(result.patch.winnerUserId).toBe(2);
    expect(getRematchPatch({ ...finalState, ...result.patch } as MultiplayerRoomState, 1)).toEqual({ status: "lobby", currentQuestionIndex: 0, hostReady: 0, guestReady: 0, hostAnsweredIndex: -1, guestAnsweredIndex: -1, hostScore: 0, guestScore: 0, winnerUserId: null, roundToken: "", roundDeadline: null });
  });

  it("advances expired rounds only with the current token and awards timeout-safe XP", () => {
    const now = new Date("2026-09-17T08:00:00Z");
    const expired = { ...playing, roundDeadline: new Date("2026-09-17T07:59:59Z") };
    const next = getTimeoutPatch(expired, "round-2", new Date("2026-09-17T08:00:20Z"), 5, now, "round-1");
    expect(next.patch.currentQuestionIndex).toBe(1);
    expect(next.patch.roundToken).toBe("round-2");
    expect(() => getTimeoutPatch(expired, "round-2", new Date("2026-09-17T08:00:20Z"), 5, now, "old-token")).toThrow("invalid");
    expect(getMatchXp({ ...playing, winnerUserId: 1 })).toEqual({ hostXp: 100, guestXp: 50 });
    expect(getMatchXp({ ...playing, winnerUserId: null })).toEqual({ hostXp: 75, guestXp: 75 });
  });

  it("rejects stale, duplicate, and non-member answers", () => {
    expect(() => resolveRoomAnswer(playing, 3, 0, "b", "b", 2)).toThrow("not in this room");
    expect(() => resolveRoomAnswer({ ...playing, hostAnsweredIndex: 0 }, 1, 0, "b", "b", 2)).toThrow("already submitted");
    expect(() => resolveRoomAnswer(playing, 1, 1, "b", "b", 2)).toThrow("no longer active");
  });
});
