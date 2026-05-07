'use client';

// T020 — StrategyDisplay component
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Strategy, Setup, SetupCategory } from '@/lib/types';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<
  SetupCategory,
  { icon: string; label: string; color: string }
> = {
  time: { icon: '🕐', label: 'Time-based', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  indicator: { icon: '📊', label: 'Indicator-based', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  price: { icon: '💰', label: 'Price-based', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
};

const SETUP_COLORS = [
  { bar: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  { bar: 'bg-green-500', text: 'text-green-700 dark:text-green-300', badge: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  { bar: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-300', badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
];

// ─────────────────────────────────────────────────────────────
// SetupCard
// ─────────────────────────────────────────────────────────────

function SetupCard({ setup, colorIdx }: { setup: Setup; colorIdx: number }) {
  const colors = SETUP_COLORS[colorIdx % SETUP_COLORS.length];
  // Guard against undefined/null categories (e.g. from corrupt stored JSON)
  const categories: SetupCategory[] = Array.isArray(setup.categories)
    ? setup.categories
    : [];
  // Guard against NaN allocation (corrupt stored data)
  const allocationPct = isNaN(setup.allocationPct) ? 0 : setup.allocationPct;

  return (
    <Card className="border-l-4" style={{ borderLeftColor: ['#3b82f6', '#22c55e', '#f97316'][colorIdx % 3] }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${colors.badge}`}>
              {setup.name}
            </span>
            <CardTitle className="text-base">Setup {setup.name}</CardTitle>
          </div>
          <Badge variant="secondary" className="text-sm font-semibold">
            {allocationPct}% allocation
          </Badge>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-1 mt-2">
          {categories.map((cat) => {
            const cfg = CATEGORY_CONFIG[cat];
            return (
              <span
                key={cat}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cfg.color}`}
              >
                <span aria-hidden="true">{cfg.icon}</span>
                {cfg.label}
              </span>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Entry Condition */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Entry Condition
          </h4>
          <p className="text-sm leading-relaxed">{setup.naturalLanguage}</p>
        </div>

        {/* Stop Loss */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Stop-Loss
          </h4>
          <p className="text-sm leading-relaxed text-red-700 dark:text-red-400">{setup.stopLossLogic}</p>
        </div>

        {/* Reasoning */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Reasoning
          </h4>
          <p className="text-sm leading-relaxed text-muted-foreground">{setup.reasoning}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Allocation Breakdown Bar
// ─────────────────────────────────────────────────────────────

function AllocationBar({ setups }: { setups: Setup[] }) {
  // Normalise each setup's allocation, guarding against NaN values
  const safeAlloc = (pct: number) => (isNaN(pct) ? 0 : pct);
  const total = setups.reduce((sum, s) => sum + safeAlloc(s.allocationPct), 0);
  const barColors = ['bg-blue-500', 'bg-green-500', 'bg-orange-500'];
  const unallocated = Math.max(0, 100 - total);

  return (
    <div className="space-y-2">
      <div className="flex rounded-full overflow-hidden h-4 w-full bg-gray-200 dark:bg-gray-700">
        {setups.map((s, i) => {
          const pct = safeAlloc(s.allocationPct);
          return (
            <div
              key={s.name}
              className={`${barColors[i % barColors.length]} transition-all`}
              style={{ width: `${pct}%` }}
              title={`Setup ${s.name}: ${pct}%`}
            />
          );
        })}
        {unallocated > 0 && (
          <div
            className="bg-gray-300 dark:bg-gray-600"
            style={{ width: `${unallocated}%` }}
            title={`Unallocated: ${unallocated}%`}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        {setups.map((s, i) => {
          const pct = safeAlloc(s.allocationPct);
          return (
            <span key={s.name} className="flex items-center gap-1.5">
              <span
                className={`inline-block w-3 h-3 rounded-sm ${barColors[i % barColors.length]}`}
              />
              <span className="font-medium">Setup {s.name}</span>
              <span className="text-muted-foreground">{pct}%</span>
            </span>
          );
        })}
        {unallocated > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-gray-300 dark:bg-gray-600" />
            <span className="font-medium">Unallocated</span>
            <span className="text-muted-foreground">{unallocated.toFixed(1)}%</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

interface StrategyDisplayProps {
  strategy: Strategy;
}

export function StrategyDisplay({ strategy }: StrategyDisplayProps) {
  const { setups, overallReasoning } = strategy;

  if (!setups || setups.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No setups generated.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Setup cards */}
      <div className="space-y-4">
        {setups.map((setup, i) => (
          <SetupCard key={setup.name} setup={setup} colorIdx={i} />
        ))}
      </div>

      {/* Allocation breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Capital Allocation Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <AllocationBar setups={setups} />
        </CardContent>
      </Card>

      {/* Overall reasoning */}
      {overallReasoning && (
        <Card className="bg-muted/40">
          <CardHeader>
            <CardTitle className="text-base">Overall Reasoning</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {overallReasoning}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
