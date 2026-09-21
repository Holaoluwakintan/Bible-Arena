// ──────────────────────────────────────────────────────────────────
// Friends domain: pure types and utilities (no React-Native deps)
// ──────────────────────────────────────────────────────────────────

export type FriendshipStatus = "pending" | "accepted";

export interface FriendProfile {
  id: number;
  friendId: number;
  friendName: string | null;
  friendOpenId: string;
  since: number;
}

export interface FriendRequest {
  id: number;
  fromId: number;
  fromName: string | null;
  fromOpenId: string;
  sentAt: number;
}

export interface FriendLeaderboardEntry {
  rank: number;
  playerId: number;
  displayName: string;
  totalXp: number;
  currentStreak: number;
  isCurrentUser?: boolean;
}

export interface PlayerSearchResult {
  id: number;
  name: string | null;
  openId: string;
}

/** Display-safe name fallback */
export function getPlayerDisplayName(name: string | null, openId: string): string {
  return name && name.trim().length > 0 ? name : openId.slice(0, 12);
}

/** Sort leaderboard entries by XP descending, recomputing rank */
export function rankFriendLeaderboard(
  entries: Omit<FriendLeaderboardEntry, "rank">[],
): FriendLeaderboardEntry[] {
  return [...entries]
    .sort((a, b) => b.totalXp - a.totalXp)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

/** Returns true if a player search result is already a friend */
export function isAlreadyFriend(
  friendIds: number[],
  candidateId: number,
): boolean {
  return friendIds.includes(candidateId);
}
