export interface RoomSubscribeMessage { type: "subscribe"; roomId: string; }

export function parseRoomSubscribeMessage(raw: string): RoomSubscribeMessage {
  let message: unknown;
  try { message = JSON.parse(raw); } catch { throw new Error("Invalid realtime message."); }
  if (!message || typeof message !== "object" || (message as { type?: unknown }).type !== "subscribe" || typeof (message as { roomId?: unknown }).roomId !== "string" || !(message as { roomId: string }).roomId.trim()) throw new Error("Invalid room subscription.");
  return { type: "subscribe", roomId: (message as { roomId: string }).roomId.trim() };
}
