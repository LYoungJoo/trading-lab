'use client';

// T025 — Home page: experiments list ranked by score
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ExperimentCard } from '@/components/ExperimentCard';
import type { Experiment } from '@/lib/types';

export default function HomePage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        const res = await fetch('/api/experiments');
        if (!mounted) return;
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as Experiment[];
        if (!mounted) return;
        setExperiments(data);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Failed to load experiments');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => { mounted = false; };
  }, []);

  // Poll every 4 s while any experiment is 'running', so the list stays current
  // when a background run completes while the user is on this page.
  useEffect(() => {
    const hasRunning = experiments.some((e) => e.status === 'running');
    if (!hasRunning) return;

    let mounted = true;
    const interval = setInterval(async () => {
      if (!mounted) return;
      try {
        const res = await fetch('/api/experiments');
        if (!res.ok || !mounted) return;
        const data = (await res.json()) as Experiment[];
        if (mounted) setExperiments(data);
      } catch {
        // ignore polling errors
      }
    }, 4000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [experiments]);

  // Split into evaluated (ranked) and unevaluated
  const evaluated = experiments.filter((e) => e.evaluation !== undefined);
  const unevaluated = experiments.filter((e) => e.evaluation === undefined);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Trading Laboratory</h1>
          <Link href="/experiments/new">
            <Button>New Experiment</Button>
          </Link>
        </div>

        {/* T034 — Skeleton cards while loading experiments */}
        {loading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse border rounded-lg p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="h-5 w-48 bg-muted rounded" />
                  <div className="h-5 w-16 bg-muted rounded-full" />
                </div>
                <div className="flex gap-3">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-4 w-32 bg-muted rounded" />
                </div>
                <div className="flex gap-2">
                  <div className="h-6 w-20 bg-muted rounded" />
                  <div className="h-6 w-20 bg-muted rounded" />
                  <div className="h-6 w-20 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && experiments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <p className="text-muted-foreground text-lg">No experiments yet. Run your first experiment.</p>
            <Link href="/experiments/new">
              <Button size="lg">Get Started</Button>
            </Link>
          </div>
        )}

        {/* Evaluated / ranked experiments */}
        {!loading && !error && evaluated.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-muted-foreground uppercase tracking-wide text-xs">
              Ranked by Score
            </h2>
            <div className="space-y-3">
              {evaluated.map((exp, idx) => (
                <ExperimentCard key={exp.id} experiment={exp} rank={idx + 1} />
              ))}
            </div>
          </section>
        )}

        {/* Unevaluated experiments */}
        {!loading && !error && unevaluated.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Awaiting Evaluation
            </h2>
            <div className="space-y-3">
              {unevaluated.map((exp) => (
                <ExperimentCard key={exp.id} experiment={exp} rank={null} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
