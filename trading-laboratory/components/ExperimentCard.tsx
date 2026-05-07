'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Experiment, ExperimentStatus } from '@/lib/types';

const STATUS_COLOR: Record<ExperimentStatus, { bg: string; text: string }> = {
  pending:  { bg: '#fff8e1', text: '#b45309' },
  running:  { bg: '#e8f0fe', text: '#1a56db' },
  complete: { bg: '#ecfdf5', text: '#065f46' },
  failed:   { bg: '#fef2f2', text: '#b91c1c' },
};

function StatusPill({ status }: { status: ExperimentStatus }) {
  const { bg, text } = STATUS_COLOR[status];
  return (
    <span style={{
      backgroundColor: bg,
      color: text,
      fontSize: 11,
      fontWeight: 600,
      lineHeight: 1,
      letterSpacing: 0.2,
      borderRadius: 9999,
      padding: '3px 8px',
      textTransform: 'capitalize' as const,
    }}>
      {status}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? '#065f46' : score >= 40 ? '#b45309' : '#b91c1c';
  const bg = score >= 70 ? '#ecfdf5' : score >= 40 ? '#fff8e1' : '#fef2f2';
  return (
    <span style={{
      backgroundColor: bg,
      color,
      fontSize: 12,
      fontWeight: 700,
      borderRadius: 9999,
      padding: '2px 8px',
      lineHeight: 1.4,
    }}>
      {Math.round(score)}
    </span>
  );
}

interface ExperimentCardProps {
  experiment: Experiment;
  rank: number | null;
}

export function ExperimentCard({ experiment, rank }: ExperimentCardProps) {
  const router = useRouter();
  const { id, name, status, config, evaluation } = experiment;
  const compositeScore = evaluation?.compositeScore ?? null;

  function handleDuplicate(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/experiments/new?from=${id}`);
  }

  return (
    <Link href={`/experiments/${id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        className="apple-card"
        style={{ display: 'flex', alignItems: 'flex-start', gap: 16, cursor: 'pointer', transition: 'box-shadow 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)')}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
      >
        {/* Rank */}
        <div style={{
          flexShrink: 0, width: 36, height: 36, borderRadius: '50%',
          background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 600, color: '#7a7a7a', marginTop: 2,
        }}>
          {rank !== null ? `#${rank}` : '—'}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 17, letterSpacing: '-0.374px', color: '#1d1d1f' }}>
              {name}
            </span>
            <StatusPill status={status} />
            {compositeScore !== null && <ScoreBadge score={compositeScore} />}
          </div>
          <p style={{ fontSize: 14, color: '#7a7a7a', letterSpacing: '-0.224px', margin: 0 }}>
            {config.market} · {config.symbol} · {config.dateRange.start} – {config.dateRange.end}
          </p>
          {evaluation ? (
            <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 13, color: '#7a7a7a' }}>
              <span>Compliance <strong style={{ color: '#1d1d1f' }}>{evaluation.complianceScore}</strong></span>
              <span>Risk <strong style={{ color: '#1d1d1f' }}>{evaluation.riskQualityScore}</strong></span>
              <span>Clarity <strong style={{ color: '#1d1d1f' }}>{evaluation.clarityScore}</strong></span>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: '#7a7a7a', fontStyle: 'italic', margin: '6px 0 0' }}>Not evaluated</p>
          )}
        </div>

        {/* Duplicate button */}
        <button
          onClick={handleDuplicate}
          style={{
            flexShrink: 0, backgroundColor: '#fafafc', color: '#333333',
            border: '1px solid #e0e0e0', borderRadius: 11, padding: '7px 13px',
            fontSize: 13, fontWeight: 400, letterSpacing: '-0.224px', cursor: 'pointer',
            transition: 'transform 0.1s', lineHeight: 1.29,
          }}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          Duplicate
        </button>
      </div>
    </Link>
  );
}
