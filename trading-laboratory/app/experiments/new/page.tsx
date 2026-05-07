'use client';

// T021 — New Experiment page
// T031 — Pre-fill form from ?from=[id] param
import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ExperimentForm } from '@/components/ExperimentForm';
import type { Experiment, ExperimentConfig } from '@/lib/types';

// ─────────────────────────────────────────────────────────────
// Inner component (uses useSearchParams — must be inside Suspense)
// ─────────────────────────────────────────────────────────────

function NewExperimentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromId = searchParams.get('from');

  const [defaultValues, setDefaultValues] = useState<
    (Partial<ExperimentConfig> & { name?: string }) | undefined
  >(undefined);
  const [prefillLoading, setPrefillLoading] = useState(!!fromId);
  const [prefillError, setPrefillError] = useState<string | null>(null);

  // If ?from= is present, fetch that experiment and pre-fill the form
  useEffect(() => {
    if (!fromId) return;
    let mounted = true;

    async function fetchSource() {
      try {
        const res = await fetch(`/api/experiments/${fromId}`);
        if (!mounted) return;
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as Experiment;
        if (!mounted) return;
        // Pre-fill with source config but clear the name (let user pick a new name)
        setDefaultValues({
          ...data.config,
          name: '',
        });
      } catch (e) {
        if (mounted) {
          setPrefillError(
            e instanceof Error ? e.message : 'Failed to load source experiment'
          );
        }
      } finally {
        if (mounted) setPrefillLoading(false);
      }
    }

    void fetchSource();
    return () => { mounted = false; };
  }, [fromId]);

  function handleSuccess(experimentId: string) {
    router.push(`/experiments/${experimentId}`);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to experiments
          </Link>
          <h1 className="text-2xl font-bold mt-3">
            {fromId ? 'Duplicate Experiment' : 'New Experiment'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {fromId
              ? 'Config pre-filled from an existing experiment. Adjust as needed and run.'
              : 'Configure your market parameters and run the strategy agent.'}
          </p>
        </div>

        {/* Prefill loading */}
        {prefillLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mx-auto" />
              <p className="text-muted-foreground text-sm">Loading config...</p>
            </div>
          </div>
        )}

        {/* Prefill error */}
        {prefillError && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300 mb-6">
            {prefillError} — starting with default config.
          </div>
        )}

        {/* Form — show once prefill is done (or if no fromId) */}
        {!prefillLoading && (
          <ExperimentForm
            onSuccess={handleSuccess}
            defaultValues={defaultValues}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Page — wraps content in Suspense (required for useSearchParams)
// ─────────────────────────────────────────────────────────────

export default function NewExperimentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mx-auto" />
            <p className="text-muted-foreground text-sm">Loading...</p>
          </div>
        </div>
      }
    >
      <NewExperimentContent />
    </Suspense>
  );
}
