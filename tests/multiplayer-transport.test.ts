import { describe, expect, it } from "vitest";

import { aggregateMultiplayerRankings, getRankedDivision } from "../domain/multiplayer-rankings";
import { parseRoomSubscribeMessage } from "../domain/realtime-protocol";

describe("Bible Arena realtime and multiplayer rankings", () => {
  it("validates room subscription messages", () => {
    expect(parseRoomSubscribeMessage('{"type":"subscribe","roomId":" room-1 "}')).toEqual({ type: "subscribe", roomId: "room-1" });
    expect(() => parseRoomSubscribeMessage("not json")).toThrow("Invalid realtime message");
    expect(() => parseRoomSubscribeMessage('{"type":"subscribe","roomId":""}')).toThrow("Invalid room subscription");
  });

  it("ranks players by wins, then XP, then match count", () => {
    const rows = aggregateMultiplayerRankings([
      { hostUserId: 1, guestUserId: 2, hostXp: 100, guestXp: 50, winnerUserId: 1 },
      { hostUserId: 2, guestUserId: 3, hostXp: 75, guestXp: 75, winnerUserId: null },
      { hostUserId: 1, guestUserId: 3, hostXp: 100, guestXp: 50, winnerUserId: 1 },
    ], new Map([[1, "Ada"], [2, "Ben"], [3, "Cy"]]));
    expect(rows[0]).toMatchObject({ playerId: "1", displayName: "Ada", wins: 2, losses: 0, draws: 0, xp: 200, rank: 1 });
    expect(rows[1]).toMatchObject({ playerId: "2", wins: 0, losses: 1, draws: 1, xp: 125 });
    expect(rows[2]).toMatchObject({ playerId: "3", wins: 0, losses: 1, draws: 1, xp: 125 });
  });

  it("assigns ranked divisions from multiplayer points", () => {
    expect(getRankedDivision(0, 0)).toBe("Bronze");
    expect(getRankedDivision(1, 0)).toBe("Silver");
    expect(getRankedDivision(3, 0)).toBe("Gold");
    expect(getRankedDivision(5, 0)).toBe("Platinum");
    expect(getRankedDivision(9, 0)).toBe("Diamond");
  });
});
