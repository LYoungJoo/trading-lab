import { yahooProvider } from './yahoo';
import { binanceProvider } from './binance';
import type { DataProvider, ProviderInfo } from './types';

const PROVIDERS: Record<string, DataProvider> = {
  yahoo: yahooProvider,
  binance: binanceProvider,
};

export function getProvider(id: string): DataProvider {
  const p = PROVIDERS[id];
  if (!p) throw new Error(`Unknown provider: ${id}`);
  return p;
}

export function listProviders(): ProviderInfo[] {
  return Object.values(PROVIDERS).map((p) => p.info);
}

export type { DataProvider, ProviderInfo, ProviderCandle, DownloadRequest } from './types';
