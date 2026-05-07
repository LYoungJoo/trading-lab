'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface Dataset {
  symbol: string;
  provider: string;
  timeframe: string;
  rowCount: number;
  minDate: string;
  maxDate: string;
}

interface Job {
  id: string;
  symbol: string;
  provider: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  status: string;
  totalRows: number | null;
  insertedRows: number | null;
  errorMessage: string | null;
  createdAt: number;
  completedAt: number | null;
}

interface ProviderInfo {
  id: string;
  name: string;
  supportedTimeframes: string[];
  maxHistoryDays: Record<string, number>;
  timeframeNotes: Record<string, string>;
  notes: string[];
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  startDate?: string;
  endDate?: string;
}

// ─────────────────────────────────────────────────────────────
// Shared styles
// ─────────────────────────────────────────────────────────────

const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#7a7a7a',
  letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16,
};

const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 500, color: '#1d1d1f',
  letterSpacing: '-0.224px', marginBottom: 6,
};

const inputBase: React.CSSProperties = {
  width: '100%', border: '1px solid #e0e0e0', borderRadius: 11,
  padding: '10px 14px', fontSize: 15, color: '#1d1d1f',
  backgroundColor: '#ffffff', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit',
};

function SelectWrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      {children}
      <span style={{
        position: 'absolute', right: 14, top: '50%',
        transform: 'translateY(-50%)', pointerEvents: 'none',
        color: '#7a7a7a', fontSize: 11,
      }}>▾</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export default function DataStoragePage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(true);

  // Form state
  const [selectedProvider, setSelectedProvider] = useState('yahoo');
  const [symbol, setSymbol] = useState('');
  const [timeframe, setTimeframe] = useState('1d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchDatasets = useCallback(async () => {
    try {
      const res = await fetch('/api/data-storage/datasets');
      if (res.ok) setDatasets((await res.json()) as Dataset[]);
    } catch {
      // ignore — keep stale data on transient errors
    } finally {
      setLoadingDatasets(false);
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/data-storage/jobs');
      if (res.ok) setJobs((await res.json()) as Job[]);
    } catch {
      // ignore polling errors
    }
  }, []);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/data-storage/providers');
      if (res.ok) setProviders((await res.json()) as ProviderInfo[]);
    } catch {
      // ignore — providers list is non-critical
    }
  }, []);

  useEffect(() => {
    fetchDatasets();
    fetchJobs();
    fetchProviders();
  }, [fetchDatasets, fetchJobs, fetchProviders]);

  // Poll jobs while any are active
  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === 'pending' || j.status === 'running');
    if (!hasActive) return;
    let mounted = true;
    const interval = setInterval(async () => {
      if (!mounted) return;
      await fetchJobs();
      if (mounted) await fetchDatasets();
    }, 2000);
    return () => { mounted = false; clearInterval(interval); };
  }, [jobs, fetchJobs, fetchDatasets]);

  const currentProvider = providers.find((p) => p.id === selectedProvider);

  async function handleValidate() {
    if (!symbol.trim()) return;
    setValidating(true);
    setValidation(null);
    try {
      const res = await fetch(
        `/api/data-storage/symbols?symbol=${encodeURIComponent(symbol)}&provider=${selectedProvider}&timeframe=${timeframe}`
      );
      const data = await res.json();
      setValidation(data);
      if (data.valid) {
        setStartDate(data.startDate ?? '');
        setEndDate(data.endDate ?? '');
      }
    } catch {
      setValidation({ valid: false, error: 'Network error' });
    } finally {
      setValidating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validation?.valid) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/data-storage/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, provider: selectedProvider, timeframe, startDate, endDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to start download');
      setSymbol('');
      setValidation(null);
      setStartDate('');
      setEndDate('');
      await fetchJobs();
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(sym: string, provider: string) {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete all ${sym} data from ${provider}?`)) return;
    setDeleteError(null);
    try {
      const res = await fetch(`/api/data-storage/datasets/${encodeURIComponent(sym)}?provider=${provider}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Delete failed');
    }
    await fetchDatasets();
  }

  const activeJobs = jobs.filter((j) => j.status === 'pending' || j.status === 'running');
  const failedJobs = jobs.filter((j) => j.status === 'failed').slice(0, 3);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f7' }}>

      {/* White header tile */}
      <div style={{ backgroundColor: '#ffffff', padding: '48px 24px 40px', borderBottom: '1px solid #e0e0e0' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#7a7a7a', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              Prop Trading Simulator
            </p>
            <h1 style={{ fontSize: 40, fontWeight: 600, lineHeight: 1.1, letterSpacing: 0, color: '#1d1d1f', margin: 0 }}>
              Data Storage
            </h1>
          </div>
        </div>
      </div>

      {/* Content — parchment */}
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '40px 24px 80px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Active Downloads */}
        {activeJobs.length > 0 && (
          <div className="apple-card">
            <p style={sectionLabel}>Active Downloads</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {activeJobs.map((job) => {
                const percent = job.totalRows != null && job.totalRows > 0
                  ? ((job.insertedRows ?? 0) / job.totalRows) * 100
                  : 0;
                return (
                  <div key={job.id}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 15, fontWeight: 500, color: '#1d1d1f' }}>
                        {job.symbol} <span style={{ color: '#7a7a7a', fontWeight: 400 }}>{job.timeframe}</span>
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
                        borderRadius: 9999, padding: '2px 8px', textTransform: 'capitalize',
                        backgroundColor: job.status === 'running' ? '#e8f0fe' : '#fff8e1',
                        color: job.status === 'running' ? '#1a56db' : '#b45309',
                      }}>
                        {job.status}
                      </span>
                    </div>
                    <div style={{ height: 4, backgroundColor: '#f0f0f0', borderRadius: 9999, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', backgroundColor: '#0066cc', borderRadius: 9999,
                        width: `${percent}%`, transition: 'width 0.4s ease',
                        minWidth: percent > 0 ? 4 : 0,
                      }} />
                    </div>
                    <p style={{ fontSize: 12, color: '#7a7a7a', marginTop: 4 }}>
                      {job.insertedRows != null ? `${job.insertedRows.toLocaleString()} rows inserted` : 'Starting…'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Failed job notices */}
        {failedJobs.map((job) => (
          <div key={job.id} style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 11, padding: '12px 16px', fontSize: 14, color: '#b91c1c',
          }}>
            <strong>{job.symbol} {job.timeframe}</strong> download failed: {job.errorMessage}
          </div>
        ))}

        {/* Delete error */}
        {deleteError && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 11, padding: '12px 16px', fontSize: 14, color: '#b91c1c',
          }}>
            Delete failed: {deleteError}
          </div>
        )}

        {/* Downloaded Datasets */}
        <div className="apple-card">
          <p style={sectionLabel}>Downloaded Datasets</p>
          {loadingDatasets ? (
            <p style={{ fontSize: 14, color: '#7a7a7a' }}>Loading...</p>
          ) : datasets.length === 0 ? (
            <p style={{ fontSize: 14, color: '#7a7a7a', textAlign: 'center', padding: '24px 0' }}>
              No datasets downloaded yet. Use the form below to get started.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                    {['Symbol', 'Provider', 'Timeframe', 'Rows', 'Date Range', ''].map((h) => (
                      <th key={h} style={{
                        textAlign: h === 'Rows' ? 'right' : h === '' ? 'right' : 'left',
                        padding: '8px 12px 8px 0', fontSize: 11, fontWeight: 600,
                        color: '#7a7a7a', letterSpacing: '0.05em', textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {datasets.map((d) => (
                    <tr key={`${d.symbol}-${d.provider}-${d.timeframe}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '12px 12px 12px 0', fontWeight: 500, color: '#1d1d1f' }}>{d.symbol}</td>
                      <td style={{ padding: '12px 12px 12px 0', color: '#7a7a7a', textTransform: 'capitalize' }}>{d.provider}</td>
                      <td style={{ padding: '12px 12px 12px 0' }}>
                        <span style={{
                          backgroundColor: '#f5f5f7', color: '#333333', border: '1px solid #e0e0e0',
                          borderRadius: 9999, padding: '2px 8px', fontSize: 12,
                        }}>
                          {d.timeframe}
                        </span>
                      </td>
                      <td style={{ padding: '12px 12px 12px 0', textAlign: 'right', color: '#1d1d1f', fontVariantNumeric: 'tabular-nums' }}>
                        {d.rowCount.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 12px 12px 0', color: '#7a7a7a', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {d.minDate} → {d.maxDate}
                      </td>
                      <td style={{ padding: '12px 0', textAlign: 'right' }}>
                        <button
                          onClick={() => handleDelete(d.symbol, d.provider)}
                          style={{
                            fontSize: 13, color: '#b91c1c', background: 'none', border: 'none',
                            cursor: 'pointer', padding: '4px 8px', borderRadius: 8, fontFamily: 'inherit',
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* New Download Form */}
        <div className="apple-card">
          <p style={sectionLabel}>New Download</p>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={fieldLabel}>Provider</label>
                <SelectWrap>
                  <select
                    value={selectedProvider}
                    onChange={(e) => {
                      setSelectedProvider(e.target.value);
                      setSymbol('');
                      setValidation(null);
                    }}
                    style={{ ...inputBase, paddingRight: 36, cursor: 'pointer' } as React.CSSProperties}
                  >
                    {providers.length > 0
                      ? providers.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))
                      : <option value="yahoo">Yahoo Finance</option>
                    }
                  </select>
                </SelectWrap>
              </div>
              <div>
                <label style={fieldLabel}>Timeframe</label>
                <SelectWrap>
                  <select
                    value={timeframe}
                    onChange={(e) => { setTimeframe(e.target.value); setValidation(null); }}
                    style={{ ...inputBase, paddingRight: 36, cursor: 'pointer' } as React.CSSProperties}
                  >
                    {(currentProvider?.supportedTimeframes ?? ['1m', '5m', '1h', '1d', '1w']).map((tf) => (
                      <option key={tf} value={tf}>{tf}</option>
                    ))}
                  </select>
                </SelectWrap>
                {currentProvider?.timeframeNotes?.[timeframe] && (
                  <p style={{ fontSize: 12, color: '#7a7a7a', marginTop: 4 }}>
                    {currentProvider.timeframeNotes[timeframe]}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label style={fieldLabel}>Symbol</label>
              <input
                value={symbol}
                onChange={(e) => { setSymbol(e.target.value); setValidation(null); }}
                onBlur={() => handleValidate()}
                placeholder={
                  selectedProvider === 'binance'
                    ? 'e.g. BTCUSDT, ETHUSDT'
                    : 'e.g. MNQ=F, ES=F, BTC-USD, AAPL'
                }
                style={inputBase}
              />
              {validating && (
                <p style={{ fontSize: 12, color: '#7a7a7a', marginTop: 4 }}>Checking symbol...</p>
              )}
              <div style={{ fontSize: 12, color: '#7a7a7a', marginTop: 6 }}>
                {selectedProvider === 'binance' ? (
                  <p>Format: <code style={{ backgroundColor: '#f5f5f7', padding: '1px 5px', borderRadius: 4 }}>BTCUSDT</code>, <code style={{ backgroundColor: '#f5f5f7', padding: '1px 5px', borderRadius: 4 }}>ETHUSDT</code> (uppercase, no hyphen)</p>
                ) : selectedProvider === 'yahoo' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <p><strong>Futures</strong> — append <code style={{ backgroundColor: '#f5f5f7', padding: '1px 5px', borderRadius: 4 }}>=F</code>: <code style={{ backgroundColor: '#f5f5f7', padding: '1px 5px', borderRadius: 4 }}>MNQ=F</code>, <code style={{ backgroundColor: '#f5f5f7', padding: '1px 5px', borderRadius: 4 }}>ES=F</code></p>
                    <p><strong>Crypto</strong> — <code style={{ backgroundColor: '#f5f5f7', padding: '1px 5px', borderRadius: 4 }}>BTC-USD</code>, <code style={{ backgroundColor: '#f5f5f7', padding: '1px 5px', borderRadius: 4 }}>ETH-USD</code></p>
                    <p><strong>Stocks</strong> — <code style={{ backgroundColor: '#f5f5f7', padding: '1px 5px', borderRadius: 4 }}>AAPL</code>, <code style={{ backgroundColor: '#f5f5f7', padding: '1px 5px', borderRadius: 4 }}>SPY</code></p>
                  </div>
                ) : null}
              </div>
              {validation && (
                <p style={{ fontSize: 12, marginTop: 6, color: validation.valid ? '#059669' : '#b91c1c' }}>
                  {validation.valid
                    ? `✓ Valid — available range: ${validation.startDate} to ${validation.endDate}`
                    : `✗ ${validation.error}`}
                </p>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={fieldLabel}>Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  min={validation?.startDate}
                  max={validation?.endDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={!validation?.valid}
                  style={{ ...inputBase, opacity: !validation?.valid ? 0.5 : 1 }}
                />
              </div>
              <div>
                <label style={fieldLabel}>End Date</label>
                <input
                  type="date"
                  value={endDate}
                  min={validation?.startDate}
                  max={validation?.endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={!validation?.valid}
                  style={{ ...inputBase, opacity: !validation?.valid ? 0.5 : 1 }}
                />
              </div>
            </div>

            {submitError && (
              <p style={{ fontSize: 13, color: '#b91c1c' }}>{submitError}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !validation?.valid || !startDate || !endDate}
              className="apple-btn-primary"
              style={{
                alignSelf: 'flex-start',
                opacity: (submitting || !validation?.valid || !startDate || !endDate) ? 0.6 : 1,
                cursor: (submitting || !validation?.valid || !startDate || !endDate) ? 'default' : 'pointer',
              }}
            >
              {submitting ? 'Starting…' : 'Start Download'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
