import { describe, it, expect, beforeEach, vi } from 'vitest';

// vi.hoisted ensures this runs before vi.mock factories (avoiding TDZ)
const ctx = vi.hoisted(() => ({ sqlite: null as import('better-sqlite3').Database | null }));

vi.mock('@/lib/db', async () => {
  const { default: Database } = await import('better-sqlite3');
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const schema = await import('@/lib/db/schema');

  const sqlite = new Database(':memory:');
  sqlite.exec(`
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
  `);

  ctx.sqlite = sqlite;
  return { db: drizzle(sqlite, { schema }) };
});

import {
  insertMarketDataBatch,
  getDatasetSummary,
  getCandles,
  deleteMarketData,
} from '@/lib/db/queries';

const BASE_ROW = {
  symbol: 'AAPL',
  timeframe: '1d',
  open: 100,
  high: 110,
  low: 95,
  close: 105,
  volume: 1_000_000,
  provider: 'yahoo',
};

function makeRows(count: number, baseTs = 1_000_000_000_000) {
  return Array.from({ length: count }, (_, i) => ({
    ...BASE_ROW,
    timestamp: baseTs + i * 86_400_000,
  }));
}

beforeEach(() => {
  ctx.sqlite!.exec('DELETE FROM market_data');
});

describe('insertMarketDataBatch', () => {
  it('inserts rows and returns inserted count', () => {
    const rows = makeRows(3);
    const count = insertMarketDataBatch(rows);
    expect(count).toBe(3);
  });

  it('returns 0 for empty input', () => {
    expect(insertMarketDataBatch([])).toBe(0);
  });

  it('ignores duplicate (symbol, timeframe, timestamp) tuples', () => {
    const rows = makeRows(3);
    insertMarketDataBatch(rows);
    const second = insertMarketDataBatch(rows);
    expect(second).toBe(0);
  });

  it('only inserts non-duplicate rows on mixed input', () => {
    const rows = makeRows(3);
    insertMarketDataBatch(rows);
    const newRows = [
      ...rows,
      { ...BASE_ROW, timestamp: 9_000_000_000_000 },
    ];
    const count = insertMarketDataBatch(newRows);
    expect(count).toBe(1);
  });

  it('handles large batches spanning chunk boundary (>3000 rows)', () => {
    const rows = makeRows(3001);
    const count = insertMarketDataBatch(rows);
    expect(count).toBe(3001);
  });
});

describe('getDatasetSummary', () => {
  it('returns empty array when no data', () => {
    expect(getDatasetSummary()).toEqual([]);
  });

  it('groups by symbol / provider / timeframe and returns rowCount + dates', () => {
    insertMarketDataBatch([
      { ...BASE_ROW, timestamp: 1_000_000_000_000 },
      { ...BASE_ROW, timestamp: 1_086_400_000_000 },
    ]);
    const summary = getDatasetSummary();
    expect(summary).toHaveLength(1);
    expect(summary[0].symbol).toBe('AAPL');
    expect(summary[0].provider).toBe('yahoo');
    expect(summary[0].timeframe).toBe('1d');
    expect(summary[0].rowCount).toBe(2);
    expect(summary[0].minDate).toBe(new Date(1_000_000_000_000).toISOString().split('T')[0]);
    expect(summary[0].maxDate).toBe(new Date(1_086_400_000_000).toISOString().split('T')[0]);
  });

  it('returns separate rows for different timeframes', () => {
    insertMarketDataBatch([
      { ...BASE_ROW, timeframe: '1d', timestamp: 1_000_000_000_000 },
      { ...BASE_ROW, timeframe: '1h', timestamp: 2_000_000_000_000 },
    ]);
    const summary = getDatasetSummary();
    expect(summary).toHaveLength(2);
  });

  it('returns separate rows for different providers', () => {
    insertMarketDataBatch([
      { ...BASE_ROW, provider: 'yahoo', timestamp: 1_000_000_000_000 },
      { ...BASE_ROW, provider: 'binance', timeframe: '1h', timestamp: 2_000_000_000_000 },
    ]);
    const summary = getDatasetSummary();
    const providers = summary.map((s) => s.provider).sort();
    expect(providers).toEqual(['binance', 'yahoo']);
  });
});

describe('getCandles', () => {
  beforeEach(() => {
    insertMarketDataBatch([
      { ...BASE_ROW, timestamp: 1_000_000_000_000 },
      { ...BASE_ROW, timestamp: 1_086_400_000_000 },
      { ...BASE_ROW, timestamp: 1_172_800_000_000 },
    ]);
  });

  it('returns all candles within range', () => {
    const candles = getCandles('AAPL', '1d', 1_000_000_000_000, 1_172_800_000_000);
    expect(candles).toHaveLength(3);
  });

  it('filters by startMs (inclusive)', () => {
    const candles = getCandles('AAPL', '1d', 1_086_400_000_000, 1_172_800_000_000);
    expect(candles).toHaveLength(2);
    expect(candles[0].timestamp).toBe(1_086_400_000_000);
  });

  it('filters by endMs (inclusive)', () => {
    const candles = getCandles('AAPL', '1d', 1_000_000_000_000, 1_086_400_000_000);
    expect(candles).toHaveLength(2);
  });

  it('returns empty array when no candles in range', () => {
    const candles = getCandles('AAPL', '1d', 9_000_000_000_000, 9_999_999_999_999);
    expect(candles).toHaveLength(0);
  });

  it('filters by symbol', () => {
    insertMarketDataBatch([{ ...BASE_ROW, symbol: 'GOOG', timestamp: 1_000_000_000_001 }]);
    const candles = getCandles('GOOG', '1d', 0, 9_999_999_999_999);
    expect(candles).toHaveLength(1);
    expect(candles[0].timestamp).toBe(1_000_000_000_001);
  });

  it('filters by timeframe', () => {
    insertMarketDataBatch([{ ...BASE_ROW, timeframe: '1h', timestamp: 1_000_000_000_001 }]);
    const candles = getCandles('AAPL', '1h', 0, 9_999_999_999_999);
    expect(candles).toHaveLength(1);
  });

  it('returns candles with correct OHLCV shape', () => {
    const [c] = getCandles('AAPL', '1d', 1_000_000_000_000, 1_000_000_000_000);
    expect(c).toMatchObject({
      timestamp: 1_000_000_000_000,
      open: 100,
      high: 110,
      low: 95,
      close: 105,
      volume: 1_000_000,
    });
  });

  it('returns candles ordered by timestamp ascending', () => {
    const candles = getCandles('AAPL', '1d', 0, 9_999_999_999_999);
    const timestamps = candles.map((c) => c.timestamp);
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
  });
});

describe('deleteMarketData', () => {
  it('deletes rows for the given symbol+provider and returns deleted count', () => {
    insertMarketDataBatch(makeRows(3));
    const deleted = deleteMarketData('AAPL', 'yahoo');
    expect(deleted).toBe(3);
    expect(getDatasetSummary()).toHaveLength(0);
  });

  it('returns 0 when nothing to delete', () => {
    expect(deleteMarketData('NOTEXIST', 'yahoo')).toBe(0);
  });

  it('only deletes rows matching both symbol AND provider', () => {
    insertMarketDataBatch([
      { ...BASE_ROW, provider: 'yahoo', timestamp: 1_000_000_000_000 },
      { ...BASE_ROW, provider: 'binance', timeframe: '1h', timestamp: 2_000_000_000_000 },
    ]);
    deleteMarketData('AAPL', 'yahoo');
    const summary = getDatasetSummary();
    expect(summary).toHaveLength(1);
    expect(summary[0].provider).toBe('binance');
  });
});
