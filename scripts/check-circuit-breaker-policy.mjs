#!/usr/bin/env node
import process from "node:process";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { fileExists, issueReport, nodeNameText, parseSource, readText, walkAst } from "./lib/static-check-utils.mjs";

const SAFE_FETCH = "src/lib/security/safe-fetch.ts";
const RETRY_HELPER = "src/lib/extraction/retry.ts";

function numericExpressionValue(node, constants = new Map()) {
  if (!node) return null;
  if (ts.isNumericLiteral(node)) return Number(node.text.replace(/_/g, ""));
  if (ts.isIdentifier(node) && constants.has(node.text)) return constants.get(node.text);
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    const inner = numericExpressionValue(node.operand, constants);
    return inner === null ? null : -inner;
  }
  return null;
}

function collectNumericConstants(ast) {
  const constants = new Map();
  walkAst(ast, (node) => {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer) return;
    const value = numericExpressionValue(node.initializer, constants);
    if (value !== null) constants.set(node.name.text, value);
  });
  return constants;
}

function collectNullishDefaultNumbers(root, rel, names) {
  const values = new Map();
  if (!fileExists(root, rel)) return values;
  const { ast } = parseSource(root, rel);
  const constants = collectNumericConstants(ast);
  walkAst(ast, (node) => {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer) return;
    if (!names.has(node.name.text)) return;
    if (!ts.isBinaryExpression(node.initializer) || node.initializer.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken) return;
    const fallback = numericExpressionValue(node.initializer.right, constants);
    if (fallback !== null) values.set(node.name.text, fallback);
  });
  return values;
}

export function analyzeCircuitBreakerPolicy(root = process.cwd()) {
  const issues = [];

  if (!fileExists(root, SAFE_FETCH)) {
    issues.push({ issue: "missing_safe_fetch_timeout_helper", file: SAFE_FETCH });
  } else {
    const safeFetch = readText(root, SAFE_FETCH);
    for (const [issue, marker] of [
      ["safe_fetch_missing_timeout_option", "timeoutMs"],
      ["safe_fetch_missing_abort_controller", "new AbortController()"],
      ["safe_fetch_missing_abort_timer", "setTimeout("],
      ["safe_fetch_missing_timer_cleanup", "clearTimeout("],
      ["safe_fetch_missing_manual_redirect_policy", 'redirect: "manual"'],
    ]) {
      if (!safeFetch.includes(marker)) issues.push({ issue, file: SAFE_FETCH });
    }

    const defaults = collectNullishDefaultNumbers(root, SAFE_FETCH, new Set(["timeoutMs"]));
    const timeoutDefault = defaults.get("timeoutMs");
    if (timeoutDefault == null || timeoutDefault < 1 || timeoutDefault > 30_000) {
      issues.push({ issue: "safe_fetch_timeout_default_out_of_policy", file: SAFE_FETCH, value: timeoutDefault ?? null });
    }
  }

  if (!fileExists(root, RETRY_HELPER)) {
    issues.push({ issue: "missing_retry_budget_helper", file: RETRY_HELPER });
  } else {
    const retry = readText(root, RETRY_HELPER);
    const defaults = collectNullishDefaultNumbers(root, RETRY_HELPER, new Set(["maxAttempts", "maxDelayMs"]));
    if (![...defaults.entries()].some(([name, value]) => name === "maxAttempts" && value >= 1 && value <= 5)) {
      issues.push({ issue: "retry_helper_missing_bounded_attempt_default", file: RETRY_HELPER });
    }
    if (![...defaults.entries()].some(([name, value]) => name === "maxDelayMs" && value >= 1 && value <= 10_000)) {
      issues.push({ issue: "retry_helper_missing_bounded_delay_default", file: RETRY_HELPER });
    }
    for (const status of ["429", "502", "503", "504"]) {
      if (!retry.includes(`last.status === ${status}`)) {
        issues.push({ issue: "retry_helper_missing_retryable_status", file: RETRY_HELPER, status: Number(status) });
      }
    }
    if (!retry.includes("Math.min(")) {
      issues.push({ issue: "retry_helper_missing_delay_cap", file: RETRY_HELPER });
    }
  }

  return issueReport("circuit-breaker-policy", issues);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeCircuitBreakerPolicy();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
