#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  FEATURE_FLAG_ENV_ALIASES,
  buildCompatibilityRemovalQueue,
} from "./check-compatibility-removal-queue.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/compatibility/versioned-env-flag-aliases.json";

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function read(root, rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function queueEnvironmentRows(root) {
  return buildCompatibilityRemovalQueue(root)?.queues?.environmentKeys ?? [];
}

function queueHasAlias(rows, alias) {
  return rows.some((row) => row.legacyName === alias.legacy && row.neutralAlias === alias.neutral);
}

function buildArtifact(root = DEFAULT_ROOT) {
  const featureFlagsSource = read(root, "src/lib/feature-flags.ts");
  const instrumentationSource = read(root, "src/lib/observability/instrumentation-env-warn.ts");
  const envExample = read(root, ".env.example");
  const featureFlagTests = read(root, "src/lib/feature-flags.test.ts");
  const instrumentationTests = read(root, "src/lib/observability/instrumentation-env-warn.test.ts");
  const queueRows = queueEnvironmentRows(root);
  const issues = [];

  const aliases = FEATURE_FLAG_ENV_ALIASES.map((alias) => {
    const sourceCovered =
      featureFlagsSource.includes(`neutral: "${alias.neutral}"`) && featureFlagsSource.includes(`legacy: "${alias.legacy}"`);
    const exampleCovered = envExample.includes(alias.neutral) && envExample.includes(alias.legacy);
    const queueCovered = queueHasAlias(queueRows, alias);
    const testCovered =
      featureFlagTests.includes("prefers neutral env aliases") &&
      featureFlagTests.includes("falls back to legacy feature flag keys");
    const validationCommand = "vitest run src/lib/feature-flags.test.ts src/lib/observability/instrumentation-env-warn.test.ts";

    if (!sourceCovered) {
      issues.push({ issue: "versioned_env_flag_alias_source_missing", legacyName: alias.legacy, neutralAlias: alias.neutral });
    }
    if (!exampleCovered) {
      issues.push({ issue: "versioned_env_flag_alias_example_missing", legacyName: alias.legacy, neutralAlias: alias.neutral });
    }
    if (!queueCovered) {
      issues.push({ issue: "versioned_env_flag_alias_queue_missing", legacyName: alias.legacy, neutralAlias: alias.neutral });
    }
    if (!testCovered) {
      issues.push({ issue: "versioned_env_flag_alias_tests_missing", legacyName: alias.legacy, neutralAlias: alias.neutral });
    }

    return {
      legacyName: alias.legacy,
      neutralAlias: alias.neutral,
      owner: alias.owner,
      reason: alias.reason,
      precedence: "neutral_first_legacy_second",
      sourceCovered,
      exampleCovered,
      queueCovered,
      testCovered,
      validationCommand,
      manualFollowUp: alias.manualFollowUp,
    };
  }).sort((a, b) => a.legacyName.localeCompare(b.legacyName));

  const externalCollaborationFallbackCovered =
    instrumentationSource.includes("ENABLE_EXTERNAL_COLLABORATION ?? env.ENABLE_V5_EXTERNAL_COLLABORATION") &&
    instrumentationTests.includes("prefers the neutral external collaboration env key over the legacy key");
  if (!externalCollaborationFallbackCovered) {
    issues.push({
      issue: "versioned_env_flag_alias_external_collaboration_fallback_missing",
      legacyName: "ENABLE_V5_EXTERNAL_COLLABORATION",
      neutralAlias: "ENABLE_EXTERNAL_COLLABORATION",
    });
  }

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-versioned-env-flag-aliases.mjs --write",
    policy:
      "Feature-flag env aliases are neutral-first and legacy-second. Legacy keys stay readable until production env inventory approves removal.",
    sourceArtifacts: {
      compatibilityRemovalQueue: "artifacts/compatibility/removal-queue.json",
      featureFlagSource: "src/lib/feature-flags.ts",
      envExample: ".env.example",
    },
    totals: {
      aliasCount: aliases.length,
      sourceCoveredCount: aliases.filter((row) => row.sourceCovered).length,
      exampleCoveredCount: aliases.filter((row) => row.exampleCovered).length,
      queueCoveredCount: aliases.filter((row) => row.queueCovered).length,
      testCoveredCount: aliases.filter((row) => row.testCovered).length,
      issueCount: issues.length,
    },
    aliases,
    externalCollaborationFallbackCovered,
    issueCount: issues.length,
    issues,
  };
}

function readJson(root, rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? JSON.parse(fs.readFileSync(abs, "utf8")) : null;
}

export function analyzeVersionedEnvFlagAliases(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildArtifact(root);
  const issues = [...current.issues];
  const committed = readJson(root, artifactRel);
  if (!committed) {
    issues.push({ issue: "versioned_env_flag_aliases_missing_artifact", path: artifactRel });
  } else if (stableStringify(committed) !== stableStringify(current)) {
    issues.push({ issue: "versioned_env_flag_aliases_drift", path: artifactRel, hint: "Run npm run write:versioned-env-flag-aliases" });
  }

  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    aliasCount: current.totals.aliasCount,
    issueCount: issues.length,
    issues,
    current,
  };
}

function writeArtifact(root, artifactRel) {
  const artifact = buildArtifact(root);
  const out = path.join(root, artifactRel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, stableStringify(artifact));
  return artifact;
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, artifactRel: DEFAULT_ARTIFACT_REL, write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--artifact") {
      options.artifactRel = argv[index + 1] ?? DEFAULT_ARTIFACT_REL;
      index += 1;
    } else if (arg.startsWith("--artifact=")) {
      options.artifactRel = arg.slice("--artifact=".length);
    } else if (arg === "--write") {
      options.write = true;
    }
  }
  return options;
}

export function runVersionedEnvFlagAliases(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = writeArtifact(options.root, options.artifactRel);
    console.log(stableStringify(artifact).trimEnd());
    if (artifact.issueCount > 0) process.exitCode = 1;
    return artifact;
  }
  const report = analyzeVersionedEnvFlagAliases(options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionedEnvFlagAliases();
}
