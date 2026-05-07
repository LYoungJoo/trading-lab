// T027 — POST /api/experiments/[id]/evaluate
import { NextRequest, NextResponse } from 'next/server';
import { getExperiment, saveEvaluation } from '@/lib/db/queries';
import { runEvaluationAgent } from '@/lib/agents/evaluation';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // 1. Load experiment + strategy from DB
    const experiment = await getExperiment(id);

    if (!experiment) {
      return NextResponse.json(
        { error: `Experiment ${id} not found` },
        { status: 404 }
      );
    }

    if (!experiment.strategy) {
      return NextResponse.json(
        { error: 'Experiment has no strategy to evaluate. Run the experiment first.' },
        { status: 400 }
      );
    }

    // Return 409 if already evaluated — the UI should hide the Evaluate button
    // after evaluation completes, but guard server-side as well.
    if (experiment.evaluation) {
      return NextResponse.json(
        { error: 'Experiment has already been evaluated', evaluation: experiment.evaluation },
        { status: 409 }
      );
    }

    // 2. Run evaluation agent
    const evaluationResult = await runEvaluationAgent(
      experiment.strategy,
      experiment.config
    );

    // 3. Save evaluation to DB
    await saveEvaluation(id, evaluationResult);

    // 4. Return evaluation result
    return NextResponse.json(evaluationResult);
  } catch (error) {
    console.error('[POST /api/experiments/[id]/evaluate]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
