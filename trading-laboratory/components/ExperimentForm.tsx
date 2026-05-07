'use client';

// T019 — ExperimentForm component
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import type {
  Market,
  Timeframe,
  Indicator,
  PropFirmRuleName,
  ExperimentConfig,
  PropFirmRule,
} from '@/lib/types';

interface DatasetSummary {
  symbol: string;
  provider: string;
  timeframe: string;
  rowCount: number;
  minDate: string;
  maxDate: string;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<string, string> = {
  yahoo: 'Yahoo Finance',
  binance: 'Binance',
  alphavantage: 'Alpha Vantage',
  krx: 'KRX',
};

const PROVIDER_TO_MARKET: Record<string, Market> = {
  yahoo: 'us-futures',
  binance: 'crypto',
  alphavantage: 'us-futures',
  krx: 'kr-futures',
};

const TIMEFRAME_OPTIONS: { label: string; value: Timeframe }[] = [
  { label: '1 min', value: '1m' },
  { label: '5 min', value: '5m' },
  { label: '1 hour', value: '1h' },
  { label: 'Daily', value: 'day' },
  { label: 'Weekly', value: 'week' },
];

const INDICATOR_OPTIONS: { label: string; value: Indicator }[] = [
  { label: 'RSI (14)', value: 'RSI' },
  { label: 'MACD (12/26/9)', value: 'MACD' },
  { label: '20-period MA', value: '20MA' },
  { label: '50-period MA', value: '50MA' },
  { label: 'Volume', value: 'volume' },
  { label: 'Order Book', value: 'order-book' },
];

const PROP_FIRM_RULE_OPTIONS: { label: string; value: PropFirmRuleName; description: string }[] = [
  { label: 'Daily Loss Limit', value: 'Daily Loss Limit', description: 'Cannot lose more than X% of account in a single trading day' },
  { label: 'Max Loss', value: 'Max Loss', description: 'Overall maximum drawdown from peak equity' },
  { label: 'Profit Target', value: 'Profit Target', description: 'Must reach X% profit target to pass evaluation' },
  { label: 'Time Limit', value: 'Time Limit', description: 'Must complete evaluation within a specified number of trading days' },
  { label: 'Consistency', value: 'Consistency', description: 'No single day profit can exceed X% of total profit (consistency rule)' },
];

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface ExperimentFormProps {
  onSuccess: (experimentId: string) => void;
  defaultValues?: Partial<ExperimentConfig> & { name?: string };
}

interface FormState {
  name: string;
  provider: string;
  symbol: string;
  startDate: string;
  endDate: string;
  timeframes: Timeframe[];
  indicators: Indicator[];
  propFirmRules: Record<PropFirmRuleName, boolean>;
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

export function ExperimentForm({ onSuccess, defaultValues }: ExperimentFormProps) {
  const [form, setForm] = useState<FormState>(() => {
    const defaultRules = Object.fromEntries(
      PROP_FIRM_RULE_OPTIONS.map((r) => {
        const match = defaultValues?.propFirmRules?.find((pr) => pr.name === r.value);
        return [r.value, match ? match.enabled : false];
      })
    ) as Record<PropFirmRuleName, boolean>;

    return {
      name: defaultValues?.name ?? '',
      provider: defaultValues?.dataSource ?? '',
      symbol: defaultValues?.symbol ?? '',
      startDate: defaultValues?.dateRange?.start ?? '',
      endDate: defaultValues?.dateRange?.end ?? '',
      timeframes: defaultValues?.timeframes ?? ['1h'],
      indicators: defaultValues?.indicators ?? ['RSI', 'MACD'],
      propFirmRules: defaultRules,
    };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [availableDatasets, setAvailableDatasets] = useState<DatasetSummary[]>([]);

  useEffect(() => {
    let mounted = true;
    fetch('/api/data-storage/datasets')
      .then((r): Promise<DatasetSummary[]> => r.ok ? (r.json() as Promise<DatasetSummary[]>) : Promise.resolve([]))
      .then((data) => {
        if (!mounted) return;
        setAvailableDatasets(data);
        if (data.length > 0 && !defaultValues?.symbol) {
          const firstProvider = data[0].provider;
          const firstSymbol = data.find((d) => d.provider === firstProvider)?.symbol ?? data[0].symbol;
          const datasets = data.filter((d) => d.symbol === firstSymbol && d.provider === firstProvider);
          const minDate = datasets.reduce((m, d) => (d.minDate < m ? d.minDate : m), datasets[0].minDate);
          const maxDate = datasets.reduce((m, d) => (d.maxDate > m ? d.maxDate : m), datasets[0].maxDate);
          setForm((f) => ({ ...f, provider: firstProvider, symbol: firstSymbol, startDate: minDate, endDate: maxDate }));
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [defaultValues?.symbol]);

  const availableProviders = Array.from(new Set(availableDatasets.map((d) => d.provider)));
  const hasDownloadedData = availableProviders.length > 0;

  const symbolsForProvider = Array.from(
    new Set(availableDatasets.filter((d) => d.provider === form.provider).map((d) => d.symbol))
  );

  const selectedDatasets = availableDatasets.filter(
    (d) => d.symbol === form.symbol && d.provider === form.provider
  );
  const selectedSymbolRange =
    selectedDatasets.length > 0
      ? {
          minDate: selectedDatasets.reduce((m, d) => (d.minDate < m ? d.minDate : m), selectedDatasets[0].minDate),
          maxDate: selectedDatasets.reduce((m, d) => (d.maxDate > m ? d.maxDate : m), selectedDatasets[0].maxDate),
        }
      : null;

  const dbToInternalTimeframe: Record<string, Timeframe> = {
    '1m': '1m', '5m': '5m', '1h': '1h', '1d': 'day', '1w': 'week',
  };
  const availableTimeframesForSymbol: Set<Timeframe> = new Set(
    selectedDatasets
      .map((d) => dbToInternalTimeframe[d.timeframe])
      .filter((tf): tf is Timeframe => tf !== undefined)
  );

  function handleProviderChange(provider: string) {
    const providerDatasets = availableDatasets.filter((d) => d.provider === provider);
    if (providerDatasets.length === 0) {
      setForm((f) => ({ ...f, provider, symbol: '', startDate: '', endDate: '' }));
      return;
    }
    const firstSymbol = providerDatasets[0].symbol;
    const symDatasets = providerDatasets.filter((d) => d.symbol === firstSymbol);
    const minDate = symDatasets.reduce((m, d) => (d.minDate < m ? d.minDate : m), symDatasets[0].minDate);
    const maxDate = symDatasets.reduce((m, d) => (d.maxDate > m ? d.maxDate : m), symDatasets[0].maxDate);
    const newTfs: Set<Timeframe> = new Set(
      symDatasets.map((d) => dbToInternalTimeframe[d.timeframe]).filter((tf): tf is Timeframe => tf !== undefined)
    );
    setForm((f) => ({
      ...f, provider, symbol: firstSymbol, startDate: minDate, endDate: maxDate,
      timeframes: f.timeframes.filter((tf) => newTfs.has(tf)),
    }));
  }

  function handleSymbolChange(sym: string) {
    const datasets = availableDatasets.filter((d) => d.symbol === sym && d.provider === form.provider);
    if (datasets.length === 0) return;
    const minDate = datasets.reduce((m, d) => (d.minDate < m ? d.minDate : m), datasets[0].minDate);
    const maxDate = datasets.reduce((m, d) => (d.maxDate > m ? d.maxDate : m), datasets[0].maxDate);
    const newTfs: Set<Timeframe> = new Set(
      datasets.map((d) => dbToInternalTimeframe[d.timeframe]).filter((tf): tf is Timeframe => tf !== undefined)
    );
    setForm((f) => ({
      ...f, symbol: sym, startDate: minDate, endDate: maxDate,
      timeframes: f.timeframes.filter((tf) => newTfs.has(tf)),
    }));
  }

  function toggleTimeframe(tf: Timeframe) {
    setForm((f) => ({
      ...f,
      timeframes: f.timeframes.includes(tf) ? f.timeframes.filter((t) => t !== tf) : [...f.timeframes, tf],
    }));
  }

  function toggleIndicator(ind: Indicator) {
    setForm((f) => ({
      ...f,
      indicators: f.indicators.includes(ind) ? f.indicators.filter((i) => i !== ind) : [...f.indicators, ind],
    }));
  }

  function togglePropRule(rule: PropFirmRuleName) {
    setForm((f) => ({
      ...f,
      propFirmRules: { ...f.propFirmRules, [rule]: !f.propFirmRules[rule] },
    }));
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Experiment name is required';
    if (!form.symbol.trim()) newErrors.symbol = 'Symbol is required';
    if (!form.startDate) newErrors.startDate = 'Start date is required';
    if (!form.endDate) newErrors.endDate = 'End date is required';
    if (form.startDate && form.endDate && form.startDate >= form.endDate) {
      newErrors.endDate = 'End date must be after start date';
    }
    if (form.timeframes.length === 0) newErrors.timeframes = 'Select at least one timeframe';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const config: ExperimentConfig = {
      market: PROVIDER_TO_MARKET[form.provider] ?? 'us-futures',
      dataSource: form.provider as ExperimentConfig['dataSource'],
      symbol: form.symbol.trim().toUpperCase(),
      dateRange: { start: form.startDate, end: form.endDate },
      timeframes: form.timeframes,
      indicators: form.indicators,
      propFirmRules: PROP_FIRM_RULE_OPTIONS.map((r): PropFirmRule => ({
        name: r.value, enabled: form.propFirmRules[r.value], description: r.description,
      })),
    };

    setIsLoading(true);
    setLoadingStep('Creating experiment...');

    try {
      const createRes = await fetch('/api/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), config }),
      });

      if (!createRes.ok) {
        let errMsg = 'Failed to create experiment';
        try {
          const err = (await createRes.json()) as { error?: string };
          if (err.error) errMsg = err.error;
        } catch { /* ignore */ }
        throw new Error(errMsg);
      }

      const created = (await createRes.json()) as { id: string };
      const experimentId = created.id;

      setLoadingStep('Running strategy agent (fetching data + generating strategy)...');

      const runRes = await fetch(`/api/experiments/${experimentId}/run`, { method: 'POST' });

      if (!runRes.ok) {
        onSuccess(experimentId);
        return;
      }

      onSuccess(experimentId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setErrors({ submit: msg });
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  }

  // ─── Render ────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Experiment Details */}
      <div className="apple-card">
        <p style={sectionLabel}>Experiment Details</p>
        <label style={fieldLabel} htmlFor="exp-name">
          Experiment Name <span style={{ color: '#b91c1c' }}>*</span>
        </label>
        <input
          id="exp-name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g. BTC Bull Run Q1 2024"
          disabled={isLoading}
          style={{ ...inputBase, opacity: isLoading ? 0.6 : 1 }}
        />
        {errors.name && <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{errors.name}</p>}
      </div>

      {/* Market Configuration */}
      <div className="apple-card">
        <p style={sectionLabel}>Market Configuration</p>

        {!hasDownloadedData ? (
          <div style={{
            border: '1px solid #fde68a', backgroundColor: '#fff8e1',
            borderRadius: 11, padding: '12px 16px', fontSize: 14, color: '#92400e',
          }}>
            No data downloaded yet.{' '}
            <Link href="/data-storage" style={{ color: '#0066cc', textDecoration: 'none', fontWeight: 500 }}>
              Go to Data Storage
            </Link>{' '}
            to download market data first.
          </div>
        ) : (
          <>
            {/* Provider */}
            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabel} htmlFor="provider">Provider</label>
              <SelectWrap>
                <select
                  id="provider"
                  value={form.provider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  disabled={isLoading}
                  style={{ ...inputBase, paddingRight: 36, cursor: 'pointer', opacity: isLoading ? 0.6 : 1 } as React.CSSProperties}
                >
                  {availableProviders.map((p) => (
                    <option key={p} value={p}>{PROVIDER_LABELS[p] ?? p}</option>
                  ))}
                </select>
              </SelectWrap>
            </div>

            {/* Symbol */}
            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabel} htmlFor="symbol">
                Symbol <span style={{ color: '#b91c1c' }}>*</span>
              </label>
              <SelectWrap>
                <select
                  id="symbol"
                  value={form.symbol}
                  onChange={(e) => { if (e.target.value) handleSymbolChange(e.target.value); }}
                  disabled={isLoading || symbolsForProvider.length === 0}
                  style={{ ...inputBase, paddingRight: 36, cursor: 'pointer', opacity: isLoading ? 0.6 : 1 } as React.CSSProperties}
                >
                  {symbolsForProvider.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </SelectWrap>
              {errors.symbol && <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{errors.symbol}</p>}
            </div>

            {selectedSymbolRange && (
              <p style={{ fontSize: 12, color: '#7a7a7a', marginBottom: 16 }}>
                Date range locked to downloaded data: {selectedSymbolRange.minDate} → {selectedSymbolRange.maxDate}
              </p>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={fieldLabel} htmlFor="start-date">
                  Start Date <span style={{ color: '#b91c1c' }}>*</span>
                </label>
                <input
                  id="start-date"
                  type="date"
                  value={form.startDate}
                  min={selectedSymbolRange?.minDate}
                  max={selectedSymbolRange?.maxDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  disabled={isLoading}
                  style={{ ...inputBase, opacity: isLoading ? 0.6 : 1 }}
                />
                {errors.startDate && <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{errors.startDate}</p>}
              </div>
              <div>
                <label style={fieldLabel} htmlFor="end-date">
                  End Date <span style={{ color: '#b91c1c' }}>*</span>
                </label>
                <input
                  id="end-date"
                  type="date"
                  value={form.endDate}
                  min={selectedSymbolRange?.minDate}
                  max={selectedSymbolRange?.maxDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  disabled={isLoading}
                  style={{ ...inputBase, opacity: isLoading ? 0.6 : 1 }}
                />
                {errors.endDate && <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{errors.endDate}</p>}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Timeframes */}
      <div className="apple-card">
        <p style={sectionLabel}>Timeframes</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TIMEFRAME_OPTIONS.filter((tf) =>
            !hasDownloadedData || availableTimeframesForSymbol.size === 0 || availableTimeframesForSymbol.has(tf.value)
          ).map((tf) => {
            const selected = form.timeframes.includes(tf.value);
            return (
              <button
                key={tf.value}
                type="button"
                onClick={() => toggleTimeframe(tf.value)}
                disabled={isLoading}
                style={{
                  border: selected ? '1.5px solid #0066cc' : '1px solid #e0e0e0',
                  backgroundColor: selected ? '#e8f2ff' : '#ffffff',
                  color: selected ? '#0066cc' : '#333333',
                  borderRadius: 9999, padding: '7px 18px', fontSize: 14, fontWeight: 400,
                  cursor: isLoading ? 'default' : 'pointer', opacity: isLoading ? 0.6 : 1,
                  fontFamily: 'inherit',
                }}
              >
                {tf.label}
              </button>
            );
          })}
        </div>
        {errors.timeframes && <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 8 }}>{errors.timeframes}</p>}
      </div>

      {/* Indicators */}
      <div className="apple-card">
        <p style={sectionLabel}>Indicators</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {INDICATOR_OPTIONS.map((ind) => {
            const selected = form.indicators.includes(ind.value);
            return (
              <button
                key={ind.value}
                type="button"
                onClick={() => toggleIndicator(ind.value)}
                disabled={isLoading}
                style={{
                  border: selected ? '1.5px solid #0066cc' : '1px solid #e0e0e0',
                  backgroundColor: selected ? '#e8f2ff' : '#ffffff',
                  color: selected ? '#0066cc' : '#333333',
                  borderRadius: 9999, padding: '8px 16px', fontSize: 14, fontWeight: 400,
                  cursor: isLoading ? 'default' : 'pointer', opacity: isLoading ? 0.6 : 1,
                  textAlign: 'center', fontFamily: 'inherit',
                }}
              >
                {ind.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Prop Firm Rules */}
      <div className="apple-card">
        <p style={sectionLabel}>Prop Firm Rules</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PROP_FIRM_RULE_OPTIONS.map((rule) => {
            const selected = form.propFirmRules[rule.value];
            return (
              <button
                key={rule.value}
                type="button"
                onClick={() => togglePropRule(rule.value)}
                disabled={isLoading}
                style={{
                  border: selected ? '1.5px solid #059669' : '1px solid #e0e0e0',
                  backgroundColor: selected ? '#ecfdf5' : '#ffffff',
                  borderRadius: 11, padding: '12px 16px',
                  cursor: isLoading ? 'default' : 'pointer',
                  textAlign: 'left', opacity: isLoading ? 0.6 : 1,
                  fontFamily: 'inherit',
                }}
              >
                <p style={{ fontSize: 14, fontWeight: 500, color: selected ? '#065f46' : '#1d1d1f', margin: '0 0 2px' }}>
                  {rule.label}
                </p>
                <p style={{ fontSize: 12, color: '#7a7a7a', margin: 0 }}>
                  {rule.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Submit error */}
      {errors.submit && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 11, padding: '12px 16px', color: '#b91c1c', fontSize: 14,
        }}>
          {errors.submit}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading || !hasDownloadedData}
        className="apple-btn-primary"
        style={{
          width: '100%', justifyContent: 'center',
          opacity: (isLoading || !hasDownloadedData) ? 0.6 : 1,
          cursor: (isLoading || !hasDownloadedData) ? 'default' : 'pointer',
        }}
      >
        {isLoading ? (
          <>
            <span style={{
              width: 14, height: 14, borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff',
              display: 'inline-block', animation: 'spin 0.8s linear infinite',
            }} />
            {loadingStep || 'Running...'}
          </>
        ) : 'Run Experiment'}
      </button>
    </form>
  );
}
