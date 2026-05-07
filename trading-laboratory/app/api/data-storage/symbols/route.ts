import { NextResponse } from 'next/server';
import { getProvider } from '@/lib/providers';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const symbol = url.searchParams.get('symbol');
    const providerId = url.searchParams.get('provider') ?? 'yahoo';

    if (!symbol) {
      return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
    }

    const provider = getProvider(providerId);
    const validation = await provider.validateSymbol(symbol);
    if (!validation.valid) {
      return NextResponse.json({ valid: false, error: validation.error });
    }

    const timeframe = url.searchParams.get('timeframe') ?? '1d';
    const range = await provider.getAvailableRange(symbol, timeframe);
    return NextResponse.json({ valid: true, ...range });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
