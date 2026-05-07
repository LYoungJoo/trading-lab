import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

// Ensure the db directory exists
const dbDir = path.join(process.cwd(), 'db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'sqlite.db');

// Singleton pattern to avoid multiple connections in Next.js dev mode
const globalForDb = global as typeof global & {
  _db?: ReturnType<typeof drizzle>;
  _sqlite?: Database.Database;
};

function createConnection() {
  const sqlite = new Database(dbPath);
  // Enable WAL mode for better concurrent read performance
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  // Apply pending migrations automatically on startup
  migrate(db, { migrationsFolder: path.join(process.cwd(), 'lib/db/migrations') });
  return { sqlite, db };
}

if (!globalForDb._db) {
  const { sqlite, db } = createConnection();
  globalForDb._sqlite = sqlite;
  globalForDb._db = db;
}

export const db = globalForDb._db!;
export const sqlite = globalForDb._sqlite!;
