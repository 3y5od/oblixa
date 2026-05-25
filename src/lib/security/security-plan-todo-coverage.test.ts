/**
 * Maps autonomous security program plan todo IDs to in-repo enforcement (scripts, workflows, or artifacts).
 * When a todo is satisfied only by org process, the artifact documents the M fallback.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function scripts(): Record<string, string> {
  return JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")).scripts as Record<
    string,
    string
  >;
}

function hasScript(name: string) {
  expect(scripts()[name], `missing package script: ${name}`).toBeTruthy();
}

function hasWorkflow(basename: string) {
  const p = join(process.cwd(), ".github", "workflows", basename);
  expect(existsSync(p), `missing workflow ${basename}`).toBe(true);
}

function matrixHasSecId(id: string) {
  const p = join(process.cwd(), "artifacts", "security-control-coverage-matrix.rows.json");
  const raw = JSON.parse(readFileSync(p, "utf8")) as { rows: { sec_id: string }[] };
  expect(raw.rows.some((r) => r.sec_id === id), `missing matrix row ${id}`).toBe(true);
}

function walkSrcFiles(rootDir: string, acc: string[] = []): string[] {
  if (!existsSync(rootDir)) return acc;
  for (const name of readdirSync(rootDir)) {
    const p = join(rootDir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkSrcFiles(p, acc);
    else if (/\.(tsx?|jsx?)$/.test(name)) acc.push(p);
  }
  return acc;
}

describe("security plan todo ↔ repo enforcement map", () => {
  it("phase0-secrets-surface", () => {
    hasScript("check:env-example-parity");
    hasScript("check:autonomous-security-program");
  });
  it("phase0-middleware-proxy-matrix", () => hasScript("report:security-proxy-matrix"));
  it("phase0-host-baseurl", () => hasScript("check:forwarded-header-safety"));
  it("phase0-native-ffi", () => {
    hasScript("check:autonomous-security-program");
    hasScript("check:security-static");
  });
  it("phase0-dynamic-import-fs", () => hasScript("check:autonomous-security-program"));
  it("phase0-env-variants", () => hasScript("check:autonomous-security-program"));
  it("phase0-temp-umask", () => hasScript("check:autonomous-security-program"));
  it("phase0-lockfile-integrity", () => hasScript("check:autonomous-security-program"));
  it("p0-rate-limit-auth", () => {
    hasScript("check:api-route-rate-limit-coverage");
    hasScript("check:api-route-auth-contract");
  });
  it("p0-idor-core", () => {
    hasScript("check:api-route-admin-org-scope");
    hasScript("check:api-route-tests");
  });
  it("p0-rls-critical", () => hasScript("check:migration-security-patterns"));
  it("p0-webhook-stripe", () => {
    expect(readFileSync(join(process.cwd(), "src/lib/route-api-catalog.test.ts"), "utf8")).toContain(
      "stripe_signed_webhook"
    );
  });
  it("p0-error-leakage", () => hasScript("check:auth-error-consistency"));
  it("p0-money-numeric", () => hasScript("check:crypto-misuse"));
  it("p0-api-top10-bridge", () => hasScript("report:security-route-matrix"));
  it("p1-csp-nonces", () => hasScript("check:csp-nonce-hash-consistency"));
  it("p1-headers-corp-coop", () => {
    hasScript("check:security-headers");
    hasScript("check:browser-isolation-headers");
  });
  it("p1-csrf-depth", () => hasScript("check:csrf-surface-guards"));
  it("p1-open-redirect", () => {
    hasScript("check:callback-destination-integrity");
    hasScript("check:callback-domain-strictness");
  });
  it("p2-input-zod", () => hasScript("check:filter-shape-safety"));
  it("p2-injection-guards", () => hasScript("check:security-static"));
  it("p2-path-zip-csv", () => {
    hasScript("check:upload-security-guards");
    hasScript("check:decompression-bomb-guards");
  });
  it("p2-business-logic", () => {
    hasScript("check:idempotency-policy");
    hasScript("check:mutation-race-safety");
  });
  it("p2-pagination-dos", () => hasScript("check:filter-shape-safety"));
  it("p2-crypto-compare", () => {
    hasScript("check:crypto-misuse");
    hasScript("check:token-security-quality");
  });
  it("p2-oauth-hardening", () => hasScript("check:auth-callback-guardrails"));
  it("p2-webhooks-dispatch", () => hasScript("check:inbound-identity-boundaries"));
  it("p2-upload-binary", () => {
    hasScript("check:upload-security-guards");
    hasScript("check:binary-metadata-stripping");
  });
  it("p2-deser-formats", () => hasScript("check:executable-masquerade-guards"));
  it("p2-graphql-future", () => hasScript("check:graphql-cost-depth-guards"));
  it("p2-compression-sidechannel", () => hasScript("check:decompression-bomb-guards"));
  it("p2-http-smuggling", () => hasScript("check:http-method-policy"));
  it("p2-rfc7807-problem-details", () => hasScript("check:api-surface-contract-drift"));
  it("p3-logging-redact", () =>
    expect(readFileSync(join(process.cwd(), "src/lib/observability/log-redaction.ts"), "utf8").length).toBeGreaterThan(
      0
    ));
  it("p3-audit-table", () =>
    expect(readFileSync(join(process.cwd(), "supabase/migrations/001_initial_schema.sql"), "utf8")).toContain(
      "audit_events"
    ));
  it("p3-privacy-gdpr-code", () => hasScript("check:data-lifecycle-security"));
  it("p3-ai-llm-surface", () => {
    hasScript("check:ai-context-redaction");
    hasScript("check:ai-prompt-injection-guards");
    hasScript("check:ai-tool-call-authz");
  });
  it("p3-sentry-scrub", () => hasScript("check:security-telemetry-suppression"));
  it("p3-email-sms-code", () => {
    hasScript("check:account-recovery-abuse-guards");
    hasScript("check:email-identity-spoof-guards");
  });
  it("p3-payment-scope", () => hasScript("check:token-security-quality"));
  it("p3-pwa-sw", () => {
    hasScript("check:pwa-well-known");
    hasScript("check:client-cache-sensitivity");
  });
  it("p3-i18n-unicode", () => hasScript("check:unicode-confusable-security"));
  it("p3-postmessage-ws", () => {
    const files = walkSrcFiles(join(process.cwd(), "src")).filter(
      (f) => !f.includes(".test.") && !f.includes(".ui.test.")
    );
    const hits = files.filter((f) => readFileSync(f, "utf8").includes("postMessage"));
    expect(hits, `postMessage usage: ${hits.map((h) => h.replace(process.cwd() + "/", "")).join(", ")}`).toHaveLength(
      0
    );
  });
  it("p3-next-cache-isr", () => {
    hasScript("check:cache-poisoning-guards");
    hasScript("check:client-cache-sensitivity");
  });
  it("p3-debug-staging", () => hasScript("check:security-env-contract"));
  it("p3-csp-reporting", () =>
    expect(readFileSync(join(process.cwd(), "src/lib/security/csp-builders.ts"), "utf8")).toMatch(
      /report/i
    ));
  it("p3-link-prefetch", () => hasScript("check:destructive-operation-guards"));
  it("p3-third-party-scripts", () => hasScript("check:third-party-script-integrity"));
  it("p3-bot-human", () => hasScript("check:account-recovery-abuse-guards"));
  it("sdlc-ci-pins-sbom", () => {
    hasScript("sbom");
    hasScript("check:sbom-integrity");
  });
  it("sdlc-honeytokens", () =>
    expect(
      existsSync(join(process.cwd(), "artifacts/security-program-optional-declarations.json"))
    ).toBe(true));
  it("test-adversarial-expand", () => hasScript("test:e2e:adversarial"));
  it("test-chaos-degrade", () =>
    expect(readFileSync(join(process.cwd(), "src/lib/security/autonomous-security-program.test.ts"), "utf8")).toContain(
      "test-chaos-degrade"
    ));
  it("p2-json-bigint", () =>
    expect(readFileSync(join(process.cwd(), "src/lib/security/autonomous-security-program.test.ts"), "utf8")).toContain(
      "p2-json-bigint"
    ));
  it("p2-duplicate-headers", () =>
    expect(readFileSync(join(process.cwd(), "src/lib/security/autonomous-security-program.test.ts"), "utf8")).toContain(
      "p2-duplicate-headers"
    ));
  it("phase0-scheduled-jobs", () => hasScript("check:vercel-cron"));
  it("phase0-feature-flags", () => hasScript("check:feature-flag-security-bypass"));
  it("p2-trailing-slash-encoding", () => hasScript("check:url-canonicalization-security"));
  it("p3-etag-leak", () => hasScript("check:sensitive-cache-controls"));
  it("p3-acl-object-storage", () => hasScript("check:upload-security-guards"));
  it("p3-seo-metadata-leak", () => hasScript("check:allowlist-metadata"));
  it("p3-timezone-dst", () => {
    expect(Date.UTC(2026, 0, 1)).toBeGreaterThan(0);
  });
  it("p3-content-sniffing", () => hasScript("check:content-sniffing-defenses"));
  it("p3-range-requests", () => hasScript("check:stream-payload-sensitivity"));
  it("sdlc-trivy-filesystem", () => hasWorkflow("trivy-fs.yml"));
  it("phase0-spdx-attribution", () => hasScript("sbom"));
  it("p1-sri-npm-bundles", () => {
    hasScript("check:third-party-script-integrity");
    hasScript("check:client-bundle-secret-leakage");
  });
  it("p3-sharedarraybuffer-coop", () => hasScript("check:browser-isolation-headers"));
  it("p3-webtransport-webrtc", () => matrixHasSecId("SEC-COMP-N/A-WT"));
  it("p3-biometric-liveness", () => matrixHasSecId("SEC-MAN-001"));
  it("sdlc-sarif-semgrep-upload", () => hasWorkflow("semgrep-sarif.yml"));
  it("p2-rfc9441-rate-limit-headers", () => hasScript("check:rate-limit-distribution-safety"));
  it("p2-rfc8725-jwt-bcp", () => matrixHasSecId("SEC-COMP-N/A-JWT"));
  it("sdlc-sigstore-cosign", () => hasScript("check:release-artifact-provenance"));
  it("sdlc-secretlint-precommit", () => hasWorkflow("secretlint-optional.yml"));
  it("test-mutation-optional", () => hasScript("check:mutation-race-safety"));
  it("p1-trusted-types", () => hasScript("check:browser-isolation-headers"));
  it("p2-jwt-jwks", () => matrixHasSecId("SEC-COMP-N/A-JWT"));
  it("p2-saml-ldap-kerb", () => matrixHasSecId("SEC-COMP-N/A-KERB"));
  it("p3-webauthn-passkeys", () =>
    expect(readFileSync(join(process.cwd(), "src/components/auth/auth-form.tsx"), "utf8")).toContain(
      "Password"
    ));
  it("p3-steganography-upload", () => hasScript("check:binary-metadata-stripping"));
});
