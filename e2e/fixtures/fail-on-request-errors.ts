import type { Page, Response } from "@playwright/test";

const IGNORE_URL_PATTERNS = [
  /\/api\/external-actions\/.+\/status$/,
];

function shouldIgnore(response: Response) {
  const url = response.url();
  return IGNORE_URL_PATTERNS.some((pattern) => pattern.test(url));
}

export async function attachFailOnRequestErrors(page: Page) {
  const failures: string[] = [];
  page.on("response", async (response) => {
    if (shouldIgnore(response)) return;
    if (response.status() >= 500) {
      failures.push(`${response.status()} ${response.url()}`);
    }
  });
  return {
    assertNoRequestFailures() {
      if (failures.length > 0) {
        throw new Error(`Unexpected 5xx responses:\n${failures.join("\n")}`);
      }
    },
  };
}

