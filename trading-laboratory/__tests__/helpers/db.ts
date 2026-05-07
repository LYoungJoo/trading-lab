import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';

const DDL = `
  CREATE TABLE IF NOT EXISTS experiments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    config TEXT NOT NULL,
    execution_log TEXT,
    created_at INTEGER NOT NULL,
    completed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS market_data (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    open REAL NOT NULL,
    high REAL NOT NULL,
    low REAL NOT NULL,
    close REAL NOT NULL,
    volume REAL NOT NULL,
    provider TEXT NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS market_data_lookup_idx
    ON market_data (symbol, timeframe, timestamp);

  CREATE TABLE IF NOT EXISTS download_jobs (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    provider TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    total_rows INTEGER,
    inserted_rows INTEGER DEFAULT 0,
    error_message TEXT,
    created_at INTEGER NOT NULL,
    completed_at INTEGER
  );
`;

export function makeTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.exec(DDL);
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}
