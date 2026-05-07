export interface ProviderCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DownloadRequest {
  symbol: string;
  timeframe: '1m' | '5m' | '1h' | '1d' | '1w';
  startDate: string;
  endDate: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  supportedTimeframes: string[];
  maxHistoryDays: Record<string, number>;
  timeframeNotes: Record<string, string>;
  notes: string[];
}

export interface DataProvider {
  info: ProviderInfo;
  validateSymbol(symbol: string): Promise<{ valid: boolean; error?: string }>;
  getAvailableRange(symbol: string, timeframe: string): Promise<{ startDate: string; endDate: string }>;
  fetchCandles(req: DownloadRequest): Promise<ProviderCandle[]>;
}
