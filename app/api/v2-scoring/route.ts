import { NextResponse } from 'next/server';
import { calculateV2RiskScore } from '@/app/lib/v2-scoring';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    return NextResponse.json(calculateV2RiskScore(body));
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal v2 scoring error' }, { status: 500 });
  }
}
