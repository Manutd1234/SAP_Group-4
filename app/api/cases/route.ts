import { NextResponse } from 'next/server';

interface CaseRecord {
  caseId: string;
  caseNumber: string;
  companyId: string;
  legalName: string;
  transactionId: string;
  alertId: string;
  status: string;
  createdAt: string;
  daysElapsed: number;
  amount: number;
  jouleExplanation: string | null;
  riskScore: number;
  riskTier: string;
  assignedQueue: string;
  queueScore: number;
  reasonCodes: Array<{ code: string; factor: string; points: number; description: string }>;
}

export async function GET() {
  try {
    // TEMPORARY: Return mock data for dev testing
    // TODO: In production, load from actual CSV files via a proper data layer
    const mockCases: CaseRecord[] = [
      {
        caseId: 'CASE-001',
        caseNumber: 'SAP-2024-001',
        companyId: 'CMPNY-123',
        legalName: 'Orion Exports Pte Ltd',
        transactionId: 'TXN-2024-0847',
        alertId: 'ALERT-001',
        status: 'Open',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        daysElapsed: 5,
        amount: 247500,
        jouleExplanation: 'Rapid multi-hop transfer detected: 4 transfers within 31 minutes; 6.2× customer baseline. Intermediary jurisdiction differs from normal trade corridor. Pattern suggests potential structuring activity.',
        riskScore: 87,
        riskTier: 'HIGH',
        assignedQueue: 'ESCALATE',
        queueScore: 85.5,
        reasonCodes: [
          { code: 'RC-PATTERN-ANOMALY', factor: 'STRUCTURAL', points: 20, description: 'High transaction pattern anomaly detected' },
          { code: 'RC-HIGH-VALUE', factor: 'EXPOSURE', points: 10, description: 'High-value transaction exceeding threshold' },
          { code: 'RC-FATF-JURISDICTION', factor: 'JURISDICTION', points: 15, description: 'High-risk FATF listed jurisdiction' },
        ],
      },
      {
        caseId: 'CASE-002',
        caseNumber: 'SAP-2024-002',
        companyId: 'CMPNY-456',
        legalName: 'TechVenture Inc',
        transactionId: 'TXN-2024-0921',
        alertId: 'ALERT-002',
        status: 'In Review',
        createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        daysElapsed: 12,
        amount: 125000,
        jouleExplanation: 'Moderate compliance risk: Entity operates in tech sector with stable transaction history. KYC verification current. Single elevated transfer noted, likely project-related.',
        riskScore: 42,
        riskTier: 'MEDIUM',
        assignedQueue: 'STANDARD',
        queueScore: 52.3,
        reasonCodes: [
          { code: 'RC-BASELINE-DEVIATION', factor: 'BEHAVIOURAL', points: 5, description: 'Significant amount deviation from historical baseline' },
          { code: 'RC-DATA-MISSING', factor: 'DATA_INTEGRITY', points: 2, description: 'Missing mandatory fields' },
        ],
      },
      {
        caseId: 'CASE-003',
        caseNumber: 'SAP-2024-003',
        companyId: 'CMPNY-789',
        legalName: 'Global Trade Solutions LLC',
        transactionId: 'TXN-2024-0456',
        alertId: 'ALERT-003',
        status: 'Resolved',
        createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        daysElapsed: 45,
        amount: 89500,
        jouleExplanation: 'Low risk. Established trading company with 5+ years of relationship. All KYC requirements met. Transaction aligns with historical patterns. Recommend closure.',
        riskScore: 18,
        riskTier: 'LOW',
        assignedQueue: 'AUTO_CLEAR',
        queueScore: 22.1,
        reasonCodes: [],
      },
    ];

    return NextResponse.json({
      success: true,
      count: mockCases.length,
      cases: mockCases,
    });


  } catch (error: any) {
    console.error('Error loading cases:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
