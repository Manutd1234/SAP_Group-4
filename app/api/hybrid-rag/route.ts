import { NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import util from "util";

const execPromise = util.promisify(exec);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const companyId = body.companyId || 1;
    const query = body.query || "sanctions high risk UBO PEP anomaly";

    const pythonScript = path.join(process.cwd(), "narrow_ai/src/hybrid_rag.py");
    const datasetsDir = path.join(process.cwd(), "datasets");

    // Execute Python Hybrid RAG module
    const command = `python3 -c "
import json
from src.hybrid_rag import HybridRAGEngine
engine = HybridRAGEngine(datasets_dir='${datasetsDir}')
res = engine.execute_hybrid_query(company_id=${companyId}, user_query='${query.replace(/'/g, "")}')
print(json.dumps(res, default=str))
"`;

    const { stdout, stderr } = await execPromise(command, {
      cwd: path.join(process.cwd(), "narrow_ai")
    });

    if (stderr && !stdout) {
      return NextResponse.json({ error: stderr }, { status: 500 });
    }

    const result = JSON.parse(stdout);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to execute Hybrid RAG" },
      { status: 500 }
    );
  }
}
