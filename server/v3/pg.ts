import pg from "pg";

/** Schema holding Bible Arena data (bible_arena in production; a separate schema for local tests). */
export const SCH = /^[a-z_]+$/.test(process.env.BA_SCHEMA || "") ? (process.env.BA_SCHEMA as string) : "bible_arena";

let pool: pg.Pool | null = null;
let tried = false;

/** Postgres pool for durable data (Supabase, schema bible_arena, least-privilege role). Null when not configured. */
export function baPool(): pg.Pool | null {
  if (tried) return pool;
  tried = true;
  const url = process.env.BA_DATABASE_URL;
  if (!url) return null;
  pool = new pg.Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  pool.on("error", () => {});
  return pool;
}
