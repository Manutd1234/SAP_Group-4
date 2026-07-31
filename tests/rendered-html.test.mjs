import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: {
        accept: "text/html",
        host: "localhost",
      },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the RiskSignal case dashboard shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>RiskSignal \| Financial Crime AI<\/title>/i);
  assert.match(html, /SAP Case Management/);
  assert.match(html, /Case Management/);
  assert.doesNotMatch(html, /codex-preview/);
  assert.doesNotMatch(html, /react-loading-skeleton/);
});

test("wires the case dashboard to the real build-time scoring artefact", async () => {
  const [page, layout, cases, buildScript, engineRoute, architecture, governance] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cases/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build_cases.py", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/v2-scoring.ts", import.meta.url), "utf8"),
    readFile(new URL("../docs/ARCHITECTURE.md", import.meta.url), "utf8"),
    readFile(new URL("../Skills.md", import.meta.url), "utf8"),
  ]);

  assert.match(page, /ShellBar/);
  assert.match(page, /KpiTiles/);
  assert.match(page, /CaseTable/);
  assert.match(page, /CaseDetailModal/);
  assert.match(page, /\/api\/cases/);
  assert.match(layout, /openGraph/);
  assert.match(cases, /data\/cases\.json/);
  assert.match(buildScript, /calculate_v2_risk_score/);
  assert.match(buildScript, /FACTOR_WEIGHTS/);
  assert.match(engineRoute, /RC-DATA-MISSING/);
  assert.match(architecture, /Transaction-to-decision workflow/);
  assert.match(architecture, /reason codes/);
  assert.match(governance, /Decision support only/);
  assert.match(governance, /MAS FEAT/);
  assert.match(governance, /Federal Reserve SR 11-7/);
  await access(new URL("../docs/WORKFLOWS.md", import.meta.url));
  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(
    access(new URL("../app/_sites-preview", import.meta.url)),
  );
});

test("configures the SAP AI Core GitOps application path", async () => {
  const [configText, training, serving] = await Promise.all([
    readFile(
      new URL("../narrow_ai/application-config.json", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../narrow_ai/templates/risksignal-training.yaml",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../narrow_ai/templates/risksignal-serving.yaml",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  const config = JSON.parse(configText);

  assert.equal(config.repositoryUrl, "https://github.com/Manutd1234/SAP_Group-4");
  assert.equal(config.revision, "HEAD");
  assert.equal(config.path, "narrow_ai/templates");
  assert.match(training, /kind:\s*WorkflowTemplate/);
  assert.match(training, /scenarios\.ai\.sap\.com\/id:\s*"risksignal-fincrime"/);
  assert.match(training, /globalName:\s*risk-model/);
  assert.match(serving, /kind:\s*ServingTemplate/);
  assert.match(serving, /STORAGE_URI/);
  assert.match(serving, /ghcr\.io\/manutd1234\/risksignal-narrow-ai:latest/);
});
