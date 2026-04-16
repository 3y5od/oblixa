import type { Page } from "@playwright/test";

export async function annotateWorkspaceMode(page: Page, mode: string) {
  await page.addInitScript((value) => {
    document.documentElement.dataset.e2eWorkspaceMode = value;
  }, mode);
}

