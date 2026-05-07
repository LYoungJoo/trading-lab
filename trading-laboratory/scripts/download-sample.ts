/**
 * Download sample market data from Yahoo Finance for a few well-known symbols.
 * Run: npx tsx scripts/download-sample.ts
 */
import { yahooProvider } from '../lib/providers/yahoo';
import { insertMarketDataBatch, getDatasetSummary } from '../lib/db/queries';

const SAMPLES = [
  { symbol: 'AAPL',  timeframe: '1d' as const, days: 365 },
  { symbol: 'BTC-USD', timeframe: '1d' as const, days: 365 },
  { symbol: 'SPY',   timeframe: '1d' as const, days: 365 },
];

function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

async function main() {
  console.log('Downloading sample data from Yahoo Finance…\n');

  for (const { symbol, timeframe, days } of SAMPLES) {
    const endDate = toDateStr(new Date());
    const startDate = toDateStr(addDays(new Date(), -days));
    process.stdout.write(`  ${symbol} ${timeframe} ${startDate}→${endDate} … `);

    try {
      const candles = await yahooProvider.fetchCandles({ symbol, timeframe, startDate, endDate });
      const rows = candles.map((c) => ({
        symbol,
        timeframe,
        timestamp: c.timestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        provider: 'yahoo',
      }));
      const inserted = insertMarketDataBatch(rows);
      console.log(`${candles.length} candles fetched, ${inserted} inserted`);
    } catch (e) {
      console.log(`FAILED — ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log('\nDataset summary:');
  const summary = getDatasetSummary();
  if (summary.length === 0) {
    console.log('  (no data in DB)');
  } else {
    for (const s of summary) {
      console.log(`  ${s.symbol} [${s.timeframe}] via ${s.provider}: ${s.rowCount} rows, ${s.minDate} → ${s.maxDate}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
