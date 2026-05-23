import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeNextPublicSurface } from "./check-next-public-surface.mjs";

function tempRoot(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `oblixa-next-public-${name}-`));
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeValidFixture(root) {
  write(
    root,
    ".env.example",
    [
      "NEXT_PUBLIC_SUPABASE_URL=",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY=",
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=",
      "NEXT_PUBLIC_APP_URL=http://localhost:3000",
      "# NEXT_PUBLIC_OBLIXA_CLIENT_SWEEP_BREADCRUMB=1",
      "# NEXT_PUBLIC_V9_INLINE_QUEUE_ACTIONS=",
      "# NEXT_PUBLIC_V10_SUPPORT_DIAGNOSTICS=",
      "# NEXT_PUBLIC_SENTRY_DSN=",
      "# NEXT_PUBLIC_SENTRY_RELEASE=",
      "# NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1",
      "# NEXT_PUBLIC_SENTRY_REPLAY_SESSION_SAMPLE_RATE=0.05",
      "# NEXT_PUBLIC_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE=1",
      "# NEXT_PUBLIC_PRODUCT_SURFACE_DIAGNOSTICS=",
      "# NEXT_PUBLIC_PRODUCT_SURFACE_SENTRY_DIAGNOSTICS=",
      "",
    ].join("\n")
  );
  write(root, "next.config.ts", "const release = process.env.NEXT_PUBLIC_SENTRY_RELEASE;\nexport default {};\n");
  write(
    root,
    "src/components/ui/v10-recoverable-state.tsx",
    'export function shouldShow(){ return process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_V10_SUPPORT_DIAGNOSTICS === "1"; }\n'
  );
  write(
    root,
    "src/lib/product-surface/dev-diagnostics.ts",
    'export function log(){ if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_PRODUCT_SURFACE_DIAGNOSTICS === "1") console.warn("safe"); }\n'
  );
  write(
    root,
    "src/lib/observability/sentry-client.ts",
    'import * as Sentry from "@sentry/nextjs";\nexport function breadcrumb(details){ if (process.env.NEXT_PUBLIC_PRODUCT_SURFACE_SENTRY_DIAGNOSTICS !== "1") return; const family = details.family; const reason = details.reason; const discoverability = details.discoverability; Sentry.addBreadcrumb({ data: { family, reason, discoverability } }); }\n'
  );
  write(
    root,
    "src/lib/debugging-sweep/client-sweep-bridge.tsx",
    '"use client";\nimport * as Sentry from "@sentry/nextjs";\nexport function Bridge(){ if (process.env.NEXT_PUBLIC_OBLIXA_CLIENT_SWEEP_BREADCRUMB === "1") Sentry.addBreadcrumb({ category: "sweep_client", message: "client-bridge-mounted" }); return null; }\n'
  );
  write(
    root,
    "src/lib/supabase/client.ts",
    'export const url = process.env.NEXT_PUBLIC_SUPABASE_URL;\nexport const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;\n'
  );
  write(
    root,
    "src/components/client-widget.tsx",
    '"use client";\nexport function Widget(){ return <p>{process.env.NEXT_PUBLIC_APP_URL}</p>; }\n'
  );
}

test("analyzeNextPublicSurface accepts allowlisted public env and guarded diagnostics", () => {
  const root = tempRoot("ok");
  writeValidFixture(root);

  const report = analyzeNextPublicSurface(root);
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
  assert.equal(report.issueCount, 0);
});

test("analyzeNextPublicSurface rejects suspicious public env keys in .env.example", () => {
  const root = tempRoot("env-secret");
  writeValidFixture(root);
  write(root, ".env.example", "NEXT_PUBLIC_SERVICE_ROLE_KEY=\n");

  const report = analyzeNextPublicSurface(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "unknown_next_public_env_key_in_env_example"));
  assert(report.issues.some((issue) => issue.issue === "sensitive_next_public_env_key_in_env_example"));
});

test("analyzeNextPublicSurface rejects unknown source NEXT_PUBLIC keys", () => {
  const root = tempRoot("source-unknown");
  writeValidFixture(root);
  write(root, "src/components/public-key.tsx", '"use client";\nexport const key = process.env.NEXT_PUBLIC_ENABLE_ADMIN_TOOLS;\n');

  const report = analyzeNextPublicSurface(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "unknown_next_public_env_key_in_source" && issue.key === "NEXT_PUBLIC_ENABLE_ADMIN_TOOLS"));
});

test("analyzeNextPublicSurface rejects production-enabled V10 support diagnostics", () => {
  const root = tempRoot("v10-prod");
  writeValidFixture(root);
  write(
    root,
    "src/components/ui/v10-recoverable-state.tsx",
    'export function shouldShow(){ return process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_V10_SUPPORT_DIAGNOSTICS === "1"; }\n'
  );

  const report = analyzeNextPublicSurface(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "v10_support_diagnostics_not_dev_only"));
});

test("analyzeNextPublicSurface rejects raw diagnostic details in Sentry breadcrumbs", () => {
  const root = tempRoot("raw-sentry");
  writeValidFixture(root);
  write(
    root,
    "src/lib/observability/sentry-client.ts",
    'import * as Sentry from "@sentry/nextjs";\nexport function breadcrumb(details){ if (process.env.NEXT_PUBLIC_PRODUCT_SURFACE_SENTRY_DIAGNOSTICS !== "1") return; const family = details.family; const reason = details.reason; const discoverability = details.discoverability; Sentry.addBreadcrumb({ data: details }); }\n'
  );

  const report = analyzeNextPublicSurface(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "product_surface_sentry_diagnostics_forwards_raw_details"));
});

test("analyzeNextPublicSurface rejects internal diagnostics references in client modules", () => {
  const root = tempRoot("client-internal");
  writeValidFixture(root);
  write(root, "src/components/internal-client.tsx", '"use client";\nexport const path = "/api/internal/debugging-sweep";\n');

  const report = analyzeNextPublicSurface(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "client_public_surface_references_internal_api"));
});
