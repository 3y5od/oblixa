#!/usr/bin/env node
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  isSourceFileName,
  issueReport,
  isTestLikeFile,
  readText,
  walkFiles,
} from "./lib/static-check-utils.mjs";

const SECRET_PATTERNS = [
  { issue: "private_key_block_in_test_fixture", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----/g },
  { issue: "aws_access_key_in_test_fixture", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { issue: "github_pat_in_test_fixture", pattern: /\b(?:gh[pousr]_[A-Za-z0-9_]{36,}|github_pat_[A-Za-z0-9_]{80,})\b/g },
  { issue: "stripe_live_key_in_test_fixture", pattern: /\b(?:sk|rk)_live_[A-Za-z0-9]{24,}\b/g },
  { issue: "slack_token_in_test_fixture", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
  { issue: "openai_key_in_test_fixture", pattern: /\b(?:sk-proj-[A-Za-z0-9_-]{48,}|sk-[A-Za-z0-9]{48,})\b/g },
];

const INLINE_ALLOW_MARKER = "security:test-fixture-secret-placeholder";
const SECRET_REVIEW_ROOTS = ["src", "e2e", "scripts", "docs", "artifacts", ".github"];
const EVIDENCE_SURFACE_PREFIXES = ["docs/", "artifacts/", ".github/"];
const REVIEWABLE_NON_SOURCE_FILE_RE = /\.(?:json|txt|env|md|mdx|ya?ml|toml|csv|tsv)$/i;

function candidateFixtureFiles(root) {
  return walkFiles(root, SECRET_REVIEW_ROOTS, {
    include(rel, name) {
      const isReviewableFile = isSourceFileName(name) || REVIEWABLE_NON_SOURCE_FILE_RE.test(name);
      if (!isReviewableFile) return false;
      if (EVIDENCE_SURFACE_PREFIXES.some((prefix) => rel.startsWith(prefix))) return true;
      return isTestLikeFile(rel) || rel.includes("/fixtures/") || rel.includes("/fixture-") || rel.includes("-fixture");
    },
  });
}

function redactEvidence(value) {
  if (value.startsWith("-----BEGIN")) return "-----BEGIN [redacted] PRIVATE KEY-----";
  if (value.length <= 12) return "[redacted]";
  return `${value.slice(0, 8)}[redacted]${value.slice(-4)}`;
}

export function analyzeTestFixtureSecrets(root = process.cwd()) {
  const issues = [];
  const files = candidateFixtureFiles(root);

  for (const file of files) {
    const text = readText(root, file);
    const lines = text.split(/\r?\n/);
    for (const { issue, pattern } of SECRET_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const line = text.slice(0, match.index).split(/\r?\n/).length;
        if (lines[line - 1]?.includes(INLINE_ALLOW_MARKER)) continue;
        issues.push({ issue, file, line, evidence: redactEvidence(match[0]) });
      }
    }
  }

  return issueReport("test-fixture-secrets", issues, { filesChecked: files.length });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeTestFixtureSecrets();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
