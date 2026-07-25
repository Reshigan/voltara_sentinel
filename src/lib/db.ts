import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export type DB = Database.Database;

export function initDb(path: string): DB {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('journal_size_limit = 67108864');
  return db;
}

export function runMigrations(db: DB, migrationsDir: string): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const applied = db.prepare('SELECT 1 FROM _migrations WHERE filename = ?').get(file);
    if (applied) continue;

    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    db.exec(sql);
    db.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(file);
  }
}

export function closeDb(db: DB): void {
  db.close();
}
