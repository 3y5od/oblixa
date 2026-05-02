#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const strict = process.env.SUBPROCESSOR_SLA_STRICT === "1" || process.env.SUBPROCESSOR_SLA_STRICT === "true";
const p = path.join(process.cwd(), "artifacts", "subprocessors.json");
const data = JSON.parse(fs.readFileSync(p, "utf8"));
const rows = data.subprocessors || data.vendors || [];
const violations = [];
if (strict) {
  for (const row of rows) {
    if (!row.lastNotifiedAt || !row.nextReviewDue) {
      violations.push({ name: row.name, reason: "missing_lastNotifiedAt_or_nextReviewDue" });
    }
    const n = Number(row.noticeLeadTimeDays);
    if (!Number.isFinite(n) || n < 30) {
      violations.push({ name: row.name, reason: "noticeLeadTimeDays_lt_30" });
    }
    if (row.lastNotifiedAt && row.nextReviewDue) {
      const due = Date.parse(String(row.nextReviewDue));
      const notified = Date.parse(String(row.lastNotifiedAt));
      if (Number.isFinite(due) && Number.isFinite(notified)) {
        const daysUntilDue = (due - Date.now()) / 86_400_000;
        if (daysUntilDue <= 30 && daysUntilDue >= 0) {
          const earliestNotice = due - 30 * 86_400_000;
          if (notified > earliestNotice) {
            violations.push({
              name: row.name,
              reason: "insufficient_notice_lead_before_review_window",
              nextReviewDue: row.nextReviewDue,
              lastNotifiedAt: row.lastNotifiedAt,
            });
          }
        }
      }
    }
  }
}
const ok = violations.length === 0;
console.log(JSON.stringify({ ok, strict, violations, count: rows.length }, null, 2));
process.exit(ok ? 0 : 1);
