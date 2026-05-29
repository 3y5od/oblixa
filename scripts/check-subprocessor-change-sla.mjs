#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const SUBPROCESSORS_REL = "artifacts/subprocessors.json";
const STRICT_ENV = process.env.SUBPROCESSOR_SLA_STRICT === "1" || process.env.SUBPROCESSOR_SLA_STRICT === "true";
const DEFAULT_AS_OF_DATE = process.env.SUBPROCESSOR_SLA_AS_OF ?? "2026-05-28";

function readJson(root, rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

function daysBetween(start, end) {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return Number.NaN;
  return Math.floor((endMs - startMs) / 86_400_000);
}

export function analyzeSubprocessorChangeSla(root = ROOT, options = {}) {
  const strict = Boolean(options.strict ?? STRICT_ENV);
  const asOfDate = options.asOfDate ?? DEFAULT_AS_OF_DATE;
  const data = readJson(root, SUBPROCESSORS_REL);
  const rows = data.subprocessors || data.vendors || [];
  const violations = [];

  for (const row of rows) {
    const name = row.name ?? row.id ?? "(missing)";
    for (const field of ["changeDate", "lastNotifiedAt", "nextReviewDue", "noticeLeadTimeDays", "notificationSlaDays"]) {
      if (row[field] == null || row[field] === "") {
        violations.push({ name, reason: "missing_sla_field", field });
      }
    }
    const noticeLeadTimeDays = Number(row.noticeLeadTimeDays);
    const notificationSlaDays = Number(row.notificationSlaDays);
    if (!Number.isFinite(noticeLeadTimeDays) || noticeLeadTimeDays < 30) {
      violations.push({ name, reason: "noticeLeadTimeDays_lt_30" });
    }
    if (!Number.isFinite(notificationSlaDays) || notificationSlaDays < 30) {
      violations.push({ name, reason: "notificationSlaDays_lt_30" });
    }
    if (row.lastNotifiedAt && row.nextReviewDue) {
      const daysUntilDue = daysBetween(`${asOfDate}T00:00:00.000Z`, String(row.nextReviewDue));
      const notifiedLead = daysBetween(String(row.lastNotifiedAt), String(row.nextReviewDue));
      if (Number.isFinite(daysUntilDue) && daysUntilDue <= 30 && daysUntilDue >= 0 && notifiedLead < 30) {
        violations.push({
          name,
          reason: "insufficient_notice_lead_before_review_window",
          nextReviewDue: row.nextReviewDue,
          lastNotifiedAt: row.lastNotifiedAt,
        });
      }
    }
  }

  const ok = violations.length === 0;
  return {
    checkId: "subprocessor-change-sla",
    ok: strict ? ok : true,
    strict,
    asOfDate,
    violationCount: violations.length,
    violations,
    count: rows.length,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeSubprocessorChangeSla();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
