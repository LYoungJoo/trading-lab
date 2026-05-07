'use client';

// T028 — EvaluationPanel component
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { EvaluationResult } from '@/lib/types';

// ─────────────────────────────────────────────────────────────
// Score color helpers
// ─────────────────────────────────────────────────────────────

function getScoreBarColor(score: number): string {
  if (score >= 70) return 'bg-green-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getScoreTextColor(score: number): string {
  if (score >= 70) return 'text-green-700 dark:text-green-300';
  if (score >= 40) return 'text-yellow-700 dark:text-yellow-300';
  return 'text-red-700 dark:text-red-300';
}

function getCompositeScoreClass(score: number): string {
  if (score >= 70) return 'text-green-600 dark:text-green-400';
  if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

// ─────────────────────────────────────────────────────────────
// Assessment badge
// ─────────────────────────────────────────────────────────────

const ASSESSMENT_STYLES: Record<'pass' | 'partial' | 'fail', string> = {
  pass:    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  partial: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  fail:    'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

function AssessmentBadge({ result }: { result: 'pass' | 'partial' | 'fail' }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${ASSESSMENT_STYLES[result]}`}
    >
      {result}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Score bar
// ─────────────────────────────────────────────────────────────

function ScoreBar({ label, score }: { label: string; score: number }) {
  const barColor = getScoreBarColor(score);
  const textColor = getScoreTextColor(score);
  const pct = Math.max(0, Math.min(100, score));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={`font-semibold tabular-nums ${textColor}`}>{score}</span>
      </div>
      <div className="relative h-2 w-full rounded-full overflow-hidden bg-muted">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────

function EvaluationSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Evaluation</CardTitle>
          <div className="h-5 w-24 rounded bg-muted animate-pulse" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center py-4 space-y-2">
          <div className="h-16 w-24 rounded bg-muted animate-pulse" />
          <div className="h-4 w-32 rounded bg-muted animate-pulse" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1">
              <div className="h-4 w-32 rounded bg-muted animate-pulse" />
              <div className="h-2 w-full rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

interface EvaluationPanelProps {
  evaluation: EvaluationResult | null;
  loading?: boolean;
}

export function EvaluationPanel({ evaluation, loading = false }: EvaluationPanelProps) {
  if (loading) {
    return <EvaluationSkeleton />;
  }

  if (!evaluation) {
    return null;
  }

  const { compositeScore, complianceScore, riskQualityScore, clarityScore, perRuleAssessment, isMock } = evaluation;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Evaluation Results</CardTitle>
          {isMock && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
              Mock Evaluation
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Composite score — large and prominent */}
        <div className="flex flex-col items-center py-4 border rounded-lg bg-muted/30">
          <span className={`text-5xl font-bold tabular-nums ${getCompositeScoreClass(compositeScore)}`}>
            {compositeScore}
          </span>
          <span className="text-sm text-muted-foreground mt-1">Composite Score</span>
          <span className="text-xs text-muted-foreground">
            (Compliance ×0.5 + Risk ×0.3 + Clarity ×0.2)
          </span>
        </div>

        {/* Dimension score bars */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Dimension Scores
          </h3>
          <ScoreBar label="Compliance" score={complianceScore} />
          <ScoreBar label="Risk Quality" score={riskQualityScore} />
          <ScoreBar label="Clarity" score={clarityScore} />
        </div>

        {/* Per-rule assessment table */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Per-Rule Assessment
          </h3>
          {perRuleAssessment.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No prop firm rules were active for this experiment.
            </p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Rule</th>
                    <th className="text-left px-4 py-2 font-medium">Result</th>
                    <th className="text-left px-4 py-2 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {perRuleAssessment.map((item) => (
                    <tr
                      key={item.ruleName}
                      className="border-t border-border/50 hover:bg-muted/20"
                    >
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{item.ruleName}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <AssessmentBadge result={item.result} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs leading-relaxed">{item.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
