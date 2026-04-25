import type { Page } from "@playwright/test";

export async function annotateRouteState(page: Page, routeState: string) {
  await page.addInitScript((value) => {
    const root = document.documentElement;
    if (root) root.dataset.e2eRouteState = value;
  }, routeState);
}

