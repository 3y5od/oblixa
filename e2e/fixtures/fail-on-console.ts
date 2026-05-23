import type { Page } from "@playwright/test";

const ALLOWLIST = [
  /Not implemented: navigation to another Document/i,
  // Next.js production builds omit RSC error details; transient infra flakes still surface this digest in browser tests.
  /An error occurred in the Server Components render\. The specific message is omitted in production builds/i,
  /^Failed to load resource: the server responded with a status of 403 \(Forbidden\)$/i,
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

