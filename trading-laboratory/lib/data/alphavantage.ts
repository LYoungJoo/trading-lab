// T012 — Alpha Vantage data fetcher (US Futures / equities)
import https from 'https';
import type { Candle } from '../types';

// SSL workaround for environments with cert issues (development only)
const agent =
  process.env.NODE_ENV !== 'production'
    ? new https.Agent({ rejectUnauthorized: false })
    : undefined;

const BASE_URL = 'https://www.alphavantage.co/query';

/**
 * Map our internal interval labels to Alpha Vantage interval params.
 * For intraday: 1min, 5min, 60min
 * For daily/weekly: use TIME_SERIES_DAILY / TIME_SERIES_WEEKLY
 */
function getFunction(interval: string): {
  fn: string;
  avInterval?: string;
} {
  switch (interval) {
    case '1m':
      return { fn: 'TIME_SERIES_INTRADAY', avInterval: '1min' };
    case '5m':
      return { fn: 'TIME_SERIES_INTRADAY', avInterval: '5min' };
    case '1h':
      return { fn: 'TIME_SERIES_INTRADAY', avInterval: '60min' };
    case 'day':
      return { fn: 'TIME_SERIES_DAILY' };
    case 'week':
      return { fn: 'TIME_SERIES_WEEKLY' };
    default:
      return { fn: 'TIME_SERIES_DAILY' };
  }
}

/**
 * Extract candles from an Alpha Vantage time series response object.
 * The response keys differ by function type.
 */
function extractTimeSeries(
  data: Record<string, unknown>,
  fn: string,
  avInterval?: string
): Record<string, Record<string, string>> {
  // Possible outer keys
  const possibleKeys = [
    `Time Series (${avInterval ?? ''})`,
    'Time Series (Daily)',
    'Weekly Time Series',
    'Monthly Time Series',
    'Time Series FX (Daily)',
  ];

  for (const key of possibleKeys) {
    if (data[key]) {
      return data[key] as Record<string, Record<string, string>>;
    }
  }

  // Fallback: find first key that starts with "Time Series"
  for (const key of Object.keys(data)) {
    if (key.startsWith('Time Series') || key.startsWith('Weekly') || key.startsWith('Monthly')) {
      return data[key] as Record<string, Record<string, string>>;
    }
  }

  throw new Error(
    `Alpha Vantage: could not find time series in response for function=${fn}. Keys: ${Object.keys(data).join(', ')}`
  );
}

/**
 * Fetch OHLCV candles from Alpha Vantage.
 *
 * @param symbol    e.g. "ES" (S&P 500 futures), "AAPL"
 * @param interval  e.g. "1m", "5m", "1h", "day", "week"
 * @param startDate ISO date string "YYYY-MM-DD"
 * @param endDate   ISO date string "YYYY-MM-DD"
 */
export async function fetchOHLCV(
  symbol: string,
  interval: string,
  startDate: string,
  endDate: string
): Promise<Candle[]> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    throw new Error('ALPHA_VANTAGE_API_KEY environment variable is not set');
  }

  const { fn, avInterval } = getFunction(interval);

  const url = new URL(BASE_URL);
  url.searchParams.set('function', fn);
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('outputsize', 'full'); // get full history
  url.searchParams.set('apikey', apiKey);
  if (avInterval) {
    url.searchParams.set('interval', avInterval);
  }

  const fetchOptions: RequestInit & { agent?: unknown } = {};
  if (agent) fetchOptions.agent = agent;
  const response = await fetch(url.toString(), fetchOptions);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Alpha Vantage API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as Record<string, unknown>;

  // Alpha Vantage returns error messages in the JSON
  if (data['Error Message']) {
    throw new Error(`Alpha Vantage error: ${data['Error Message']}`);
  }
  if (data['Note']) {
    // Rate limit hit
    throw new Error(`Alpha Vantage rate limit: ${data['Note']}`);
  }

  const timeSeries = extractTimeSeries(data, fn, avInterval);

  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime() + 86400000 - 1; // inclusive end of day

  const candles: Candle[] = [];

  for (const [dateStr, values] of Object.entries(timeSeries)) {
    const timestamp = new Date(dateStr).getTime();
    if (timestamp < startMs || timestamp > endMs) continue;

    candles.push({
      timestamp,
      open: parseFloat(values['1. open']),
      high: parseFloat(values['2. high']),
      low: parseFloat(values['3. low']),
      close: parseFloat(values['4. close']),
      volume: parseFloat(values['5. volume'] ?? '0'),
    });
  }

  // Sort ascending by timestamp
  candles.sort((a, b) => a.timestamp - b.timestamp);

  return candles;
}
