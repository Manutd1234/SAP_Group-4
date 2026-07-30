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

test("server-renders the RiskSignal control center", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>RiskSignal \| Financial Crime AI<\/title>/i);
  assert.match(html, /Risk control center/);
  assert.match(html, /Focus human attention where it matters most/);
  assert.match(html, /Orion Exports Pte Ltd/);
  assert.match(html, /From signal to accountable decision/);
  assert.doesNotMatch(html, /codex-preview/);
  assert.doesNotMatch(html, /react-loading-skeleton/);
});

test("ships governance and architecture artefacts", async () => {
  const [page, layout, architecture, governance] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../docs/ARCHITECTURE.md", import.meta.url), "utf8"),
    readFile(new URL("../Skills.md", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Human decision required/);
  assert.match(page, /AI cannot release, escalate or file this case/);
  assert.match(page, /Risk factor breakdown/);
  assert.match(page, /Integrated workflow studio/);
  assert.match(page, /12 auditable controls/);
  assert.match(page, /Problem 1 · Outdated framework/);
  assert.match(page, /Problem 2 · Operational inefficiency/);
  assert.match(page, /Problem 3 · Regulatory intensity/);
  assert.match(page, /SAP HANA Cloud/);
  assert.match(page, /Llama Guard 3/);
  assert.match(layout, /openGraph/);
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
