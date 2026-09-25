import { DatabaseSync } from "node:sqlite";
import { ENV } from "../server/_core/env";
import { applyMigrations } from "../server/migrations";

const db = new DatabaseSync(ENV.sqlitePath);
applyMigrations(db);
db.close();
console.log(`Database migrated: ${ENV.sqlitePath}`);
