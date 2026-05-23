import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeTimeoutBudgetGuards } from "./check-timeout-budget-guards.mjs";

function write(root, rel, text) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

function tempRoot(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `oblixa-${name}-`));
}

const safeFetchHelper = `
export type SafeFetchInit = RequestInit & { timeoutMs?: number };
export const SAFE_FETCH_DEFAULT_TIMEOUT_MS = 15_000;
export const SAFE_FETCH_MAX_TIMEOUT_MS = 30_000;
function normalizeSafeFetchTimeoutMs(timeoutMs: number | undefined) {
  return timeoutMs ?? SAFE_FETCH_DEFAULT_TIMEOUT_MS;
}
export async function safeFetch(input: string, init: SafeFetchInit = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), normalizeSafeFetchTimeoutMs(init.timeoutMs));
  try { return await fetch(input, { signal: controller.signal, redirect: "manual" }); }
  finally { clearTimeout(timeoutId); }
}
`;

const retryHelper = `
export interface WithRetryOptions { timeoutMs?: number; maxAttempts?: number }
export const RETRY_DEFAULT_ATTEMPT_TIMEOUT_MS = 30_000;
export const RETRY_MAX_ATTEMPT_TIMEOUT_MS = 120_000;
function normalizeAttemptTimeoutMs(timeoutMs: number | undefined) {
  return timeoutMs ?? RETRY_DEFAULT_ATTEMPT_TIMEOUT_MS;
}
function combineAbortSignals(user: AbortSignal | null | undefined, inner: AbortSignal) { return user ?? inner; }
async function withAttemptTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fn(controller.signal); }
  finally { clearTimeout(timeoutId); }
}
export async function withRetry<T>(fn: (signal: AbortSignal) => Promise<T>, options: WithRetryOptions = {}) {
  return withAttemptTimeout(fn, normalizeAttemptTimeoutMs(options.timeoutMs));
}
export async function fetchWithRetry(input: string, init?: RequestInit, options: WithRetryOptions = {}) {
  return fetch(input, { ...init, signal: combineAbortSignals(init?.signal, new AbortController().signal) });
}
`;

test("analyzeTimeoutBudgetGuards accepts bounded retry helpers and expensive route budgets", () => {
  const root = tempRoot("timeout-ok");
  write(root, "src/lib/security/safe-fetch.ts", safeFetchHelper);
  write(root, "src/lib/extraction/retry.ts", retryHelper);
  write(
    root,
    "src/app/api/extract/route.ts",
    `export const maxDuration = 300;
     export async function POST() { return fetchWithRetry("https://worker.example.test"); }`
  );

  const report = analyzeTimeoutBudgetGuards(root);

  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});

test("analyzeTimeoutBudgetGuards rejects missing helper timeout support and route budgets", () => {
  const root = tempRoot("timeout-bad");
  write(root, "src/lib/security/safe-fetch.ts", "export async function safeFetch() {}\n");
  write(root, "src/lib/extraction/retry.ts", "export async function withRetry(fn) { return fn(); }\n");
  write(root, "src/app/api/extract/route.ts", "export async function POST() { return fetchWithRetry('x'); }\n");

  const report = analyzeTimeoutBudgetGuards(root);

  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "retry_missing_timeout_option"));
  assert(report.issues.some((issue) => issue.issue === "safe_fetch_missing_max_timeout"));
  assert(report.issues.some((issue) => issue.issue === "missing_route_max_duration"));
});
