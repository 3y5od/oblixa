import type { Page } from "@playwright/test";

export async function annotateWorkspaceMode(page: Page, mode: string) {
  await page.addInitScript((value) => {
    const root = document.documentElement;
    if (root) root.dataset.e2eWorkspaceMode = value;
  }, mode);
}

