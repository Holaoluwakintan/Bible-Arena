import type { WebSocket } from "ws";

const subscribers = new Map<string, Set<WebSocket>>();

export function subscribeToRoom(roomId: string, socket: WebSocket) {
  const roomSubscribers = subscribers.get(roomId) ?? new Set<WebSocket>();
  roomSubscribers.add(socket);
  subscribers.set(roomId, roomSubscribers);
}

export function unsubscribeFromRooms(socket: WebSocket) {
  for (const [roomId, roomSubscribers] of subscribers) {
    roomSubscribers.delete(socket);
    if (roomSubscribers.size === 0) subscribers.delete(roomId);
  }
}

export function broadcastRoom(roomId: string, room: unknown) {
  const payload = JSON.stringify({ type: "room", room });
  for (const socket of subscribers.get(roomId) ?? []) {
    if (socket.readyState === socket.OPEN) socket.send(payload);
  }
}
