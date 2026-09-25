import "dotenv/config";
import { randomBytes } from "node:crypto";

const isProduction = process.env.NODE_ENV === "production";

function requiredEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function optionalEnv(key: string, fallback = ""): string {
  return process.env[key]?.trim() || fallback;
}

const cookieSecret = process.env.COOKIE_SECRET?.trim();
if (isProduction && (!cookieSecret || cookieSecret.length < 32)) {
  throw new Error("COOKIE_SECRET must be set to at least 32 characters in production.");
}

export const ENV = {
  isProduction,
  port: parseInt(optionalEnv("PORT", "3000"), 10),
  cookieSecret: cookieSecret || randomBytes(32).toString("hex"),
  databaseUrl: optionalEnv("DATABASE_URL"),
  oAuthServerUrl: optionalEnv("OAUTH_SERVER_URL"),
  appId: isProduction ? requiredEnv("EXPO_PUBLIC_APP_ID") : optionalEnv("EXPO_PUBLIC_APP_ID", "bible-arena-local"),
  ownerOpenId: optionalEnv("OWNER_OPEN_ID"),
  sqlitePath: optionalEnv("SQLITE_PATH", "./bible_arena_dev.sqlite"),
  forgeApiUrl: optionalEnv("BUILT_IN_FORGE_API_URL"),
  forgeApiKey: optionalEnv("BUILT_IN_FORGE_API_KEY"),
  allowedOrigins: optionalEnv("ALLOWED_ORIGINS", "http://localhost:8081,http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  oauthStateSecret: optionalEnv("OAUTH_STATE_SECRET", cookieSecret || ""),
  backupDir: optionalEnv("BACKUP_DIR", "./backups"),
  realtimeBackplane: optionalEnv("REALTIME_BACKPLANE", "local"),
  maxWsConnectionsPerIp: Math.max(1, Number.parseInt(optionalEnv("MAX_WS_CONNECTIONS_PER_IP", "20"), 10) || 20),
} as const;
