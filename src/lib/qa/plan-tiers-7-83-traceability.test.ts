import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

/** Each plan tier id (7–83) maps to at least one checked-in file path (e2e or src/scripts). */
const TIER_FILES: Readonly<Record<string, string[]>> = {
  "tier7-manual-harness-spec": ["e2e/manual-harness-limits.spec.ts"],
  "tier8-public-a11y-visual": [
    "e2e/a11y.spec.ts",
    "e2e/public-route-h1-contract.spec.ts",
    "e2e/a11y.nightly-optional-marketing-axe.spec.ts",
  ],
  "tier8-keyboard-dialog-form": ["e2e/a11y.keyboard.spec.ts", "e2e/a11y.dialogs.spec.ts", "e2e/a11y.forms.spec.ts"],
  "tier9-upload-download": ["e2e/ui-qa-upload-emulation-perf.spec.ts", "e2e/ui-qa-http-client-status-mocks.spec.ts"],
  "tier9-ime-rtl-i18n": ["e2e/rtl-ime-pseudo-locale-smoke.spec.ts"],
  "tier10-env-emulation": ["e2e/ui-qa-upload-emulation-perf.spec.ts"],
  "tier11-perf-observability": ["e2e/ui-qa-upload-emulation-perf.spec.ts", "e2e/perf.spec.ts"],
  "tier12-static-governance": ["scripts/security-static-audit.mjs"],
  "tier13-lib-property-tests": ["src/lib/qa/contracts-search-url-fuzz-sampling.test.ts"],
  "tier14-nextjs-shell": ["src/lib/qa/next-app-router-shell-surface.test.ts"],
  "tier15-telemetry-sentry-tests": ["src/lib/qa/telemetry-sentry-capture-mocks.test.ts"],
  "tier16-visual-masking-stability": ["e2e/visual-helpers.ts"],
  "tier17-quarantine-shard": ["e2e/ui-qa-skip-lab-tiers.spec.ts", "playwright.config.ts"],
  "tier18-synthetic-stub": ["scripts/synthetic-p0-smoke.mjs", "scripts/slo-compare.mjs"],
  "tier19-conditional-product": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier20-v9-e2e-trace": ["src/lib/acceptance-bundle.test.ts"],
  "tier21-wcag22-a11y-tiers": ["e2e/a11y.nightly-optional-marketing-axe.spec.ts"],
  "tier22-tables-virtualization": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier23-sse-websocket": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier24-forms-native-semantics": ["e2e/a11y.forms.spec.ts"],
  "tier25-import-preview-errors": ["src/lib/qa/csv-formula-safety-usage.test.ts"],
  "tier26-routing-anchors-csp": ["e2e/authenticated.spec.ts"],
  "tier27-pwa-seo-meta": ["src/lib/qa/pwa-seo-metadata.test.ts", "e2e/marketing-public.spec.ts"],
  "tier28-remaining-panels": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier29-ci-artifacts-har": ["e2e/ui-qa-skip-lab-tiers.spec.ts", "playwright.config.ts"],
  "tier30-security-reports-ui-link": ["e2e/ui-qa-http-client-status-mocks.spec.ts", "e2e/security-api.spec.ts"],
  "tier31-theme-tokens-print": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier32-system-typography-a11y-mods": ["e2e/rtl-ime-pseudo-locale-smoke.spec.ts"],
  "tier33-bfcache-navigation-rsc": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier34-org-identity-privacy": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier35-flags-kill-chaos": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier36-rum-pentest-cve": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier37-ci-parity-locks": [".nvmrc", "package.json"],
  "tier38-longjob-degraded": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier39-governance-owners": [".github/CODEOWNERS"],
  "tier40-remaining-modality-edge": ["e2e/ui-qa-skip-lab-tiers.spec.ts", "e2e/manual-harness-limits.spec.ts"],
  "tier41-content-rich-help": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier42-wizard-session": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier43-unified-error-mapping": ["src/lib/qa/user-visible-error-shape.test.ts"],
  "tier44-embeddings-widgets": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier45-admin-debug-safe": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier46-e2e-data-hygiene": ["scripts/e2e-teardown.mjs"],
  "tier47-i18n-intl": ["src/lib/qa/intl-format-sampling.test.ts"],
  "tier48-strictmode-devprod-parity": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier49-experiments-analyze": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier50-skip-payments-geo": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier51-react-next-platform": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier52-cache-invalidation-ui": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier53-concurrency-409": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier54-integrity-sri-corp": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier55-webauthn-fedcm-conditional": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier56-perf-bfcache-apis": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier57-network-emulation": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier58-permissions-debug-headers": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier59-stacked-banners": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier60-legal-geo-structured": ["src/lib/qa/landing-structured-data.test.ts", "e2e/public-route-h1-contract.spec.ts"],
  "tier61-http-status-ui-matrix": ["e2e/ui-qa-http-client-status-mocks.spec.ts"],
  "tier62-noscript-progressive": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier63-modern-css-patterns": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier64-aria-idioms-disclosure": ["e2e/a11y.dialogs.spec.ts"],
  "tier65-realtime-vendors-conditional": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier66-mocks-vendor-lock": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier67-chromatic-percy-optional": ["e2e/ui-qa-skip-lab-tiers.spec.ts", "chromatic.config.cjs"],
  "tier68-slo-budgets-synthetic": ["scripts/slo-compare.mjs", "scripts/slo-budgets.json"],
  "tier69-fuzz-property-inputs": ["src/lib/qa/contracts-search-url-fuzz-sampling.test.ts"],
  "tier70-coverage-mappa-mundi": ["src/lib/qa/plan-tiers-7-83-traceability.test.ts"],
  "tier71-mutation-pact-optional": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier72-color-contrast-charts": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier73-captcha-bot": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier74-step-up-destructive": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier75-cidr-allowlist": ["src/lib/qa/cidr.test.ts"],
  "tier76-kbd-accel-os": [
    "e2e/a11y.keyboard.spec.ts",
    "src/components/layout/command-palette.ui.test.tsx",
  ],
  "tier77-audit-activity": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier78-calendar-recurrence": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier79-aria-1-3-future": ["src/lib/qa/aria-future-detect.test.ts"],
  "tier80-privacy-strict-contexts": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier81-dnd-clipboard": ["e2e/ui-qa-skip-lab-tiers.spec.ts"],
  "tier82-regulatory-ids": ["src/lib/qa/regulatory-id-format-sampling.test.ts"],
  "tier83-post-release-gate": ["package.json", "scripts/report-release-readiness.mjs"],
};

function exists(rel: string): boolean {
  return fs.existsSync(path.join(root, rel));
}

describe("plan tiers 7–83 traceability (file anchors)", () => {
  for (const [tier, files] of Object.entries(TIER_FILES)) {
    it(`${tier} has at least one on-disk file`, () => {
      const ok = files.some((f) => exists(f));
      expect(ok, `missing: ${files.join(", ")}`).toBe(true);
    });
  }
});
