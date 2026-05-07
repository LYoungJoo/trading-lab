import type { DataProvider, DownloadRequest, ProviderCandle, ProviderInfo } from './types';

const BASE_URL = 'https://api.binance.com/api/v3';

// Binance stores full history for all timeframes back to each symbol's listing date.
// The 1000-candle-per-request limit is handled by pagination in fetchCandles.
const MAX_HISTORY_DAYS: Record<string, number> = {
  '1m': 36500,
  '5m': 36500,
  '15m': 36500,
  '1h': 36500,
  '4h': 36500,
  '1d': 36500,
  '1w': 36500,
};

const INTERVAL_MAP: Record<string, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
  '1w': '1w',
};

const TIMEFRAME_NOTES: Record<string, string> = {
  '1m': 'Full history available (paginated)',
  '5m': 'Full history available (paginated)',
  '15m': 'Full history available (paginated)',
  '1h': 'Full history available (paginated)',
  '4h': 'Full history available (paginated)',
  '1d': 'Full history available',
  '1w': 'Full history available',
};

const info: ProviderInfo = {
  id: 'binance',
  name: 'Binance',
  supportedTimeframes: ['1m', '5m', '15m', '1h', '4h', '1d', '1w'],
  maxHistoryDays: MAX_HISTORY_DAYS,
  timeframeNotes: TIMEFRAME_NOTES,
  notes: Object.entries(TIMEFRAME_NOTES).map(([tf, note]) => `${tf}: ${note}`),
};

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

export const binanceProvider: DataProvider = {
  info,

  async validateSymbol(symbol: string) {
    try {
      const res = await fetch(
        `${BASE_URL}/ticker/price?symbol=${encodeURIComponent(symbol)}`
      );
      if (!res.ok) {
        return { valid: false, error: 'Symbol not found on Binance' };
      }
      const data: unknown = await res.json();
      if (
        typeof data === 'object' &&
        data !== null &&
        'price' in data &&
        typeof (data as Record<string, unknown>).price === 'string'
      ) {
        return { valid: true };
      }
      return { valid: false, error: 'Symbol not found on Binance' };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { valid: false, error: msg };
    }
  },

  async getAvailableRange(_symbol: string, timeframe: string) {
    const maxDays = MAX_HISTORY_DAYS[timeframe] ?? 365;
    const end = new Date();
    const start = addDays(end, -maxDays);
    return { startDate: toDateStr(start), endDate: toDateStr(end) };
  },

  async fetchCandles(req: DownloadRequest): Promise<ProviderCandle[]> {
    const interval = INTERVAL_MAP[req.timeframe];
    if (!interval) throw new Error(`Unsupported timeframe: ${req.timeframe}`);

    const startMs = new Date(req.startDate).getTime();
    const endMs = new Date(req.endDate).getTime() + 86400000 - 1; // inclusive end of day

    const allCandles: ProviderCandle[] = [];
    let cursor = startMs;

    while (cursor <= endMs) {
      const url =
        `${BASE_URL}/klines` +
        `?symbol=${encodeURIComponent(req.symbol)}` +
        `&interval=${encodeURIComponent(interval)}` +
        `&startTime=${cursor}` +
        `&endTime=${endMs}` +
        `&limit=1000`;

      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Binance API error ${res.status}: ${body}`);
      }

      const rows: unknown = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) break;

      for (const row of rows) {
        if (!Array.isArray(row) || row.length < 6) continue;
        const openTime = Number(row[0]);
        const open = parseFloat(String(row[1]));
        const high = parseFloat(String(row[2]));
        const low = parseFloat(String(row[3]));
        const close = parseFloat(String(row[4]));
        const volume = parseFloat(String(row[5]));
        allCandles.push({ timestamp: openTime, open, high, low, close, volume });
      }

      // Advance cursor past the last candle's open time
      const lastRow = rows[rows.length - 1];
      if (!Array.isArray(lastRow)) break;
      const lastOpenTime = Number(lastRow[0]);
      if (lastOpenTime <= cursor) break; // no progress — stop
      cursor = lastOpenTime + 1;
    }

    return allCandles;
  },
};
