import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function getWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker;
}

function closeEnough(a, b, tol = 0.01) {
  return Math.abs(a - b) <= tol;
}

test("TS v2 scoring (app/lib/v2-scoring.ts) mirrors the Python engine within tolerance", async () => {
  const worker = await getWorker();
  const fixture = JSON.parse(await readFile(new URL("../data/scoring-parity-fixture.json", import.meta.url), "utf8"));
  assert.ok(fixture.length >= 40, `expected a substantial parity fixture, got ${fixture.length} records`);

  const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };

  for (const { input, expected } of fixture) {
    const response = await worker.fetch(
      new Request("http://localhost/api/v2-scoring", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json", host: "localhost" },
        body: JSON.stringify(input),
      }),
      env,
      ctx,
    );
    assert.equal(response.status, 200);
    const actual = await response.json();
    const label = JSON.stringify(input);

    assert.ok(closeEnough(actual.risk_score, expected.risk_score), `risk_score: TS=${actual.risk_score} py=${expected.risk_score} for ${label}`);
    assert.equal(actual.risk_tier, expected.risk_tier, `risk_tier for ${label}`);
    assert.ok(closeEnough(actual.evidence_confidence, expected.evidence_confidence), `evidence_confidence for ${label}`);
    assert.equal(actual.auto_clear_eligible, expected.auto_clear_eligible, `auto_clear_eligible for ${label}`);
    assert.equal(actual.assigned_queue, expected.assigned_queue, `assigned_queue for ${label}`);
    assert.ok(closeEnough(actual.queue_score, expected.queue_score), `queue_score: TS=${actual.queue_score} py=${expected.queue_score} for ${label}`);

    const actualCodes = actual.reason_codes.map((r) => r.code).sort();
    const expectedCodes = expected.reason_codes.map((r) => r.code).sort();
    assert.deepEqual(actualCodes, expectedCodes, `reason codes for ${label}`);
  }
});
