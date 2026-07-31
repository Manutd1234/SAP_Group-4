import { NextResponse } from 'next/server';
import artifact from '@/data/cases.json';
import type { CaseRecord, CasesArtifactMeta } from '@/app/lib/cases';

const { meta, cases } = artifact as { meta: CasesArtifactMeta; cases: CaseRecord[] };

export async function GET() {
  return NextResponse.json({
    success: true,
    count: cases.length,
    meta,
    cases,
  });
}
