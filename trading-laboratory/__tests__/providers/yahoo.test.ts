import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('yahoo-finance2', () => ({
  default: {
    quote: vi.fn(),
    chart: vi.fn(),
  },
}));

import yahooFinance from 'yahoo-finance2';
import { yahooProvider } from '@/lib/providers/yahoo';

const mockQuote = vi.mocked(yahooFinance.quote);
const mockChart = vi.mocked(yahooFinance.chart);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getAvailableRange', () => {
  it('returns 7-day window for 1m timeframe', async () => {
    const { startDate, endDate } = await yahooProvider.getAvailableRange('AAPL', '1m');
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    expect(diffDays).toBe(7);
  });

  it('returns 60-day window for 5m timeframe', async () => {
    const { startDate, endDate } = await yahooProvider.getAvailableRange('AAPL', '5m');
    const diffDays = Math.round(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000
    );
    expect(diffDays).toBe(60);
  });

  it('returns 730-day window for 1h timeframe', async () => {
    const { startDate, endDate } = await yahooProvider.getAvailableRange('AAPL', '1h');
    const diffDays = Math.round(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000
    );
    expect(diffDays).toBe(730);
  });

  it('returns 36500-day window for 1d timeframe', async () => {
    const { startDate, endDate } = await yahooProvider.getAvailableRange('AAPL', '1d');
    const diffDays = Math.round(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000
    );
    expect(diffDays).toBe(36500);
  });

  it('returns 36500-day window for 1w timeframe', async () => {
    const { startDate, endDate } = await yahooProvider.getAvailableRange('AAPL', '1w');
    const diffDays = Math.round(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000
    );
    expect(diffDays).toBe(36500);
  });

  it('returns dates in YYYY-MM-DD format', async () => {
    const { startDate, endDate } = await yahooProvider.getAvailableRange('AAPL', '1d');
    expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('does not call yahoo-finance2 (date math only)', async () => {
    await yahooProvider.getAvailableRange('AAPL', '1d');
    expect(mockQuote).not.toHaveBeenCalled();
    expect(mockChart).not.toHaveBeenCalled();
  });
});

describe('validateSymbol', () => {
  it('returns valid:true when quote resolves', async () => {
    mockQuote.mockResolvedValueOnce({ symbol: 'AAPL' } as never);
    const result = await yahooProvider.validateSymbol('AAPL');
    expect(result.valid).toBe(true);
    expect(mockQuote).toHaveBeenCalledWith('AAPL');
  });

  it('returns valid:false with error message when quote throws', async () => {
    mockQuote.mockRejectedValueOnce(new Error('Invalid symbol'));
    const result = await yahooProvider.validateSymbol('INVALID');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid symbol');
  });

  it('handles non-Error throws gracefully', async () => {
    mockQuote.mockRejectedValueOnce('string error');
    const result = await yahooProvider.validateSymbol('X');
    expect(result.valid).toBe(false);
    expect(typeof result.error).toBe('string');
  });
});

describe('fetchCandles', () => {
  const CHART_RESPONSE = {
    quotes: [
      { date: new Date('2024-01-02'), open: 185, high: 190, low: 183, close: 188, volume: 50_000_000 },
      { date: new Date('2024-01-03'), open: 188, high: 192, low: 187, close: 191, volume: 55_000_000 },
      { date: new Date('2024-01-04'), open: null, high: null, low: null, close: null, volume: null }, // bad row
    ],
  };

  beforeEach(() => {
    mockChart.mockResolvedValue(CHART_RESPONSE as never);
  });

  it('calls yahoo-finance2.chart with correct interval for 1d', async () => {
    await yahooProvider.fetchCandles({ symbol: 'AAPL', timeframe: '1d', startDate: '2024-01-01', endDate: '2024-12-31' });
    expect(mockChart).toHaveBeenCalledWith('AAPL', expect.objectContaining({ interval: '1d' }));
  });

  it('maps 1h timeframe to 60m interval', async () => {
    await yahooProvider.fetchCandles({ symbol: 'AAPL', timeframe: '1h', startDate: '2024-01-01', endDate: '2024-01-31' });
    expect(mockChart).toHaveBeenCalledWith('AAPL', expect.objectContaining({ interval: '60m' }));
  });

  it('maps 1w timeframe to 1wk interval', async () => {
    await yahooProvider.fetchCandles({ symbol: 'AAPL', timeframe: '1w', startDate: '2024-01-01', endDate: '2024-12-31' });
    expect(mockChart).toHaveBeenCalledWith('AAPL', expect.objectContaining({ interval: '1wk' }));
  });

  it('passes period1 and period2 correctly', async () => {
    await yahooProvider.fetchCandles({ symbol: 'AAPL', timeframe: '1d', startDate: '2024-01-01', endDate: '2024-12-31' });
    expect(mockChart).toHaveBeenCalledWith('AAPL', expect.objectContaining({
      period1: '2024-01-01',
      period2: '2024-12-31',
    }));
  });

  it('filters out rows with null open or close', async () => {
    const candles = await yahooProvider.fetchCandles({ symbol: 'AAPL', timeframe: '1d', startDate: '2024-01-01', endDate: '2024-12-31' });
    expect(candles).toHaveLength(2); // 3 quotes, 1 filtered out
  });

  it('maps quote fields to ProviderCandle shape', async () => {
    const candles = await yahooProvider.fetchCandles({ symbol: 'AAPL', timeframe: '1d', startDate: '2024-01-01', endDate: '2024-12-31' });
    expect(candles[0]).toMatchObject({
      timestamp: new Date('2024-01-02').getTime(),
      open: 185,
      high: 190,
      low: 183,
      close: 188,
      volume: 50_000_000,
    });
  });

  it('throws for unsupported timeframe', async () => {
    await expect(
      yahooProvider.fetchCandles({ symbol: 'AAPL', timeframe: '3m', startDate: '2024-01-01', endDate: '2024-01-31' })
    ).rejects.toThrow('Unsupported timeframe');
  });

  it('returns empty array when chart returns no quotes', async () => {
    mockChart.mockResolvedValueOnce({ quotes: [] } as never);
    const candles = await yahooProvider.fetchCandles({ symbol: 'AAPL', timeframe: '1d', startDate: '2024-01-01', endDate: '2024-12-31' });
    expect(candles).toEqual([]);
  });

  it('handles missing quotes property gracefully', async () => {
    mockChart.mockResolvedValueOnce({} as never);
    const candles = await yahooProvider.fetchCandles({ symbol: 'AAPL', timeframe: '1d', startDate: '2024-01-01', endDate: '2024-12-31' });
    expect(candles).toEqual([]);
  });
});
