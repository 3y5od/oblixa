import type { TestInfo } from "@playwright/test";

const WEBKIT_WORKER_SETTLE_MS = 20_000;

export async function settleWebKitWorker(testInfo: TestInfo): Promise<void> {
  if (testInfo.project.name !== "webkit") return;
  await new Promise((resolve) => setTimeout(resolve, WEBKIT_WORKER_SETTLE_MS));
}
