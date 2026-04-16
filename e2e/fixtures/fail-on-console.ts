import type { Page } from "@playwright/test";

const ALLOWLIST = [
  /Not implemented: navigation to another Document/i,
];

export async function attachFailOnConsole(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (ALLOWLIST.some((pattern) => pattern.test(text))) return;
    errors.push(text);
  });
  return {
    assertNoConsoleErrors() {
      if (errors.length > 0) {
        throw new Error(`Unexpected console.error output:\n${errors.join("\n")}`);
      }
    },
  };
}

