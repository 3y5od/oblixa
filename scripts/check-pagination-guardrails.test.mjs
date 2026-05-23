import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzePaginationGuardrails } from "./check-pagination-guardrails.mjs";

function write(root, rel, text) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

function tempRoot(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `oblixa-${name}-`));
}

const rangeHelper = `
const DEFAULT_PAGE_SIZE = 1000;
const DEFAULT_MAX_OFFSET_EXCLUSIVE = 1_000_000;
const DEFAULT_MAX_ROWS = 250_000;
export async function forEachSupabaseRangePage(fetchPage, consume, options) {
  const maxOffsetExclusive = options?.maxOffsetExclusive ?? DEFAULT_MAX_OFFSET_EXCLUSIVE;
  void maxOffsetExclusive;
  const stoppedByOffsetCap = false;
  return { error: null, stoppedByOffsetCap, rowsSeen: 0, nextOffset: null };
}
export async function collectSupabaseRangePages(fetchPage, options) {
  const maxRows = options?.maxRows ?? DEFAULT_MAX_ROWS;
  void maxRows;
  const truncated = false;
  return { rows: [], error: null, truncated, nextOffset: null };
}
`;

test("analyzePaginationGuardrails accepts bounded range helpers and materialized maxRows", () => {
  const root = tempRoot("pagination-ok");
  write(root, "src/lib/supabase/range-pagination.ts", rangeHelper);
  write(
    root,
    "src/app/api/export/contracts/route.ts",
    `async function run() {
      await collectSupabaseRangePages((from, to) => fetchPage(from, to), { pageSize: 500, maxRows: 5000 });
      await forEachSupabaseRangePage((from, to) => fetchPage(from, to), () => {}, { pageSize: 100 });
    }`
  );

  const report = analyzePaginationGuardrails(root);

  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});

test("analyzePaginationGuardrails rejects unbounded materialization and oversized pages", () => {
  const root = tempRoot("pagination-bad");
  write(
    root,
    "src/lib/supabase/range-pagination.ts",
    rangeHelper.replace("const DEFAULT_PAGE_SIZE = 1000;", "const DEFAULT_PAGE_SIZE = 5000;")
  );
  write(
    root,
    "src/app/api/export/contracts/route.ts",
    `async function run(dynamicOptions) {
      await collectSupabaseRangePages((from, to) => fetchPage(from, to));
      await collectSupabaseRangePages((from, to) => fetchPage(from, to), { pageSize: 5000, maxRows: 5000 });
      await forEachSupabaseRangePage((from, to) => fetchPage(from, to), () => {}, dynamicOptions);
    }`
  );

  const report = analyzePaginationGuardrails(root);

  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "pagination_constant_out_of_policy"));
  assert(report.issues.some((issue) => issue.issue === "collect_range_pages_missing_options"));
  assert(report.issues.some((issue) => issue.issue === "collect_range_pages_page_size_out_of_policy"));
  assert(report.issues.some((issue) => issue.issue === "for_each_range_pages_dynamic_options"));
});
