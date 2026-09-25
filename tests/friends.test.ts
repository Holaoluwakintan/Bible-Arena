import { describe, expect, it } from "vitest";
import {
  getPlayerDisplayName,
  isAlreadyFriend,
  rankFriendLeaderboard,
} from "../domain/friends";

describe("Friends Domain Engine", () => {
  it("formats player display name with fallback to openId", () => {
    expect(getPlayerDisplayName("David", "user_123456789")).toBe("David");
    expect(getPlayerDisplayName(null, "guest_987654321")).toBe("guest_987654");
    expect(getPlayerDisplayName("   ", "guest_987654321")).toBe("guest_987654");
  });

  it("ranks friend leaderboard entries by XP descending", () => {
    const raw = [
      { playerId: 1, displayName: "Sarah", totalXp: 850, currentStreak: 3 },
      { playerId: 2, displayName: "Peter", totalXp: 2100, currentStreak: 12 },
      { playerId: 3, displayName: "Hannah", totalXp: 1400, currentStreak: 5 },
    ];
    const ranked = rankFriendLeaderboard(raw);

    expect(ranked[0].displayName).toBe("Peter");
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].displayName).toBe("Hannah");
    expect(ranked[1].rank).toBe(2);
    expect(ranked[2].displayName).toBe("Sarah");
    expect(ranked[2].rank).toBe(3);
  });

  it("identifies if a player is already a friend", () => {
    const friends = [10, 25, 42];
    expect(isAlreadyFriend(friends, 25)).toBe(true);
    expect(isAlreadyFriend(friends, 99)).toBe(false);
  });
});
