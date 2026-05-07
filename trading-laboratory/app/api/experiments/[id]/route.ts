// T018 — GET /api/experiments/[id]
import { NextRequest, NextResponse } from 'next/server';
import { getExperiment } from '@/lib/db/queries';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const experiment = await getExperiment(id);

    if (!experiment) {
      return NextResponse.json(
        { error: `Experiment ${id} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json(experiment);
  } catch (error) {
    console.error('[GET /api/experiments/[id]]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
