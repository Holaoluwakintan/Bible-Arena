export type RoomStatus = "lobby" | "playing" | "complete";
export const MULTIPLAYER_ROUND_DURATION_MS = 20_000;

export interface MultiplayerRoomState {
  hostUserId: number;
  guestUserId: number | null;
  status: RoomStatus;
  currentQuestionIndex: number;
  hostReady: number;
  guestReady: number;
  hostAnsweredIndex: number;
  guestAnsweredIndex: number;
  hostScore: number;
  guestScore: number;
  winnerUserId: number | null;
  roundToken?: string;
  roundDeadline?: Date | null;
}

function assertMember(room: MultiplayerRoomState, userId: number) {
  if (room.hostUserId !== userId && room.guestUserId !== userId) throw new Error("You are not in this room.");
}
function scoreWinner(room: MultiplayerRoomState, hostScore = room.hostScore, guestScore = room.guestScore) {
  return hostScore === guestScore ? null : hostScore > guestScore ? room.hostUserId : room.guestUserId;
}

export function getRoomReadyPatch(room: MultiplayerRoomState, userId: number, ready: boolean) {
  assertMember(room, userId);
  const isHost = room.hostUserId === userId;
  const hostReady = isHost ? ready : room.hostReady === 1;
  const guestReady = isHost ? room.guestReady === 1 : ready;
  return { ...(isHost ? { hostReady: ready ? 1 : 0 } : { guestReady: ready ? 1 : 0 }), ...(hostReady && guestReady && room.guestUserId ? { status: "playing" as const } : {}) };
}

export function assertActiveRound(room: MultiplayerRoomState, providedToken: string, now: Date) {
  if (room.status !== "playing") throw new Error("Room is not currently playing.");
  if (!providedToken || providedToken !== room.roundToken) throw new Error("This round token is invalid.");
  if (!room.roundDeadline || room.roundDeadline.getTime() <= now.getTime()) throw new Error("This round has expired.");
}

export function resolveRoomAnswer(room: MultiplayerRoomState, userId: number, questionIndex: number, answerId: string | null, correctAnswer: string, questionCount: number, providedToken = room.roundToken ?? "", now = new Date(), nextToken = providedToken, nextDeadline = new Date(now.getTime() + MULTIPLAYER_ROUND_DURATION_MS)) {
  assertMember(room, userId);
  assertActiveRound(room, providedToken, now);
  if (questionIndex !== room.currentQuestionIndex) throw new Error("This question is no longer active.");
  const isHost = room.hostUserId === userId;
  const alreadyAnswered = isHost ? room.hostAnsweredIndex === questionIndex : room.guestAnsweredIndex === questionIndex;
  if (alreadyAnswered) throw new Error("Answer already submitted.");
  const isCorrect = answerId === correctAnswer;
  const hostScore = room.hostScore + (isHost && isCorrect ? 100 : 0);
  const guestScore = room.guestScore + (!isHost && isCorrect ? 100 : 0);
  const otherAnswered = isHost ? room.guestAnsweredIndex === questionIndex : room.hostAnsweredIndex === questionIndex;
  const complete = otherAnswered && questionIndex >= questionCount - 1;
  const advance = otherAnswered && !complete;
  return { isCorrect, questionCount, completed: complete, patch: { ...(isHost ? { hostAnsweredIndex: questionIndex, hostScore } : { guestAnsweredIndex: questionIndex, guestScore }), ...(advance ? { currentQuestionIndex: questionIndex + 1, hostAnsweredIndex: -1, guestAnsweredIndex: -1, roundToken: nextToken, roundDeadline: nextDeadline } : {}), ...(complete ? { status: "complete" as const, winnerUserId: scoreWinner(room, hostScore, guestScore), roundToken: "", roundDeadline: null } : {}) } };
}

export function getTimeoutPatch(room: MultiplayerRoomState, nextToken: string, nextDeadline: Date, questionCount: number, now = new Date(), providedToken = room.roundToken ?? "") {
  if (room.status !== "playing") throw new Error("Room is not currently playing.");
  if (!providedToken || providedToken !== room.roundToken) throw new Error("This round token is invalid.");
  if (!room.roundDeadline || room.roundDeadline.getTime() > now.getTime()) throw new Error("This round is still active.");
  const complete = room.currentQuestionIndex >= questionCount - 1;
  return { completed: complete, patch: complete ? { status: "complete" as const, winnerUserId: scoreWinner(room), roundToken: "", roundDeadline: null } : { currentQuestionIndex: room.currentQuestionIndex + 1, hostAnsweredIndex: -1, guestAnsweredIndex: -1, roundToken: nextToken, roundDeadline: nextDeadline } };
}

export function getRematchPatch(room: MultiplayerRoomState, userId: number) {
  assertMember(room, userId);
  if (room.status !== "complete") throw new Error("The current match is not complete.");
  return { status: "lobby" as const, currentQuestionIndex: 0, hostReady: 0, guestReady: 0, hostAnsweredIndex: -1, guestAnsweredIndex: -1, hostScore: 0, guestScore: 0, winnerUserId: null, roundToken: "", roundDeadline: null };
}

export function getMatchXp(room: MultiplayerRoomState): { hostXp: number; guestXp: number } {
  if (room.winnerUserId === null) return { hostXp: 75, guestXp: 75 };
  return room.winnerUserId === room.hostUserId ? { hostXp: 100, guestXp: 50 } : { hostXp: 50, guestXp: 100 };
}
