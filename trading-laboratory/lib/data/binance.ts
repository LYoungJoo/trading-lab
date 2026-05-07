// T011 — Binance public REST API data fetcher
import https from 'https';
import type { Candle } from '../types';

// SSL workaround for environments with cert issues (development only)
const agent =
  process.env.NODE_ENV !== 'production'
    ? new https.Agent({ rejectUnauthorized: false })
    : undefined;

/**
 * Map Binance kline interval string to API format.
 * Accepts: 1m, 5m, 1h, day (→ 1d), week (→ 1w)
 */
function normalizeInterval(interval: string): string {
  if (interval === 'day') return '1d';
  if (interval === 'week') return '1w';
  return interval; // 1m, 5m, 1h pass through directly
}

/**
 * Fetch OHLCV candles from Binance public API.
 * https://api.binance.com/api/v3/klines
 *
 * @param symbol   e.g. "BTCUSDT"
 * @param interval e.g. "1m", "5m", "1h", "day", "week"
 * @param startTime Unix ms
 * @param endTime   Unix ms
 */
export async function fetchOHLCV(
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<Candle[]> {
  const normalizedInterval = normalizeInterval(interval);
  const limit = 1000; // Binance max per request

  const allCandles: Candle[] = [];
  let cursor = startTime;

  while (cursor < endTime) {
    const url = new URL('https://api.binance.com/api/v3/klines');
    url.searchParams.set('symbol', symbol.toUpperCase());
    url.searchParams.set('interval', normalizedInterval);
    url.searchParams.set('startTime', String(cursor));
    url.searchParams.set('endTime', String(endTime));
    url.searchParams.set('limit', String(limit));

    const fetchOptions: RequestInit & { agent?: unknown } = {};
    if (agent) fetchOptions.agent = agent;
    const response = await fetch(url.toString(), fetchOptions);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Binance API error ${response.status}: ${text}`);
    }

    // Binance kline format:
    // [openTime, open, high, low, close, volume, closeTime, ...]
    const raw = (await response.json()) as Array<[
      number, string, string, string, string, string, number, ...unknown[]
    ]>;

    if (raw.length === 0) break;

    const candles: Candle[] = raw.map((k) => ({
      timestamp: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));

    allCandles.push(...candles);

    // Advance cursor past the last candle's open time
    const lastOpenTime = raw[raw.length - 1][0];
    cursor = lastOpenTime + 1;

    // If we got fewer than limit we're done
    if (raw.length < limit) break;
  }

  // Filter strictly within requested range
  return allCandles.filter(
    (c) => c.timestamp >= startTime && c.timestamp <= endTime
  );
}
