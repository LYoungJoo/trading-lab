'use client';

// T022 — Experiment detail page
// T029 — Wire "Evaluate" button
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StrategyDisplay } from '@/components/StrategyDisplay';
import { EvaluationPanel } from '@/components/EvaluationPanel';
import type { Experiment, ExperimentStatus, EvaluationResult } from '@/lib/types';

// ─────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<ExperimentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  running: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  complete: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

function StatusBadge({ status }: { status: ExperimentStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Config summary
// ─────────────────────────────────────────────────────────────

function ConfigSummary({ experiment }: { experiment: Experiment }) {
  const { config } = experiment;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="font-medium text-muted-foreground">Market</dt>
            <dd className="capitalize">{config.market}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">Symbol</dt>
            <dd className="font-mono">{config.symbol}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">Date Range</dt>
            <dd>
              {config.dateRange.start} – {config.dateRange.end}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">Data Source</dt>
            <dd className="capitalize">{config.dataSource}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">Timeframes</dt>
            <dd className="flex flex-wrap gap-1">
              {config.timeframes.map((tf) => (
                <Badge key={tf} variant="secondary" className="text-xs">
                  {tf}
                </Badge>
              ))}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">Indicators</dt>
            <dd className="flex flex-wrap gap-1">
              {config.indicators.length > 0 ? (
                config.indicators.map((ind) => (
                  <Badge key={ind} variant="secondary" className="text-xs">
                    {ind}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">None</span>
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium text-muted-foreground">Active Prop Firm Rules</dt>
            <dd className="flex flex-wrap gap-1 mt-1">
              {config.propFirmRules.filter((r) => r.enabled).length > 0 ? (
                config.propFirmRules
                  .filter((r) => r.enabled)
                  .map((r) => (
                    <Badge key={r.name} variant="outline" className="text-xs">
                      {r.name}
                    </Badge>
                  ))
              ) : (
                <span className="text-muted-foreground text-sm">None</span>
              )}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Execution Log (collapsible)
// ─────────────────────────────────────────────────────────────

function ExecutionLog({ log }: { log: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Execution Log</CardTitle>
          <span className="text-muted-foreground text-sm">{open ? '▲ Hide' : '▼ Show'}</span>
        </div>
      </CardHeader>
      {open && (
        <CardContent>
          <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {log}
          </pre>
        </CardContent>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────

export default function ExperimentDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';

  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Evaluation state
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/experiments/${id}`);
        if (!mounted) return;
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as Experiment;
        if (!mounted) return;
        setExperiment(data);
        // Pre-populate evaluation if already exists
        if (data.evaluation) {
          setEvaluation(data.evaluation);
        }
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Failed to load experiment');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => { mounted = false; };
  }, [id]);

  // T035 — Poll every 3s while status is 'running'
  // Depends on [id, experiment?.status] so the interval is only set up when the
  // experiment is running, and is automatically torn down (via cleanup) as soon
  // as the fetched status transitions away from 'running'.
  useEffect(() => {
    if (!id) return;
    if (!experiment || experiment.status !== 'running') return;

    let mounted = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/experiments/${id}`);
        if (!res.ok || !mounted) return;
        const data = (await res.json()) as Experiment;
        if (!mounted) return;
        // Update experiment — if status changed away from 'running', the dep
        // array change will cause this effect to clean up and not restart.
        setExperiment(data);
        if (data.evaluation) {
          setEvaluation(data.evaluation);
        }
      } catch {
        // ignore polling errors
      }
    }, 3000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [id, experiment?.status]);

  async function handleEvaluate() {
    if (!id) return;
    setEvaluating(true);
    setEvaluationError(null);

    try {
      const res = await fetch(`/api/experiments/${id}/evaluate`, {
        method: 'POST',
      });

      const body = (await res.json()) as EvaluationResult & { error?: string; evaluation?: EvaluationResult };

      if (res.status === 409 && body.evaluation) {
        // Already evaluated — use the returned evaluation data
        setEvaluation(body.evaluation);
        return;
      }

      if (!res.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      setEvaluation(body as EvaluationResult);
    } catch (e) {
      setEvaluationError(e instanceof Error ? e.message : 'Evaluation failed');
    } finally {
      setEvaluating(false);
    }
  }

  // T034 — Skeleton loader while fetching experiment data
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          {/* Back link skeleton */}
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="flex items-center gap-3 mt-3">
              <div className="h-8 w-64 bg-muted rounded" />
              <div className="h-6 w-20 bg-muted rounded-full" />
            </div>
            <div className="h-4 w-48 bg-muted rounded" />
          </div>
          {/* Config card skeleton */}
          <div className="animate-pulse border rounded-lg p-6 space-y-4">
            <div className="h-5 w-32 bg-muted rounded" />
            <div className="grid grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="h-3 w-20 bg-muted rounded" />
                  <div className="h-4 w-32 bg-muted rounded" />
                </div>
              ))}
            </div>
          </div>
          {/* Strategy card skeleton */}
          <div className="animate-pulse border rounded-lg p-6 space-y-4">
            <div className="h-5 w-24 bg-muted rounded" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-muted rounded-md" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !experiment) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-center space-y-4">
            <p className="text-red-600 dark:text-red-400">{error ?? 'Experiment not found'}</p>
            <Link href="/" className="text-sm text-blue-600 hover:underline">
              ← Back to experiments
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canEvaluate = experiment.strategy && !evaluation;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to experiments
          </Link>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <h1 className="text-2xl font-bold">{experiment.name}</h1>
            <StatusBadge status={experiment.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Created {new Date(experiment.createdAt).toLocaleString()}
            {experiment.completedAt && (
              <> · Completed {new Date(experiment.completedAt).toLocaleString()}</>
            )}
          </p>
        </div>

        {/* Config summary */}
        <ConfigSummary experiment={experiment} />

        {/* Execution log */}
        {experiment.executionLog && (
          <ExecutionLog log={experiment.executionLog} />
        )}

        {/* Strategy */}
        {experiment.strategy ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Strategy</h2>
            {experiment.strategy.allocationNormalized && (
              <div className="rounded-md bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200">
                ⚠️ The agent returned a total allocation above 100%. Allocations were proportionally normalised to sum to 100%.
              </div>
            )}
            <StrategyDisplay strategy={experiment.strategy} />
          </div>
        ) : experiment.status === 'failed' ? (
          <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
            <CardContent className="py-6 text-center">
              <p className="text-red-700 dark:text-red-300">
                Strategy generation failed. Check the execution log for details.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">
              No strategy generated yet.
            </CardContent>
          </Card>
        )}

        {/* Evaluate button */}
        {(canEvaluate || evaluating) && (
          <div className="flex flex-col items-end gap-2">
            <Button
              onClick={() => void handleEvaluate()}
              disabled={evaluating}
              className="flex items-center gap-2"
            >
              {evaluating ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                  Evaluating...
                </>
              ) : (
                'Evaluate Strategy'
              )}
            </Button>
          </div>
        )}

        {/* Evaluation error */}
        {evaluationError && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300">
            {evaluationError}
          </div>
        )}

        {/* Evaluation panel */}
        {evaluating && <EvaluationPanel evaluation={null} loading />}
        {!evaluating && evaluation && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Evaluation</h2>
            <EvaluationPanel evaluation={evaluation} />
          </div>
        )}
      </div>
    </div>
  );
}
