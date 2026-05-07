'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
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
      } catch { /* ignore */ }
    }, 4000);
    return () => { mounted = false; clearInterval(interval); };
  }, [experiments]);

  const evaluated = experiments.filter((e) => e.evaluation !== undefined);
  const unevaluated = experiments.filter((e) => e.evaluation === undefined);

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#f5f5f7' }}>
      {/* Hero section — white tile */}
      <section style={{ backgroundColor: '#ffffff', padding: '64px 24px 56px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#7a7a7a', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              Prop Trading Simulator
            </p>
            <h1 style={{ fontSize: 40, fontWeight: 600, lineHeight: 1.1, letterSpacing: 0, color: '#1d1d1f', margin: 0 }}>
              Experiments
            </h1>
          </div>
          <Link href="/experiments/new" className="apple-btn-primary">
            New Experiment
          </Link>
        </div>
      </section>

      {/* Content section — parchment */}
      <section style={{ backgroundColor: '#f5f5f7', padding: '48px 24px 80px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>

          {/* Loading skeletons */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="apple-card" style={{ opacity: 0.5 }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e0e0e0' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 17, width: 200, background: '#e0e0e0', borderRadius: 4, marginBottom: 8 }} />
                      <div style={{ height: 13, width: 280, background: '#e0e0e0', borderRadius: 4 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 11, padding: '14px 18px', color: '#b91c1c', fontSize: 15 }}>
              {error}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && experiments.length === 0 && (
            <div style={{ textAlign: 'center', padding: '80px 24px' }}>
              <h2 style={{ fontSize: 28, fontWeight: 400, color: '#1d1d1f', letterSpacing: 0.196, marginBottom: 8 }}>
                No experiments yet
              </h2>
              <p style={{ fontSize: 17, color: '#7a7a7a', marginBottom: 32 }}>
                Download data first, then run your first experiment.
              </p>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href="/data-storage" style={{
                  backgroundColor: '#fafafc', color: '#333333', border: '1px solid #e0e0e0',
                  borderRadius: 9999, padding: '11px 22px', fontSize: 17, textDecoration: 'none',
                }}>
                  Data Storage
                </Link>
                <Link href="/experiments/new" className="apple-btn-primary">
                  New Experiment
                </Link>
              </div>
            </div>
          )}

          {/* Ranked */}
          {!loading && !error && evaluated.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#7a7a7a', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
                Ranked by Score
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {evaluated.map((exp, idx) => (
                  <ExperimentCard key={exp.id} experiment={exp} rank={idx + 1} />
                ))}
              </div>
            </div>
          )}

          {/* Unevaluated */}
          {!loading && !error && unevaluated.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#7a7a7a', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
                Awaiting Evaluation
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {unevaluated.map((exp) => (
                  <ExperimentCard key={exp.id} experiment={exp} rank={null} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
