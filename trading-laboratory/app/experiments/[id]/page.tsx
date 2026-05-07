'use client';

// T022 — Experiment detail page
// T029 — Wire "Evaluate" button
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { StrategyDisplay } from '@/components/StrategyDisplay';
import { EvaluationPanel } from '@/components/EvaluationPanel';
import type { Experiment, ExperimentStatus, EvaluationResult } from '@/lib/types';

// ─────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<ExperimentStatus, { bg: string; text: string }> = {
  pending:  { bg: '#fff8e1', text: '#b45309' },
  running:  { bg: '#e8f0fe', text: '#1a56db' },
  complete: { bg: '#ecfdf5', text: '#065f46' },
  failed:   { bg: '#fef2f2', text: '#b91c1c' },
};

function StatusBadge({ status }: { status: ExperimentStatus }) {
  const { bg, text } = STATUS_COLOR[status];
  return (
    <span style={{
      backgroundColor: bg, color: text, fontSize: 12, fontWeight: 600,
      borderRadius: 9999, padding: '3px 10px', textTransform: 'capitalize',
    }}>
      {status}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Config summary
// ─────────────────────────────────────────────────────────────

function Chip({ label }: { label: string }) {
  return (
    <span style={{
      backgroundColor: '#f5f5f7', color: '#333333', border: '1px solid #e0e0e0',
      borderRadius: 9999, padding: '3px 10px', fontSize: 12, fontWeight: 400, letterSpacing: '-0.12px',
    }}>
      {label}
    </span>
  );
}

function ConfigSummary({ experiment }: { experiment: Experiment }) {
  const { config } = experiment;
  const activeRules = config.propFirmRules.filter((r) => r.enabled);
  return (
    <div className="apple-card">
      <p style={{ fontSize: 11, fontWeight: 600, color: '#7a7a7a', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20 }}>
        Configuration
      </p>
      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px 32px' }}>
        {[
          { label: 'Market', value: config.market },
          { label: 'Symbol', value: config.symbol },
          { label: 'Date Range', value: `${config.dateRange.start} – ${config.dateRange.end}` },
          { label: 'Data Source', value: config.dataSource },
        ].map(({ label, value }) => (
          <div key={label}>
            <dt style={{ fontSize: 11, color: '#7a7a7a', fontWeight: 400, letterSpacing: '-0.224px', marginBottom: 4 }}>{label}</dt>
            <dd style={{ fontSize: 15, color: '#1d1d1f', fontWeight: 400 }}>{value}</dd>
          </div>
        ))}
        <div>
          <dt style={{ fontSize: 11, color: '#7a7a7a', fontWeight: 400, letterSpacing: '-0.224px', marginBottom: 6 }}>Timeframes</dt>
          <dd style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {config.timeframes.map((tf) => <Chip key={tf} label={tf} />)}
          </dd>
        </div>
        <div>
          <dt style={{ fontSize: 11, color: '#7a7a7a', fontWeight: 400, letterSpacing: '-0.224px', marginBottom: 6 }}>Indicators</dt>
          <dd style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {config.indicators.length > 0
              ? config.indicators.map((ind) => <Chip key={ind} label={ind} />)
              : <span style={{ color: '#7a7a7a', fontSize: 14 }}>None</span>}
          </dd>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <dt style={{ fontSize: 11, color: '#7a7a7a', fontWeight: 400, letterSpacing: '-0.224px', marginBottom: 6 }}>Active Prop Firm Rules</dt>
          <dd style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {activeRules.length > 0
              ? activeRules.map((r) => <Chip key={r.name} label={r.name} />)
              : <span style={{ color: '#7a7a7a', fontSize: 14 }}>None</span>}
          </dd>
        </div>
      </dl>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Execution Log (collapsible)
// ─────────────────────────────────────────────────────────────

function ExecutionLog({ log }: { log: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="apple-card" style={{ padding: 0, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', background: 'none', border: 'none', cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: '#7a7a7a', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Execution Log
        </span>
        <span style={{ fontSize: 12, color: '#7a7a7a' }}>{open ? '▲ Hide' : '▼ Show'}</span>
      </button>
      {open && (
        <pre style={{
          margin: 0, padding: '0 24px 20px', fontSize: 12, lineHeight: 1.6,
          color: '#333333', whiteSpace: 'pre-wrap', overflowX: 'auto',
          fontFamily: 'ui-monospace, "SF Mono", "Fira Code", monospace',
        }}>
          {log}
        </pre>
      )}
    </div>
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

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f7' }}>
        <div style={{ backgroundColor: '#ffffff', padding: '48px 24px 40px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ maxWidth: 980, margin: '0 auto' }}>
            <div style={{ width: 100, height: 14, background: '#e0e0e0', borderRadius: 4 }} />
            <div style={{ width: 280, height: 34, background: '#e0e0e0', borderRadius: 4, marginTop: 20 }} />
          </div>
        </div>
        <div style={{ maxWidth: 980, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[...Array(2)].map((_, i) => (
            <div key={i} className="apple-card" style={{ opacity: 0.5 }}>
              <div style={{ height: 80, background: '#e0e0e0', borderRadius: 8 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !experiment) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="apple-card" style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
          <p style={{ color: '#b91c1c', marginBottom: 16 }}>{error ?? 'Experiment not found'}</p>
          <Link href="/" style={{ color: '#0066cc', fontSize: 14, textDecoration: 'none' }}>← Back to experiments</Link>
        </div>
      </div>
    );
  }

  const canEvaluate = experiment.strategy && !evaluation;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f7' }}>
      {/* White header tile */}
      <div style={{ backgroundColor: '#ffffff', padding: '48px 24px 40px', borderBottom: '1px solid #e0e0e0' }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <Link href="/" style={{ fontSize: 14, color: '#7a7a7a', textDecoration: 'none', letterSpacing: '-0.224px' }}>
            ← Experiments
          </Link>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 34, fontWeight: 600, lineHeight: 1.47, letterSpacing: '-0.374px', color: '#1d1d1f', margin: 0 }}>
                {experiment.name}
              </h1>
              <StatusBadge status={experiment.status} />
            </div>
            <Link href={`/experiments/new?from=${id}`} style={{
              backgroundColor: '#fafafc', color: '#333333', border: '1px solid #e0e0e0',
              borderRadius: 11, padding: '7px 13px', fontSize: 13, textDecoration: 'none',
              letterSpacing: '-0.224px', flexShrink: 0,
            }}>
              Duplicate Config
            </Link>
          </div>
          <p style={{ fontSize: 14, color: '#7a7a7a', letterSpacing: '-0.224px', marginTop: 8 }}>
            Created {new Date(experiment.createdAt).toLocaleString()}
            {experiment.completedAt && (
              <> · Completed {new Date(experiment.completedAt).toLocaleString()}</>
            )}
          </p>
        </div>
      </div>

      {/* Content — parchment */}
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '40px 24px 80px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <ConfigSummary experiment={experiment} />

        {experiment.executionLog && <ExecutionLog log={experiment.executionLog} />}

        {/* Strategy */}
        {experiment.strategy ? (
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#7a7a7a', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
              Strategy
            </p>
            {experiment.strategy.allocationNormalized && (
              <div style={{ background: '#fff8e1', border: '1px solid #fde68a', borderRadius: 11, padding: '12px 16px', fontSize: 14, color: '#92400e', marginBottom: 12 }}>
                ⚠️ Allocations exceeded 100% and were proportionally normalised.
              </div>
            )}
            <StrategyDisplay strategy={experiment.strategy} />
          </div>
        ) : experiment.status === 'failed' ? (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 18, padding: 24, textAlign: 'center', color: '#b91c1c', fontSize: 15 }}>
            Strategy generation failed. Check the execution log above for details.
          </div>
        ) : (
          <div style={{ background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: 18, padding: 24, textAlign: 'center', color: '#7a7a7a', fontSize: 15 }}>
            No strategy generated yet.
          </div>
        )}

        {/* Evaluate */}
        {(canEvaluate || evaluating) && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => void handleEvaluate()}
              disabled={evaluating}
              className="apple-btn-primary"
              style={{ opacity: evaluating ? 0.6 : 1 }}
            >
              {evaluating ? (
                <>
                  <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                  Evaluating…
                </>
              ) : 'Evaluate Strategy'}
            </button>
          </div>
        )}

        {evaluationError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 11, padding: '12px 16px', color: '#b91c1c', fontSize: 14 }}>
            {evaluationError}
          </div>
        )}

        {evaluating && <EvaluationPanel evaluation={null} loading />}
        {!evaluating && evaluation && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#7a7a7a', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
              Evaluation
            </p>
            <EvaluationPanel evaluation={evaluation} />
          </div>
        )}
      </div>
    </div>
  );
}
