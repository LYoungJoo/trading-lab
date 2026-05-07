'use client';

// T019 — ExperimentForm component
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type {
  Market,
  DataSource,
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

const MARKET_OPTIONS: { label: string; value: Market; dataSource: DataSource }[] = [
  { label: 'Crypto (Binance)', value: 'crypto', dataSource: 'binance' },
  { label: 'US Futures (Alpha Vantage)', value: 'us-futures', dataSource: 'alphavantage' },
  { label: 'KR Futures (KRX)', value: 'kr-futures', dataSource: 'krx' },
];

const TIMEFRAME_OPTIONS: { label: string; value: Timeframe }[] = [
  { label: '1 Minute', value: '1m' },
  { label: '5 Minutes', value: '5m' },
  { label: '1 Hour', value: '1h' },
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
  {
    label: 'Daily Loss Limit',
    value: 'Daily Loss Limit',
    description: 'Cannot lose more than X% of account in a single trading day',
  },
  {
    label: 'Max Loss',
    value: 'Max Loss',
    description: 'Overall maximum drawdown from peak equity',
  },
  {
    label: 'Profit Target',
    value: 'Profit Target',
    description: 'Must reach X% profit target to pass evaluation',
  },
  {
    label: 'Time Limit',
    value: 'Time Limit',
    description: 'Must complete evaluation within a specified number of trading days',
  },
  {
    label: 'Consistency',
    value: 'Consistency',
    description: 'No single day profit can exceed X% of total profit (consistency rule)',
  },
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
  market: Market;
  dataSource: DataSource;
  symbol: string;
  startDate: string;
  endDate: string;
  timeframes: Timeframe[];
  indicators: Indicator[];
  propFirmRules: Record<PropFirmRuleName, boolean>;
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
      market: defaultValues?.market ?? 'crypto',
      dataSource: defaultValues?.dataSource ?? 'binance',
      symbol: defaultValues?.symbol ?? 'BTCUSDT',
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
        // Auto-select the first downloaded symbol if none is pre-selected via defaultValues
        if (data.length > 0 && !defaultValues?.symbol) {
          const firstSymbol = data[0].symbol;
          const datasets = data.filter((d) => d.symbol === firstSymbol);
          const minDate = datasets.reduce((m, d) => (d.minDate < m ? d.minDate : m), datasets[0].minDate);
          const maxDate = datasets.reduce((m, d) => (d.maxDate > m ? d.maxDate : m), datasets[0].maxDate);
          const provider = datasets[0].provider;
          const dataSource: DataSource = provider === 'binance' ? 'binance' : 'binance';
          setForm((f) => ({ ...f, symbol: firstSymbol, startDate: minDate, endDate: maxDate, dataSource }));
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [defaultValues?.symbol]);

  const downloadedSymbols = Array.from(new Set(availableDatasets.map((d) => d.symbol)));
  const hasDownloadedData = downloadedSymbols.length > 0;

  // Pre-compute date range and available timeframes for the currently selected symbol
  const selectedSymbolDatasets = availableDatasets.filter((d) => d.symbol === form.symbol);
  const selectedSymbolRange =
    selectedSymbolDatasets.length > 0
      ? {
          minDate: selectedSymbolDatasets.reduce((m, d) => (d.minDate < m ? d.minDate : m), selectedSymbolDatasets[0].minDate),
          maxDate: selectedSymbolDatasets.reduce((m, d) => (d.maxDate > m ? d.maxDate : m), selectedSymbolDatasets[0].maxDate),
        }
      : null;

  // Timeframes available in downloaded data for the selected symbol (mapped to internal Timeframe labels)
  const dbToInternalTimeframe: Record<string, Timeframe> = {
    '1m': '1m',
    '5m': '5m',
    '1h': '1h',
    '1d': 'day',
    '1w': 'week',
  };
  const availableTimeframesForSymbol: Set<Timeframe> = new Set(
    selectedSymbolDatasets
      .map((d) => dbToInternalTimeframe[d.timeframe])
      .filter((tf): tf is Timeframe => tf !== undefined)
  );

  function handleDownloadedSymbolChange(sym: string) {
    const datasets = availableDatasets.filter((d) => d.symbol === sym);
    if (datasets.length === 0) return;
    const minDate = datasets.reduce((m, d) => (d.minDate < m ? d.minDate : m), datasets[0].minDate);
    const maxDate = datasets.reduce((m, d) => (d.maxDate > m ? d.maxDate : m), datasets[0].maxDate);

    // Map provider → dataSource
    const provider = datasets[0].provider;
    const dataSource: DataSource = provider === 'binance' ? 'binance' : 'binance';

    // Filter timeframes to only those available for the new symbol
    const newAvailableTfs: Set<Timeframe> = new Set(
      datasets
        .map((d) => dbToInternalTimeframe[d.timeframe])
        .filter((tf): tf is Timeframe => tf !== undefined)
    );

    setForm((f) => ({
      ...f,
      symbol: sym,
      startDate: minDate,
      endDate: maxDate,
      dataSource,
      timeframes: f.timeframes.filter((tf) => newAvailableTfs.has(tf)),
    }));
  }

  // ─── Handlers ──────────────────────────────────────────────

  function handleMarketChange(market: Market) {
    const option = MARKET_OPTIONS.find((o) => o.value === market);
    const defaultSymbols: Record<Market, string> = {
      crypto: 'BTCUSDT',
      'us-futures': 'ES',
      'kr-futures': '101C6000',
    };
    setForm((f) => ({
      ...f,
      market,
      dataSource: option?.dataSource ?? 'binance',
      symbol: defaultSymbols[market],
    }));
  }

  function toggleTimeframe(tf: Timeframe) {
    setForm((f) => ({
      ...f,
      timeframes: f.timeframes.includes(tf)
        ? f.timeframes.filter((t) => t !== tf)
        : [...f.timeframes, tf],
    }));
  }

  function toggleIndicator(ind: Indicator) {
    setForm((f) => ({
      ...f,
      indicators: f.indicators.includes(ind)
        ? f.indicators.filter((i) => i !== ind)
        : [...f.indicators, ind],
    }));
  }

  function togglePropRule(rule: PropFirmRuleName) {
    setForm((f) => ({
      ...f,
      propFirmRules: {
        ...f.propFirmRules,
        [rule]: !f.propFirmRules[rule],
      },
    }));
  }

  // ─── Validation ────────────────────────────────────────────

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!form.name.trim()) newErrors.name = 'Experiment name is required';
    if (!form.symbol.trim()) newErrors.symbol = 'Symbol is required';
    if (!form.startDate) newErrors.startDate = 'Start date is required';
    if (!form.endDate) newErrors.endDate = 'End date is required';
    if (form.startDate && form.endDate && form.startDate >= form.endDate) {
      newErrors.endDate = 'End date must be after start date';
    }
    if (form.timeframes.length === 0) {
      newErrors.timeframes = 'Select at least one timeframe';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ─── Submit ────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const config: ExperimentConfig = {
      market: form.market,
      dataSource: form.dataSource,
      symbol: form.symbol.trim().toUpperCase(),
      dateRange: { start: form.startDate, end: form.endDate },
      timeframes: form.timeframes,
      indicators: form.indicators,
      propFirmRules: PROP_FIRM_RULE_OPTIONS.map(
        (r): PropFirmRule => ({
          name: r.value,
          enabled: form.propFirmRules[r.value],
          description: r.description,
        })
      ),
    };

    setIsLoading(true);
    setLoadingStep('Creating experiment...');

    try {
      // Step 1: Create experiment
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
        } catch {
          // ignore parse error
        }
        throw new Error(errMsg);
      }

      const created = (await createRes.json()) as { id: string };
      const experimentId = created.id;

      // Step 2+3: Fetch market data and run strategy agent (single server call)
      setLoadingStep('Running strategy agent (fetching data + generating strategy)...');

      const runRes = await fetch(`/api/experiments/${experimentId}/run`, {
        method: 'POST',
      });

      if (!runRes.ok) {
        // Redirect to experiment detail so user can see execution log for the failure
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Experiment Name */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Experiment Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="exp-name">
              Experiment Name <span className="text-red-500">*</span>
            </label>
            <Input
              id="exp-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. BTC Bull Run Q1 2024"
              disabled={isLoading}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Market & Symbol */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Market Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="market">
              Market
            </label>
            <select
              id="market"
              value={form.market}
              onChange={(e) => handleMarketChange(e.target.value as Market)}
              disabled={isLoading}
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
            >
              {MARKET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium" htmlFor="symbol">
                Symbol <span className="text-red-500">*</span>
              </label>
              {hasDownloadedData && (
                <Badge variant="secondary" className="text-xs">Using downloaded data</Badge>
              )}
            </div>
            {hasDownloadedData ? (
              <select
                id="symbol"
                value={form.symbol}
                onChange={(e) => {
                  if (e.target.value) handleDownloadedSymbolChange(e.target.value);
                }}
                disabled={isLoading}
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
              >
                {downloadedSymbols.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                No data downloaded yet.{' '}
                <Link href="/data-storage" className="underline font-medium hover:opacity-80">
                  Go to Data Storage
                </Link>{' '}
                to download market data first.
              </div>
            )}
            {errors.symbol && <p className="text-red-500 text-xs mt-1">{errors.symbol}</p>}
          </div>

          {selectedSymbolRange && (
            <p className="text-xs text-muted-foreground">
              Date range locked to downloaded data: {selectedSymbolRange.minDate} → {selectedSymbolRange.maxDate}
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="start-date">
                Start Date <span className="text-red-500">*</span>
              </label>
              <Input
                id="start-date"
                type="date"
                value={form.startDate}
                min={selectedSymbolRange?.minDate}
                max={selectedSymbolRange?.maxDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                disabled={isLoading || hasDownloadedData}
              />
              {errors.startDate && (
                <p className="text-red-500 text-xs mt-1">{errors.startDate}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="end-date">
                End Date <span className="text-red-500">*</span>
              </label>
              <Input
                id="end-date"
                type="date"
                value={form.endDate}
                min={selectedSymbolRange?.minDate}
                max={selectedSymbolRange?.maxDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                disabled={isLoading || hasDownloadedData}
              />
              {errors.endDate && (
                <p className="text-red-500 text-xs mt-1">{errors.endDate}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeframes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timeframes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {TIMEFRAME_OPTIONS.filter((tf) =>
              !hasDownloadedData || availableTimeframesForSymbol.size === 0 || availableTimeframesForSymbol.has(tf.value)
            ).map((tf) => (
              <label
                key={tf.value}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={form.timeframes.includes(tf.value)}
                  onChange={() => toggleTimeframe(tf.value)}
                  disabled={isLoading}
                  className="rounded"
                />
                <span className="text-sm">{tf.label}</span>
              </label>
            ))}
          </div>
          {errors.timeframes && (
            <p className="text-red-500 text-xs mt-2">{errors.timeframes}</p>
          )}
        </CardContent>
      </Card>

      {/* Indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Indicators</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {INDICATOR_OPTIONS.map((ind) => (
              <label
                key={ind.value}
                className={`flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer transition-colors ${
                  form.indicators.includes(ind.value)
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'border-input'
                }`}
              >
                <input
                  type="checkbox"
                  checked={form.indicators.includes(ind.value)}
                  onChange={() => toggleIndicator(ind.value)}
                  disabled={isLoading}
                  className="sr-only"
                />
                <span className="text-sm font-medium">{ind.label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Prop Firm Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prop Firm Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {PROP_FIRM_RULE_OPTIONS.map((rule) => (
              <label
                key={rule.value}
                className={`flex items-start gap-3 border rounded-md px-3 py-3 cursor-pointer transition-colors ${
                  form.propFirmRules[rule.value]
                    ? 'border-green-500 bg-green-50 dark:bg-green-950'
                    : 'border-input'
                }`}
              >
                <input
                  type="checkbox"
                  checked={form.propFirmRules[rule.value]}
                  onChange={() => togglePropRule(rule.value)}
                  disabled={isLoading}
                  className="mt-0.5 rounded"
                />
                <div>
                  <p className="text-sm font-medium">{rule.label}</p>
                  <p className="text-xs text-muted-foreground">{rule.description}</p>
                </div>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      {errors.submit && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300">
          {errors.submit}
        </div>
      )}

      <Button type="submit" disabled={isLoading || !hasDownloadedData} className="w-full" size="lg">
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" />
              <path
                d="M4 12a8 8 0 018-8"
                strokeWidth="4"
                className="opacity-75"
              />
            </svg>
            {loadingStep || 'Running...'}
          </span>
        ) : (
          'Run Experiment'
        )}
      </Button>
    </form>
  );
}
