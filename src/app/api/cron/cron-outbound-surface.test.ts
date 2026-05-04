import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPORT_PACKS_CRON = join(process.cwd(), "src/app/api/cron/v4/report-packs-generate/route.ts");
const REVIEW_BOARD_NOTIFICATIONS = join(process.cwd(), "src/lib/v6/review-board-notifications.ts");

describe("cron outbound product-surface gating", () => {
  it("keeps report-pack digest/email/webhook delivery behind report mode checks", async () => {
    const raw = await readFile(REPORT_PACKS_CRON, "utf8");
    expect(raw.includes("minWorkspaceModeForReportType")).toBe(true);
    expect(raw.includes("workspaceModeAtLeast(workspaceProductMode, minModeForReport)")).toBe(true);
    expect(raw.includes("isNotificationAllowed")).toBe(true);
    expect(raw.includes("notificationTypeForReportPack")).toBe(true);
    expect(raw.includes("emitWebhooks")).toBe(true);
    expect(raw.includes("sendReportPackDigestEmail")).toBe(true);
  });

  it("checks workspace notification policy before review-board email and slack delivery", async () => {
    const raw = await readFile(REVIEW_BOARD_NOTIFICATIONS, "utf8");
    expect(raw.includes('notificationType: "review_board_packet"')).toBe(true);
    expect(raw.includes('notificationType: "review_board_slack"')).toBe(true);
    expect(raw.includes("isNotificationAllowed")).toBe(true);
    expect(raw.includes("markNotificationSuppressed")).toBe(true);
    expect(raw.includes('import { safeFetch } from "@/lib/security/safe-fetch"')).toBe(true);
    expect(raw.includes("fetch(webhook.toString()")).toBe(false);
  });
});

