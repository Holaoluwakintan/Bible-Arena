import type { IncomingMessage, Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { getMultiplayerRoom } from "./db";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import { logger } from "./_core/logger";
import { subscribeToRoom, unsubscribeFromRooms } from "./realtime";
import { parseRoomSubscribeMessage } from "../domain/realtime-protocol";

const roomSockets = new WeakMap<WebSocket, number>();
const socketIps = new WeakMap<WebSocket, string>();
const connectionsByIp = new Map<string, number>();
const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

type ManagedSocket = WebSocket & { isAlive?: boolean };

function send(socket: WebSocket, message: unknown) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}

function releaseSocket(socket: WebSocket) {
  const ip = socketIps.get(socket);
  if (ip) {
    const remaining = (connectionsByIp.get(ip) ?? 1) - 1;
    if (remaining > 0) connectionsByIp.set(ip, remaining);
    else connectionsByIp.delete(ip);
  }
  unsubscribeFromRooms(socket);
}

async function authenticateUpgrade(request: IncomingMessage) {
  const parsed = new URL(request.url ?? "/", "http://localhost");
  const token = parsed.searchParams.get("token");
  if (token) request.headers.authorization = `Bearer ${token}`;
  return sdk.authenticateRequest(request as never);
}

wss.on("connection", (socket, request) => {
  const managed = socket as ManagedSocket;
  managed.isAlive = true;
  const userId = roomSockets.get(socket);
  const ip = socketIps.get(socket) ?? request.socket.remoteAddress ?? "unknown";
  if (!userId) {
    socket.close(1008, "Authentication required");
    return;
  }
  socket.on("pong", () => { managed.isAlive = true; });
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
  socket.on("close", () => releaseSocket(socket));
  socket.on("error", () => releaseSocket(socket));
  logger.info("realtime_connected", { userId, ip });
  send(socket, { type: "ready" });
});

const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    const managed = socket as ManagedSocket;
    if (managed.isAlive === false) {
      releaseSocket(socket);
      socket.terminate();
      continue;
    }
    managed.isAlive = false;
    socket.ping();
  }
}, 30_000);
heartbeat.unref();

export function attachRealtime(server: Server) {
  server.on("upgrade", async (request, socket, head) => {
    if (!request.url?.startsWith("/ws/rooms")) return;
    const ip = request.socket.remoteAddress ?? "unknown";
    const count = connectionsByIp.get(ip) ?? 0;
    if (count >= ENV.maxWsConnectionsPerIp) {
      socket.write("HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n");
      socket.destroy();
      logger.warn("realtime_connection_rejected", { ip, reason: "per_ip_limit" });
      return;
    }
    try {
      const user = await authenticateUpgrade(request);
      connectionsByIp.set(ip, count + 1);
      wss.handleUpgrade(request, socket, head, (client) => {
        roomSockets.set(client, user.id);
        socketIps.set(client, ip);
        wss.emit("connection", client, request);
      });
    } catch {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      logger.warn("realtime_connection_rejected", { ip, reason: "authentication" });
    }
  });
}
