import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeClientBundleSecretLeakage } from "./check-client-bundle-secret-leakage.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeClientBundleSecretLeakage accepts public env in client graph", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-client-bundle-ok-"));
  write(
    root,
    "src/components/client-widget.tsx",
    '"use client";\nimport { clientCopy } from "../lib/client-copy";\nexport function ClientWidget(){ return <p>{clientCopy}</p>; }\n'
  );
  write(
    root,
    "src/lib/client-copy.ts",
    "export const clientCopy = process.env.NEXT_PUBLIC_APP_URL ?? 'local';\n"
  );

  const report = analyzeClientBundleSecretLeakage(root);
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
  assert.equal(report.issueCount, 0);
  assert.equal(report.clientRootCount, 1);
  assert.equal(report.clientReachableModuleCount, 2);
});

test("analyzeClientBundleSecretLeakage rejects transitive server env usage", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-client-bundle-env-"));
  write(
    root,
    "src/components/client-widget.tsx",
    '"use client";\nimport { token } from "../lib/client-secret";\nexport function ClientWidget(){ return <p>{token}</p>; }\n'
  );
  write(root, "src/lib/client-secret.ts", "export const token = process.env.STRIPE_SECRET_KEY;\n");

  const report = analyzeClientBundleSecretLeakage(root);
  assert.equal(report.ok, false);
  assert.equal(
    report.issues.some((issue) => issue.issue === "server_env_in_client_bundle" && issue.key === "STRIPE_SECRET_KEY"),
    true
  );
});

test("analyzeClientBundleSecretLeakage rejects server-only imports in client graph", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-client-bundle-server-"));
  write(
    root,
    "src/components/client-widget.tsx",
    '"use client";\nimport { load } from "../lib/client-load";\nexport function ClientWidget(){ return <button onClick={load}>Load</button>; }\n'
  );
  write(
    root,
    "src/lib/client-load.ts",
    'import { createAdminClient } from "@/lib/supabase/server";\nexport async function load(){ return createAdminClient(); }\n'
  );

  const report = analyzeClientBundleSecretLeakage(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "supabase_server_import_in_client_bundle"), true);
  assert.equal(report.issues.some((issue) => issue.issue === "service_role_call_in_client_bundle"), true);
});

test("analyzeClientBundleSecretLeakage accepts server action boundaries", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-client-bundle-action-"));
  write(
    root,
    "src/components/client-widget.tsx",
    '"use client";\nimport { saveThing } from "../actions/save-thing";\nexport function ClientWidget(){ return <button onClick={() => saveThing()}>Save</button>; }\n'
  );
  write(
    root,
    "src/actions/save-thing.ts",
    '"use server";\nimport "server-only";\nimport { createAdminClient } from "@/lib/supabase/server";\nexport async function saveThing(){ return process.env.SUPABASE_SERVICE_ROLE_KEY ?? createAdminClient(); }\n'
  );

  const report = analyzeClientBundleSecretLeakage(root);
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
  assert.equal(report.issueCount, 0);
  assert.equal(report.serverBoundaryCount, 1);
});

test("analyzeClientBundleSecretLeakage rejects sensitive NEXT_PUBLIC names", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-client-bundle-public-"));
  write(
    root,
    "src/components/client-widget.tsx",
    '"use client";\nexport function ClientWidget(){ return <p>{process.env.NEXT_PUBLIC_API_KEY}</p>; }\n'
  );

  const report = analyzeClientBundleSecretLeakage(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "sensitive_next_public_env"), true);
});
