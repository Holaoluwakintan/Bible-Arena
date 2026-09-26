import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerGuestAuth } from "./guest-auth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { attachRealtime } from "../ws";
import { ENV } from "./env";
import { rateLimit } from "./rate-limit";
import { logger } from "./logger";
import { checkDatabaseHealth } from "../db";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => server.close(() => resolve(true)));
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) if (await isPortAvailable(port)) return port;
  throw new Error(`No available port found starting from ${startPort}`);
}

export function createApp() {
  const app = express();
  const allowedOrigins = new Set(ENV.allowedOrigins);

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Content-Security-Policy", "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; connect-src 'self' https: ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    if (ENV.isProduction) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
  });
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => logger.info("http_request", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    }));
    next();
  });
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (typeof origin === "string" && allowedOrigins.has(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
      res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Client-Platform");
      res.header("Vary", "Origin");
    }
    if (req.method === "OPTIONS") {
      if (typeof origin === "string" && !allowedOrigins.has(origin)) {
        res.sendStatus(403);
        return;
      }
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "1mb", strict: true }));
  app.use(express.urlencoded({ limit: "256kb", extended: false }));
  app.use("/api", rateLimit({ windowMs: 60_000, max: 240, name: "api" }));

  registerStorageProxy(app);
  registerGuestAuth(app);
  registerOAuthRoutes(app);
  app.get("/api/health", (_req, res) => {
    try {
      checkDatabaseHealth();
      res.setHeader("Cache-Control", "no-store");
      res.json({ ok: true, database: "ok", timestamp: Date.now() });
    } catch {
      res.status(503).json({ ok: false, database: "unavailable", timestamp: Date.now() });
    }
  });
  app.get("/api/ready", (_req, res) => {
    try {
      checkDatabaseHealth();
      res.setHeader("Cache-Control", "no-store");
      res.json({ ready: true });
    } catch {
      res.status(503).json({ ready: false });
    }
  });
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  return app;
}

async function startServer() {
  const app = createApp();
  const server = createServer(app);

  const port = await findAvailablePort(ENV.port);
  if (port !== ENV.port) logger.warn("configured_port_busy", { configuredPort: ENV.port, selectedPort: port });
  server.listen(port, () => logger.info("server_started", { port, realtimeBackplane: ENV.realtimeBackplane }));
  attachRealtime(server);
}

if (process.env.NODE_ENV !== "test") {
  startServer().catch((error) => {
    logger.error("server_start_failed", { error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  });
}
