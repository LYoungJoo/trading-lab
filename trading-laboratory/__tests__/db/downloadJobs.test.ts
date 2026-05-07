import { describe, it, expect, beforeEach, vi } from 'vitest';

const ctx = vi.hoisted(() => ({ sqlite: null as import('better-sqlite3').Database | null }));

vi.mock('@/lib/db', async () => {
  const { default: Database } = await import('better-sqlite3');
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const schema = await import('@/lib/db/schema');

  const sqlite = new Database(':memory:');
  sqlite.exec(`
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
  `);

  ctx.sqlite = sqlite;
  return { db: drizzle(sqlite, { schema }) };
});

import {
  createDownloadJob,
  updateDownloadJob,
  getDownloadJob,
  listDownloadJobs,
} from '@/lib/db/queries';

const JOB = {
  symbol: 'AAPL',
  provider: 'yahoo',
  timeframe: '1d',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
};

function makeJob(overrides?: Partial<typeof JOB>) {
  const j = { ...JOB, ...overrides };
  return createDownloadJob(j.symbol, j.provider, j.timeframe, j.startDate, j.endDate);
}

beforeEach(() => {
  ctx.sqlite!.exec('DELETE FROM download_jobs');
});

describe('createDownloadJob', () => {
  it('returns a non-empty string id', () => {
    const id = makeJob();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('creates a job with pending status and correct fields', () => {
    const id = makeJob();
    const job = getDownloadJob(id);
    expect(job).not.toBeNull();
    expect(job!.symbol).toBe('AAPL');
    expect(job!.provider).toBe('yahoo');
    expect(job!.timeframe).toBe('1d');
    expect(job!.startDate).toBe('2024-01-01');
    expect(job!.endDate).toBe('2024-12-31');
    expect(job!.status).toBe('pending');
    expect(job!.insertedRows).toBe(0);
  });

  it('generates unique ids for each call', () => {
    const id1 = makeJob();
    const id2 = makeJob();
    expect(id1).not.toBe(id2);
  });
});

describe('updateDownloadJob', () => {
  it('updates status', () => {
    const id = makeJob();
    updateDownloadJob(id, { status: 'running' });
    expect(getDownloadJob(id)!.status).toBe('running');
  });

  it('updates insertedRows', () => {
    const id = makeJob();
    updateDownloadJob(id, { insertedRows: 42 });
    expect(getDownloadJob(id)!.insertedRows).toBe(42);
  });

  it('updates errorMessage', () => {
    const id = makeJob();
    updateDownloadJob(id, { status: 'failed', errorMessage: 'Network timeout' });
    const job = getDownloadJob(id);
    expect(job!.status).toBe('failed');
    expect(job!.errorMessage).toBe('Network timeout');
  });

  it('updates completedAt', () => {
    const id = makeJob();
    const ts = 1_700_000_000_000;
    updateDownloadJob(id, { status: 'complete', completedAt: ts });
    expect(getDownloadJob(id)!.completedAt).toBe(ts);
  });

  it('partial update only changes specified fields', () => {
    const id = makeJob();
    updateDownloadJob(id, { totalRows: 100 });
    const job = getDownloadJob(id);
    expect(job!.totalRows).toBe(100);
    expect(job!.status).toBe('pending');
  });
});

describe('getDownloadJob', () => {
  it('returns job by id', () => {
    const id = makeJob();
    const job = getDownloadJob(id);
    expect(job).not.toBeNull();
    expect(job!.id).toBe(id);
  });

  it('returns null for unknown id', () => {
    expect(getDownloadJob('nonexistent-id')).toBeNull();
  });
});

describe('listDownloadJobs', () => {
  it('returns empty array when no jobs', () => {
    expect(listDownloadJobs()).toEqual([]);
  });

  it('returns all created jobs', () => {
    makeJob({ symbol: 'AAPL' });
    makeJob({ symbol: 'GOOG' });
    expect(listDownloadJobs()).toHaveLength(2);
  });

  it('orders by createdAt descending (newest first)', () => {
    const id1 = makeJob({ symbol: 'AAPL' });
    ctx.sqlite!.prepare('UPDATE download_jobs SET created_at = ? WHERE id = ?').run(1000, id1);
    const id2 = makeJob({ symbol: 'GOOG' });
    ctx.sqlite!.prepare('UPDATE download_jobs SET created_at = ? WHERE id = ?').run(2000, id2);

    const jobs = listDownloadJobs();
    expect(jobs[0].id).toBe(id2);
    expect(jobs[1].id).toBe(id1);
  });

  it('limits to 50 jobs', () => {
    for (let i = 0; i < 55; i++) {
      makeJob({ symbol: `SYM${i}` });
    }
    expect(listDownloadJobs()).toHaveLength(50);
  });
});
