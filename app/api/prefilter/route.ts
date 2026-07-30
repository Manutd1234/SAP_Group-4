import { NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import util from "util";

const execPromise = util.promisify(exec);

export async function POST(req: Request) {
  try {
    const rawTx = await req.json();
    const command = `python3 -c "
import json
from src.prefilter_engine import DeterministicPreFilterEngine
res = DeterministicPreFilterEngine.evaluate_transaction(${JSON.stringify(rawTx)})
print(json.dumps(res))
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
      { error: error.message || "Failed to execute Pre-Filter Engine" },
      { status: 500 }
    );
  }
}
