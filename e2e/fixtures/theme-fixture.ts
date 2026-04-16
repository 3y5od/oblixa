import type { Page } from "@playwright/test";

export async function applyTheme(page: Page, theme: "light" | "dark" = "light") {
  await page.emulateMedia({ colorScheme: theme });
}

