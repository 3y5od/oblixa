import type { Page } from "@playwright/test";

export async function annotateRouteState(page: Page, routeState: string) {
  await page.addInitScript((value) => {
    document.documentElement.dataset.e2eRouteState = value;
  }, routeState);
}

