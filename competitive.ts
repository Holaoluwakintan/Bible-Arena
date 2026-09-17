import type { GameMode } from "./questions";

export type ChallengeStatus = "open" | "completed" | "expired";

export interface FriendChallenge {
  id: string;
  shareCode: string;
  creatorName: string;
  opponentName?: string;
  mode: GameMode;
  status: ChallengeStatus;
  createdAt: number;
  expiresAt: number;
}

function hashToCode(value: string): string {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return String(hash % 1_000_000).padStart(6, "0");
}

export function createFriendChallenge(input: { creatorName: string; mode: GameMode; createdAt?: number }): FriendChallenge {
  const createdAt = input.createdAt ?? Date.now();
  const id = `challenge-${createdAt}-${hashToCode(`${input.creatorName}:${input.mode}:${createdAt}`)}`;
  return {
    id,
    shareCode: hashToCode(id),
    creatorName: input.creatorName,
    mode: input.mode,
    status: "open",
    createdAt,
    expiresAt: createdAt + 7 * 86_400_000,
  };
}

export function joinFriendChallenge(challenge: FriendChallenge, opponentName: string, now = Date.now()): FriendChallenge {
  if (challenge.status !== "open") throw new Error("This challenge is no longer open.");
  if (now >= challenge.expiresAt) throw new Error("This challenge has expired.");
  return { ...challenge, opponentName, status: "completed" };
}

export function getChallengeStatus(challenge: FriendChallenge, now = Date.now()): ChallengeStatus {
  if (challenge.status === "open" && now >= challenge.expiresAt) return "expired";
  return challenge.status;
}
