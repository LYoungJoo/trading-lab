// T017 — POST /api/experiments/[id]/run
// T032 — Streaming support
// TODO: streaming - currently returns full response (Next.js ReadableStream/SSE with
// blocking SQLite ops in the same process is complex; the frontend gracefully
// falls back to consuming the full JSON response instead).
import { NextRequest, NextResponse } from 'next/server';
import {
  getExperiment,
  saveStrategy,
  updateExperimentStatus,
} from '@/lib/db/queries';
import { fetchMarketData } from '@/lib/data';
import { runStrategyAgent } from '@/lib/agents/strategy';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const logLines: string[] = [];

  function log(msg: string) {
    const line = `[${new Date().toISOString()}] ${msg}`;
    logLines.push(line);
    console.log(line);
  }

  try {
    // 1. Load experiment from DB
    log(`Loading experiment ${id}`);
    const experiment = await getExperiment(id);

    if (!experiment) {
      return NextResponse.json(
        { error: `Experiment ${id} not found` },
        { status: 404 }
      );
    }

    if (experiment.status === 'running') {
      return NextResponse.json(
        { error: 'Experiment is already running' },
        { status: 409 }
      );
    }

    // Allow re-running failed experiments (do not block on 'failed' status)

    // Mark as running
    await updateExperimentStatus(id, 'running');
    log(`Experiment status → running`);

    // 2. Fetch market data
    log(`Fetching market data for ${experiment.config.symbol} (${experiment.config.dataSource})`);
    const marketData = await fetchMarketData(experiment.config);
    log(`Fetched ${marketData.candles.length} candles for timeframe=${marketData.timeframe}`);

    if (marketData.candles.length === 0) {
      throw new Error(
        `No market data returned for ${experiment.config.symbol} (${experiment.config.dataSource}). ` +
        `Check that the symbol and date range are valid for this data source.`
      );
    }

    // 3. Run strategy agent
    log(`Running strategy agent...`);
    const strategy = await runStrategyAgent(experiment.config, marketData);
    log(
      `Strategy generated: ${strategy.setups.length} setup(s) — ` +
      strategy.setups.map((s) => `${s.name}:${s.allocationPct}%`).join(', ')
    );

    // 4. Save strategy to DB
    await saveStrategy(id, strategy);
    log(`Strategy saved to DB`);

    // 5. Update status to complete
    const executionLog = logLines.join('\n');
    await updateExperimentStatus(id, 'complete', executionLog);
    log(`Experiment status → complete`);

    // Return progress steps along with strategy so the frontend can display them
    return NextResponse.json({
      steps: ['fetching_data', 'running_agent', 'complete'],
      strategy,
      allocationNormalized: strategy.allocationNormalized,
      executionLog: logLines.join('\n'),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logLines.push(`[ERROR] ${msg}`);
    console.error('[POST /api/experiments/[id]/run]', error);

    // Update status to failed
    try {
      await updateExperimentStatus(id, 'failed', logLines.join('\n'));
    } catch {
      // ignore secondary failure
    }

    return NextResponse.json(
      { error: msg, executionLog: logLines.join('\n') },
      { status: 500 }
    );
  }
}
