import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { ENV } from "../server/_core/env";

const source = resolve(ENV.sqlitePath);
const targetDir = resolve(ENV.backupDir);
const retention = Math.max(1, Number.parseInt(process.env.BACKUP_RETENTION ?? "7", 10) || 7);

mkdirSync(targetDir, { recursive: true });
const filename = `bible-arena-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`;
const target = join(targetDir, filename);
const db = new DatabaseSync(source, { readOnly: true });
try {
  db.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
} finally {
  db.close();
}

const backups = readdirSync(targetDir)
  .filter((file) => file.startsWith("bible-arena-") && file.endsWith(".sqlite"))
  .map((file) => ({ file, mtime: statSync(join(targetDir, file)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);
for (const old of backups.slice(retention)) unlinkSync(join(targetDir, old.file));
console.log(JSON.stringify({ event: "database_backup_created", source, target, retention }));
