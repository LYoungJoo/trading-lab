import { NextResponse } from 'next/server';
import { deleteMarketData } from '@/lib/db/queries';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol: rawSymbol } = await params;
    const symbol = decodeURIComponent(rawSymbol);
    const url = new URL(req.url);
    const provider = url.searchParams.get('provider') ?? 'yahoo';
    const deleted = deleteMarketData(symbol, provider);
    return NextResponse.json({ deleted });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
