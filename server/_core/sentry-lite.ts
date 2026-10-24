// Minimal error reporting to Sentry (free Developer plan), no extra npm packages.
// Off unless SENTRY_DSN is set, e.g. SENTRY_DSN=https://<publicKey>@o123456.ingest.sentry.io/7890123
import crypto from "node:crypto";
import type { Express, NextFunction, Request, Response } from "express";

type Dsn = { key: string; host: string; projectId: string; protocol: string };

function parseDsn(raw?: string): Dsn | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const projectId = u.pathname.replace(/^\//, "");
    if (!u.username || !projectId) return null;
    return { key: u.username, host: u.host, projectId, protocol: u.protocol };
  } catch {
    return null;
  }
}

const DSN = parseDsn(process.env.SENTRY_DSN);
const RELEASE = process.env.SENTRY_RELEASE || "bible-arena@3.11.1";
const ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || (process.env.NODE_ENV === "production" ? "production" : "development");
let sentThisMinute = 0;
setInterval(() => { sentThisMinute = 0; }, 60_000).unref();

function frames(stack?: string) {
  if (!stack) return [];
  return stack.split("\n").slice(1, 40).reverse().map((line) => {
    const m = line.match(/at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/);
    return m ? { function: m[1] || "?", filename: m[2], lineno: +m[3], colno: +m[4], in_app: !m[2].includes("node_modules") } : { function: line.trim() };
  });
}

export function captureError(error: unknown, extra: Record<string, unknown> = {}) {
  if (!DSN || sentThisMinute >= 30) return; // stay well inside the free quota
  sentThisMinute++;
  const err = error instanceof Error ? error : new Error(String(error));
  const eventId = crypto.randomUUID().replace(/-/g, "");
  const event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: "node",
    level: "error",
    release: RELEASE,
    environment: ENVIRONMENT,
    server_name: process.env.RENDER_SERVICE_NAME || "bible-arena",
    exception: { values: [{ type: err.name, value: err.message, stacktrace: { frames: frames(err.stack) } }] },
    extra,
  };
  const envelope = `${JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() })}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}`;
  const url = `${DSN.protocol}//${DSN.host}/api/${DSN.projectId}/envelope/`;
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-sentry-envelope",
      "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=bible-arena-lite/1.0, sentry_key=${DSN.key}`,
    },
    body: envelope,
  }).catch(() => {});
}

/** Browser side: Sentry's lazy Loader Script (loads the SDK only when an error happens). */
export function sentryBrowserTags(): string {
  if (!DSN) return "";
  const cfg = JSON.stringify({ release: RELEASE, environment: ENVIRONMENT, sampleRate: 1 });
  return `<script>window.sentryOnLoad=function(){Sentry.init(${cfg})};</script>` +
    `<script src="https://js.sentry-cdn.com/${DSN.key}.min.js" crossorigin="anonymous"></script>`;
}

export function installErrorReporting(app: Express) {
  if (!DSN) return;
  process.on("uncaughtException", (e) => captureError(e, { kind: "uncaughtException" }));
  process.on("unhandledRejection", (e) => captureError(e, { kind: "unhandledRejection" }));
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    captureError(err, { method: req.method, path: req.path });
    next(err);
  });
}

export const errorReportingEnabled = !!DSN;
