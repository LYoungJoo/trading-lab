// T016 — POST /api/experiments: create a new experiment
// T023 — GET /api/experiments: list all experiments (implemented in Phase 4)
import { NextRequest, NextResponse } from 'next/server';
import { createExperiment, listExperiments } from '@/lib/db/queries';
import type { ExperimentConfig } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { name?: string; config: ExperimentConfig };

    if (!body.config) {
      return NextResponse.json(
        { error: 'Missing required field: config' },
        { status: 400 }
      );
    }

    const { config } = body;
    if (typeof config.market !== 'string' || !config.market) {
      return NextResponse.json(
        { error: 'Missing required field: config.market' },
        { status: 400 }
      );
    }
    if (typeof config.symbol !== 'string' || !config.symbol) {
      return NextResponse.json(
        { error: 'Missing required field: config.symbol' },
        { status: 400 }
      );
    }
    if (typeof config.dateRange?.start !== 'string' || !config.dateRange.start) {
      return NextResponse.json(
        { error: 'Missing required field: config.dateRange.start' },
        { status: 400 }
      );
    }
    if (typeof config.dateRange?.end !== 'string' || !config.dateRange.end) {
      return NextResponse.json(
        { error: 'Missing required field: config.dateRange.end' },
        { status: 400 }
      );
    }
    if (!Array.isArray(config.timeframes) || config.timeframes.length === 0) {
      return NextResponse.json(
        { error: 'config.timeframes must be a non-empty array' },
        { status: 400 }
      );
    }
    if (typeof config.dataSource !== 'string' || !config.dataSource) {
      return NextResponse.json(
        { error: 'Missing required field: config.dataSource' },
        { status: 400 }
      );
    }

    const experiment = await createExperiment(body.config, body.name);

    return NextResponse.json(
      {
        id: experiment.id,
        name: experiment.name,
        status: experiment.status,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/experiments]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// TODO: T023 — GET /api/experiments
// Returns all experiments ordered by compositeScore desc (evaluated first),
// unevaluated appended at bottom with score: null.
export async function GET() {
  try {
    const experiments = await listExperiments();
    return NextResponse.json(experiments);
  } catch (error) {
    console.error('[GET /api/experiments]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
