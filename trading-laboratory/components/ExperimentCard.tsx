'use client';

// T024 — ExperimentCard component
// T030 — "Duplicate Config" button
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Experiment, ExperimentStatus } from '@/lib/types';

// ─────────────────────────────────────────────────────────────
// Score badge helpers
// ─────────────────────────────────────────────────────────────

function getScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  if (score >= 70) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  if (score >= 40) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
}

// ─────────────────────────────────────────────────────────────
// Status pill
// ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<ExperimentStatus, string> = {
  pending:  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  running:  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  complete: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  failed:   'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

function StatusPill({ status }: { status: ExperimentStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// ExperimentCard
// ─────────────────────────────────────────────────────────────

interface ExperimentCardProps {
  experiment: Experiment;
  rank: number | null; // null = unranked/unevaluated
}

export function ExperimentCard({ experiment, rank }: ExperimentCardProps) {
  const router = useRouter();
  const { id, name, status, config, evaluation } = experiment;
  const compositeScore = evaluation?.compositeScore ?? null;
  const scoreColorClass = getScoreColor(compositeScore);

  function handleDuplicate(e: React.MouseEvent) {
    e.preventDefault(); // don't follow the card link
    e.stopPropagation();
    router.push(`/experiments/new?from=${id}`);
  }

  return (
    <Link href={`/experiments/${id}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="py-4 px-5">
          <div className="flex items-start gap-4">
            {/* Rank number */}
            <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-muted text-sm font-bold text-muted-foreground">
              {rank !== null ? `#${rank}` : '—'}
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0 space-y-2">
              {/* Top row: name + status + score */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-base truncate">{name}</span>
                <StatusPill status={status} />
                {compositeScore !== null ? (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${scoreColorClass}`}
                  >
                    {Math.round(compositeScore)}
                  </span>
                ) : null}
              </div>

              {/* Config summary */}
              <p className="text-xs text-muted-foreground">
                {config.market} · {config.symbol} · {config.dateRange.start} – {config.dateRange.end}
              </p>

              {/* Score breakdown or "Not Evaluated" */}
              {evaluation ? (
                <div className="flex gap-3 flex-wrap text-xs text-muted-foreground">
                  <span>
                    Compliance <span className="font-medium text-foreground">{evaluation.complianceScore}</span>
                  </span>
                  <span>
                    Risk <span className="font-medium text-foreground">{evaluation.riskQualityScore}</span>
                  </span>
                  <span>
                    Clarity <span className="font-medium text-foreground">{evaluation.clarityScore}</span>
                  </span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground italic">Not Evaluated</span>
              )}
            </div>

            {/* Duplicate button */}
            <div className="flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDuplicate}
                className="text-xs"
              >
                Duplicate
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
