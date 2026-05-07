import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();
import type { DataProvider, DownloadRequest, ProviderCandle, ProviderInfo } from './types';

// Note: yahoo-finance2 may need TLS relaxation in certain dev environments.
// Prefer the per-request httpsAgent approach in yahoo-finance2 options rather
// than the global process.env override, but keep a dev-only opt-in here:
if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_UNSAFE_TLS === '1') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const MAX_HISTORY_DAYS: Record<string, number> = {
  '1m': 7,
  '5m': 60,
  '1h': 730,
  '1d': 36500,
  '1w': 36500,
};

const INTERVAL_MAP: Record<string, string> = {
  '1m': '1m',
  '5m': '5m',
  '1h': '60m',
  '1d': '1d',
  '1w': '1wk',
};

const TIMEFRAME_NOTES: Record<string, string> = {
  '1m': 'Last 7 days only',
  '5m': 'Last 60 days only',
  '1h': 'Up to 2 years',
  '1d': 'Full history available',
  '1w': 'Full history available',
};

const info: ProviderInfo = {
  id: 'yahoo',
  name: 'Yahoo Finance',
  supportedTimeframes: ['1m', '5m', '1h', '1d', '1w'],
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

export const yahooProvider: DataProvider = {
  info,

  async validateSymbol(symbol: string) {
    try {
      await yahooFinance.quote(symbol);
      return { valid: true };
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await yahooFinance.chart(req.symbol, {
      period1: req.startDate,
      period2: req.endDate,
      interval: interval as '1m' | '5m' | '60m' | '1d' | '1wk',
    });

    const quotes: any[] = result?.quotes ?? [];
    return quotes
      .filter((q) => q.open != null && q.close != null)
      .map((q) => ({
        timestamp: new Date(q.date).getTime(),
        open: q.open as number,
        high: q.high as number,
        low: q.low as number,
        close: q.close as number,
        volume: (q.volume as number) ?? 0,
      }));
  },
};
