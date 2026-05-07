'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';

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
    return () => {
      mounted = false;
      clearInterval(interval);
    };
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

  function handleSymbolBlur() {
    handleValidate();
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
      // Reset form
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

  async function handleDelete(symbol: string, provider: string) {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete all ${symbol} data from ${provider}?`)) return;
    setDeleteError(null);
    try {
      const res = await fetch(`/api/data-storage/datasets/${encodeURIComponent(symbol)}?provider=${provider}`, {
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

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Data Storage</h1>
        <Link href="/">
          <Button variant="outline" size="sm">← Experiments</Button>
        </Link>
      </div>

      {/* Active Downloads */}
      {activeJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Downloads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeJobs.map((job) => (
              <div key={job.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{job.symbol} {job.timeframe}</span>
                  <Badge variant={job.status === 'running' ? 'default' : 'secondary'}>
                    {job.status}
                  </Badge>
                </div>
                {job.totalRows != null && job.totalRows > 0 ? (
                  <Progress value={((job.insertedRows ?? 0) / job.totalRows) * 100} className="h-1.5" />
                ) : (
                  <Progress value={0} className="h-1.5 animate-pulse" />
                )}
                <p className="text-xs text-muted-foreground">
                  {job.insertedRows != null ? `${job.insertedRows.toLocaleString()} rows inserted` : 'Starting...'}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent failed jobs */}
      {jobs.filter(j => j.status === 'failed').slice(0, 3).map((job) => (
        <div key={job.id} className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded p-3">
          <strong>{job.symbol} {job.timeframe}</strong> download failed: {job.errorMessage}
        </div>
      ))}

      {/* Delete error */}
      {deleteError && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded p-3">
          Delete failed: {deleteError}
        </div>
      )}

      {/* Downloaded Datasets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Downloaded Datasets</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingDatasets ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : datasets.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              No datasets downloaded yet. Use the form below to get started.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 pr-4">Symbol</th>
                  <th className="text-left py-2 pr-4">Provider</th>
                  <th className="text-left py-2 pr-4">Timeframe</th>
                  <th className="text-right py-2 pr-4">Rows</th>
                  <th className="text-left py-2 pr-4">Date Range</th>
                  <th className="text-right py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((d) => (
                  <tr key={`${d.symbol}-${d.provider}-${d.timeframe}`} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{d.symbol}</td>
                    <td className="py-2 pr-4 text-muted-foreground capitalize">{d.provider}</td>
                    <td className="py-2 pr-4">
                      <Badge variant="outline">{d.timeframe}</Badge>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{d.rowCount.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-muted-foreground text-xs">{d.minDate} → {d.maxDate}</td>
                    <td className="py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(d.symbol, d.provider)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* New Download Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New Download</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Provider</label>
                <Select value={selectedProvider} onValueChange={(v: string | null) => { if (v) { setSelectedProvider(v); setSymbol(''); setValidation(null); } }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                    {providers.length === 0 && (
                      <SelectItem value="yahoo">Yahoo Finance</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Timeframe</label>
                <Select value={timeframe} onValueChange={(v: string | null) => { if (v) { setTimeframe(v); setValidation(null); } }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(currentProvider?.supportedTimeframes ?? ['1m', '5m', '1h', '1d', '1w']).map((tf) => (
                      <SelectItem key={tf} value={tf}>{tf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {currentProvider?.timeframeNotes?.[timeframe] && (
                  <p className="text-xs text-muted-foreground">
                    {currentProvider.timeframeNotes[timeframe]}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Symbol</label>
              <Input
                placeholder={
                  selectedProvider === 'binance'
                    ? 'e.g. BTCUSDT, ETHUSDT, BNBUSDT'
                    : 'e.g. MNQ=F, ES=F, BTC-USD, AAPL'
                }
                value={symbol}
                onChange={(e) => { setSymbol(e.target.value); setValidation(null); }}
                onBlur={handleSymbolBlur}
              />
              {validating && (
                <p className="text-xs text-muted-foreground">Checking symbol...</p>
              )}
              <div className="text-xs text-muted-foreground">
                {selectedProvider === 'binance' ? (
                  <p>Format: <code className="bg-muted px-1 rounded">BTCUSDT</code>, <code className="bg-muted px-1 rounded">ETHUSDT</code>, <code className="bg-muted px-1 rounded">BNBUSDT</code>, <code className="bg-muted px-1 rounded">SOLUSDT</code> (no hyphen, uppercase)</p>
                ) : selectedProvider === 'yahoo' ? (
                  <div className="space-y-0.5">
                    <p><span className="font-medium">Futures</span> — append <code className="bg-muted px-1 rounded">=F</code> for CME futures: <code className="bg-muted px-1 rounded">MNQ=F</code> (Micro Nasdaq), <code className="bg-muted px-1 rounded">ES=F</code> (E-mini S&P), <code className="bg-muted px-1 rounded">NQ=F</code> (Nasdaq 100), <code className="bg-muted px-1 rounded">CL=F</code> (Crude Oil)</p>
                    <p><span className="font-medium">Crypto</span> — use <code className="bg-muted px-1 rounded">BTC-USD</code>, <code className="bg-muted px-1 rounded">ETH-USD</code> format</p>
                    <p><span className="font-medium">Stocks</span> — plain ticker: <code className="bg-muted px-1 rounded">AAPL</code>, <code className="bg-muted px-1 rounded">SPY</code>, <code className="bg-muted px-1 rounded">QQQ</code></p>
                  </div>
                ) : null}
              </div>
              {validation && (
                <p className={`text-xs ${validation.valid ? 'text-green-600' : 'text-destructive'}`}>
                  {validation.valid ? `✓ Valid — available range: ${validation.startDate} to ${validation.endDate}` : `✗ ${validation.error}`}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  min={validation?.startDate}
                  max={validation?.endDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={!validation?.valid}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  min={validation?.startDate}
                  max={validation?.endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={!validation?.valid}
                />
              </div>
            </div>

            {submitError && (
              <p className="text-xs text-destructive">{submitError}</p>
            )}

            <Button type="submit" disabled={submitting || !validation?.valid || !startDate || !endDate}>
              {submitting ? 'Starting...' : 'Start Download'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
