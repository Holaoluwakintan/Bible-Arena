import type { Config } from "drizzle-kit";

export default {
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.SQLITE_PATH ?? "./bible_arena_dev.sqlite",
  },
} satisfies Config;
