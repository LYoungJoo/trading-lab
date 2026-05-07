import { NextResponse } from 'next/server';
import { listDownloadJobs, createDownloadJob, updateDownloadJob, insertMarketDataBatch } from '@/lib/db/queries';
import { getProvider } from '@/lib/providers';

const VALID_TIMEFRAMES = new Set(['1m', '5m', '1h', '1d', '1w']);

export async function GET() {
  try {
    return NextResponse.json(listDownloadJobs());
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { symbol, provider: providerId, timeframe, startDate, endDate } = body;

    if (!symbol || !providerId || !timeframe || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!VALID_TIMEFRAMES.has(timeframe)) {
      return NextResponse.json({ error: `Invalid timeframe: ${timeframe}` }, { status: 400 });
    }

    const provider = getProvider(providerId);
    const jobId = createDownloadJob(symbol, providerId, timeframe, startDate, endDate);

    setImmediate(async () => {
      try {
        updateDownloadJob(jobId, { status: 'running' });
        const candles = await provider.fetchCandles({
          symbol,
          timeframe: timeframe as '1m' | '5m' | '1h' | '1d' | '1w',
          startDate,
          endDate,
        });
        const rows = candles.map((c) => ({
          symbol,
          timeframe,
          timestamp: c.timestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
          provider: providerId,
        }));
        const inserted = insertMarketDataBatch(rows);
        updateDownloadJob(jobId, {
          status: 'complete',
          totalRows: rows.length,
          insertedRows: inserted,
          completedAt: Date.now(),
        });
      } catch (e: unknown) {
        updateDownloadJob(jobId, {
          status: 'failed',
          errorMessage: e instanceof Error ? e.message : String(e),
          completedAt: Date.now(),
        });
      }
    });

    return NextResponse.json({ jobId });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
