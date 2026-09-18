import "dotenv/config";

function optionalEnv(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

export const ENV = {
  port: parseInt(optionalEnv("PORT", "3000")),
  cookieSecret: optionalEnv("COOKIE_SECRET", "local-dev-secret-change-in-production-please"),
  databaseUrl: optionalEnv("DATABASE_URL"),
  oAuthServerUrl: optionalEnv("OAUTH_SERVER_URL"),
  appId: optionalEnv("EXPO_PUBLIC_APP_ID", "bible-arena-local"),
  ownerOpenId: optionalEnv("OWNER_OPEN_ID"),
  sqlitePath: optionalEnv("SQLITE_PATH", "./bible_arena_dev.sqlite"),
  forgeApiUrl: optionalEnv("BUILT_IN_FORGE_API_URL"),
  forgeApiKey: optionalEnv("BUILT_IN_FORGE_API_KEY"),
} as const;
