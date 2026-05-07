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
        setDefaultValues({ ...data.config, name: '' });
      } catch (e) {
        if (mounted) setPrefillError(e instanceof Error ? e.message : 'Failed to load source experiment');
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
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f7' }}>
      {/* White header tile */}
      <div style={{ backgroundColor: '#ffffff', padding: '48px 24px 40px', borderBottom: '1px solid #e0e0e0' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <Link href="/" style={{ fontSize: 14, color: '#7a7a7a', textDecoration: 'none', letterSpacing: '-0.224px' }}>
            ← Experiments
          </Link>
          <h1 style={{
            fontSize: 34, fontWeight: 600, lineHeight: 1.47,
            letterSpacing: '-0.374px', color: '#1d1d1f', marginTop: 16, marginBottom: 8,
          }}>
            {fromId ? 'Duplicate Experiment' : 'New Experiment'}
          </h1>
          <p style={{ fontSize: 15, color: '#7a7a7a', letterSpacing: '-0.224px', margin: 0 }}>
            {fromId
              ? 'Config pre-filled from an existing experiment. Adjust as needed and run.'
              : 'Configure your market parameters and run the strategy agent.'}
          </p>
        </div>
      </div>

      {/* Parchment content */}
      <div style={{ padding: '40px 24px 80px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>

          {prefillLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 0' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  border: '2px solid #e0e0e0', borderTopColor: '#1d1d1f',
                  animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
                }} />
                <p style={{ fontSize: 14, color: '#7a7a7a' }}>Loading config...</p>
              </div>
            </div>
          )}

          {prefillError && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: 11, padding: '12px 16px', color: '#b91c1c',
              fontSize: 14, marginBottom: 20,
            }}>
              {prefillError} — starting with default config.
            </div>
          )}

          {!prefillLoading && (
            <ExperimentForm onSuccess={handleSuccess} defaultValues={defaultValues} />
          )}
        </div>
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
        <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              border: '2px solid #e0e0e0', borderTopColor: '#1d1d1f',
              animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
            }} />
            <p style={{ fontSize: 14, color: '#7a7a7a' }}>Loading...</p>
          </div>
        </div>
      }
    >
      <NewExperimentContent />
    </Suspense>
  );
}
