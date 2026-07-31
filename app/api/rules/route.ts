import { NextResponse } from 'next/server';
import rulesData from '@/data/rules.json';

export async function GET() {
  return NextResponse.json(rulesData);
}
