import { NextResponse } from 'next/server';
import { getDatasetSummary } from '@/lib/db/queries';

export async function GET() {
  try {
    const datasets = getDatasetSummary();
    return NextResponse.json(datasets);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
