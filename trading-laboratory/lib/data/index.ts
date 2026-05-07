// T014 — Market data router + indicator computation
import type {
  ExperimentConfig,
  MarketData,
  Candle,
  ComputedIndicators,
  Timeframe,
} from '../types';
import { getCandles } from '../db/queries';

// ─────────────────────────────────────────────────────────────
// Indicator math helpers
// ─────────────────────────────────────────────────────────────

function simpleMovingAverage(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }
    const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
}

function exponentialMovingAverage(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let ema = NaN;

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }
    if (i === period - 1) {
      // Seed EMA with SMA
      ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result.push(ema);
      continue;
    }
    ema = values[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

/** RSI (14-period) using Wilder's smoothing */
function computeRSI(closes: number[], period = 14): number[] {
  // Result array has exactly closes.length entries, leading entries are NaN
  const result: number[] = new Array(closes.length).fill(NaN);

  if (closes.length <= period) return result;

  // Compute changes: changes[i] = closes[i+1] - closes[i], length = closes.length - 1
  const changes = closes.slice(1).map((c, i) => c - closes[i]);

  // Initial averages over the first `period` changes (indices 0..period-1)
  let avgGain =
    changes.slice(0, period).filter((c) => c > 0).reduce((a, b) => a + b, 0) /
    period;
  let avgLoss =
    changes
      .slice(0, period)
      .filter((c) => c < 0)
      .reduce((a, b) => a + Math.abs(b), 0) / period;

  // The first RSI value corresponds to close index `period` (after `period` changes)
  const rs0 = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  result[period] = 100 - 100 / (1 + rs0);

  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    result[i + 1] = 100 - 100 / (1 + rs);
  }

  return result;
}

/** MACD (12/26/9) */
function computeMACD(
  closes: number[]
): { macd: number[]; signal: number[]; histogram: number[] } {
  const ema12 = exponentialMovingAverage(closes, 12);
  const ema26 = exponentialMovingAverage(closes, 26);

  const macdLine = ema12.map((v, i) => {
    if (isNaN(v) || isNaN(ema26[i])) return NaN;
    return v - ema26[i];
  });

  // Signal is 9-period EMA of MACD — skip NaN leading values
  const validStartIdx = macdLine.findIndex((v) => !isNaN(v));

  // If all MACD values are NaN (not enough data), return all-NaN arrays
  if (validStartIdx === -1) {
    const nanArr = new Array(closes.length).fill(NaN);
    return { macd: nanArr, signal: nanArr, histogram: nanArr };
  }

  const signalInput = macdLine.slice(validStartIdx);
  const signalRaw = exponentialMovingAverage(signalInput, 9);

  // Pad signal with NaNs to match original length
  const signal = new Array(validStartIdx).fill(NaN).concat(signalRaw);

  const histogram = macdLine.map((v, i) => {
    if (isNaN(v) || isNaN(signal[i])) return NaN;
    return v - signal[i];
  });

  return { macd: macdLine, signal, histogram };
}

// ─────────────────────────────────────────────────────────────
// Primary interval selection
// ─────────────────────────────────────────────────────────────

/**
 * Choose the "primary" timeframe from the list for market data fetching.
 * Prefer more granular timeframes; fall back to coarser ones.
 */
function pickPrimaryTimeframe(timeframes: Timeframe[]): Timeframe {
  const order: Timeframe[] = ['1m', '5m', '1h', 'day', 'week'];
  for (const tf of order) {
    if (timeframes.includes(tf)) return tf;
  }
  return timeframes[0] ?? 'day';
}

// ─────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────

/**
 * Fetch market data and compute requested indicators.
 * Checks local DB first (data downloaded via Data Storage page);
 * falls back to live API if no local data covers the requested range.
 */
export async function fetchMarketData(
  config: ExperimentConfig
): Promise<MarketData> {
  const { symbol, dateRange, timeframes, indicators } = config;

  const primaryTimeframe = pickPrimaryTimeframe(timeframes);

  const startMs = new Date(dateRange.start).getTime();
  const endMs = new Date(dateRange.end).getTime() + 86400000 - 1; // inclusive end of day

  // ─── Try local DB first ────────────────────────────────────
  // Map internal timeframe labels to the storage format used by the data-storage feature.
  // The data-storage providers use '1d'/'1w'; our internal labels are 'day'/'week'.
  const dbTimeframeMap: Record<Timeframe, string> = {
    '1m': '1m',
    '5m': '5m',
    '1h': '1h',
    'day': '1d',
    'week': '1w',
  };
  const dbTimeframe = dbTimeframeMap[primaryTimeframe];
  const localCandles = getCandles(symbol, dbTimeframe, startMs, endMs);

  let candles: Candle[];

  if (localCandles.length === 0) {
    throw new Error(
      `No local data found for ${symbol} (${dbTimeframe}). ` +
      `Please download data first via the Data Storage page before running experiments.`
    );
  }

  // Verify coverage: earliest candle must be on or before startMs, latest on or after endMs.
  const localStart = localCandles[0].timestamp;
  const localEnd = localCandles[localCandles.length - 1].timestamp;
  if (localStart > startMs || localEnd < endMs) {
    throw new Error(
      `Local data for ${symbol} (${dbTimeframe}) covers ` +
      `${new Date(localStart).toISOString().split('T')[0]}–${new Date(localEnd).toISOString().split('T')[0]} ` +
      `but the experiment requests ${dateRange.start}–${dateRange.end}. ` +
      `Please download data for the full date range via the Data Storage page.`
    );
  }

  console.log(
    `[fetchMarketData] Using ${localCandles.length} locally stored candles for ${symbol}/${dbTimeframe}`
  );
  const candles = localCandles;

  // ─── Compute indicators ───────────────────────────────────
  const closes = candles.map((c) => c.close);
  const computedIndicators: ComputedIndicators = {};

  if (indicators.includes('RSI')) {
    computedIndicators.rsi = computeRSI(closes, 14);
  }

  if (indicators.includes('MACD')) {
    computedIndicators.macd = computeMACD(closes);
  }

  if (indicators.includes('20MA')) {
    computedIndicators.ma20 = simpleMovingAverage(closes, 20);
  }

  if (indicators.includes('50MA')) {
    computedIndicators.ma50 = simpleMovingAverage(closes, 50);
  }

  // volume and order-book are data fields, not computed indicators
  // They are included in candles.volume; order-book requires a live feed

  return {
    symbol,
    timeframe: primaryTimeframe,
    candles,
    indicators: computedIndicators,
  };
}
