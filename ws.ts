import type { IncomingMessage, Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { getMultiplayerRoom } from "./db";
import { sdk } from "./_core/sdk";
import { subscribeToRoom, unsubscribeFromRooms } from "./realtime";
import { parseRoomSubscribeMessage } from "../domain/realtime-protocol";

const roomSockets = new WeakMap<WebSocket, number>();
const wss = new WebSocketServer({ noServer: true });

function send(socket: WebSocket, message: unknown) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}

async function authenticateUpgrade(request: IncomingMessage) {
  const parsed = new URL(request.url ?? "/", "http://localhost");
  const token = parsed.searchParams.get("token");
  if (token) request.headers.authorization = `Bearer ${token}`;
  return sdk.authenticateRequest(request as never);
}

wss.on("connection", (socket, request) => {
  const userId = roomSockets.get(socket);
  if (!userId) { socket.close(1008, "Authentication required"); return; }
  socket.on("message", async (raw) => {
    try {
      const message = parseRoomSubscribeMessage(raw.toString());
      const room = await getMultiplayerRoom(message.roomId);
      if (!room || (room.hostUserId !== userId && room.guestUserId !== userId)) throw new Error("Room not found.");
      subscribeToRoom(room.id, socket);
      send(socket, { type: "room", room });
    } catch (error) {
      send(socket, { type: "error", message: error instanceof Error ? error.message : "Subscription failed." });
    }
  });
  socket.on("close", () => unsubscribeFromRooms(socket));
  socket.on("error", () => unsubscribeFromRooms(socket));
  send(socket, { type: "ready" });
});

export function attachRealtime(server: Server) {
  server.on("upgrade", async (request, socket, head) => {
    if (!request.url?.startsWith("/ws/rooms")) return;
    try {
      const user = await authenticateUpgrade(request);
      wss.handleUpgrade(request, socket, head, (client) => {
        roomSockets.set(client, user.id);
        wss.emit("connection", client, request);
      });
    } catch {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
    }
  });
}
