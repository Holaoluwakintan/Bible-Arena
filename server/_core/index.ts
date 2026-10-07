import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerGoogleOAuth } from "./google-oauth";
import path from "node:path";
import fs from "node:fs";
import { registerGuestAuth } from "./guest-auth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { attachRealtime } from "../ws";
import { ENV } from "./env";
import { rateLimit } from "./rate-limit";
import { logger } from "./logger";
import { getOperationalMetrics, recordDatabaseHealth, recordHttpRequest } from "./metrics";
import { checkDatabaseHealth } from "../db";
import { registerV3 } from "../v3";
import { restoreSnapshot, startPersistence, persistenceStatus } from "../persist";

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
    res.on("finish", () => recordHttpRequest(res.statusCode, Date.now() - startedAt));
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
  registerGoogleOAuth(app);
  registerOAuthRoutes(app);
  app.get("/api/health", (_req, res) => {
    try {
      checkDatabaseHealth();
      recordDatabaseHealth(true);
      res.setHeader("Cache-Control", "no-store");
      res.json({ ok: true, database: "ok", persistence: persistenceStatus(), timestamp: Date.now() });
    } catch {
      recordDatabaseHealth(false);
      res.status(503).json({ ok: false, database: "unavailable", timestamp: Date.now() });
    }
  });
  app.get("/api/ready", (_req, res) => {
    try {
      checkDatabaseHealth();
      recordDatabaseHealth(true);
      res.setHeader("Cache-Control", "no-store");
      res.json({ ready: true });
    } catch {
      recordDatabaseHealth(false);
      res.status(503).json({ ready: false });
    }
  });
  app.get("/api/ops/metrics", (req, res) => {
    if (!ENV.opsMetricsToken || req.headers.authorization !== `Bearer ${ENV.opsMetricsToken}`) {
      res.sendStatus(404);
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.json(getOperationalMetrics());
  });

  // Android app (Trusted Web Activity): Digital Asset Links so the app opens full screen with no URL bar.
  const androidPackage = process.env.ANDROID_PACKAGE_NAME || "com.holaoluwakintan.biblearena";
  const androidCertSha256 = (process.env.ANDROID_CERT_SHA256 || "C7:DB:5D:12:4B:86:E5:4F:F7:42:F0:0F:7E:EE:DC:A6:2E:FF:9F:81:2A:A8:05:8E:95:39:EC:63:39:A3:B6:29")
    .split(",").map((s) => s.trim()).filter(Boolean);
  app.get("/.well-known/assetlinks.json", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: { namespace: "android_app", package_name: androidPackage, sha256_cert_fingerprints: androidCertSha256 },
      },
    ]);
  });
  // Android APK download: hosted on a CDN so app updates never need a server redeploy.
  const apkUrl = process.env.ANDROID_APK_URL || "https://bible-arena-app.vercel.app/bible-arena.apk";
  app.get(["/download", "/download/bible-arena.apk", "/app", "/android"], (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.redirect(302, apkUrl);
  });
  // Bible Arena v3: the fast web game (static files in web-v3) and its API. Registered before the
  // classic Expo web app so "/" and "/d/:code" serve v3; the classic screens keep their own routes.
  app.use("/v3", express.static(path.resolve(process.env.V3_WEB_DIR || "web-v3"), { index: false, maxAge: "1h" }));
  registerV3(app);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  // Serve the exported Expo web app (npx expo export --platform web -> dist-web) from the same origin.
  const webDir = path.resolve(process.env.WEB_DIST_DIR || "dist-web");
  if (fs.existsSync(path.join(webDir, "index.html"))) {
    app.use(express.static(webDir, { index: "index.html", extensions: ["html"], maxAge: "1h" }));
    app.get(/^\/(?!api\/|ws\/).*/, (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(webDir, "index.html"));
    });
  }
  return app;
}

async function startServer() {
  const app = createApp();
  const server = createServer(app);

  await restoreSnapshot();
  startPersistence();
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
