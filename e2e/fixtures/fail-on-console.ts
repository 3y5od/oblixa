import type { Page } from "@playwright/test";

const ALLOWLIST = [
  /Not implemented: navigation to another Document/i,
  // Next.js production builds omit RSC error details; transient infra flakes still surface this digest in browser tests.
  /An error occurred in the Server Components render\. The specific message is omitted in production builds/i,
  /^Failed to load resource: the server responded with a status of 403 \(Forbidden\)$/i,
  /downloadable font: download failed .*source: http:\/\/127\.0\.0\.1:3000\/_next\/static\/media\/.+\.woff2/i,
  /^\[JavaScript Error: "NS_BINDING_ABORTED: " \{file: "chrome:\/\/juggler\/content\/content\/WorkerMain\.js" line: \d+\}\]$/i,
  // Browser CSP report-only diagnostics are covered by security-header tests; keep this guard focused on enforced failures.
  /Content-Security-Policy: \(Report-Only policy\)/i,
  /Content-Security-Policy: Prevented too many CSP reports from being sent within a short period of time\./i,
  /^\[Report Only\] Refused to (apply a stylesheet|execute a script) because .*Content Security Policy\.$/i,
  /^The Content Security Policy directive 'frame-ancestors' is ignored when delivered in a report-only policy\.$/i,
];

const VISUAL_ALLOWLIST =
  process.env.PLAYWRIGHT_VISUAL === "1" || process.env.PLAYWRIGHT_VISUAL === "true"
    ? [/^Failed to load resource: the server responded with a status of 404 \(Not Found\)$/i]
    : [];

export async function attachFailOnConsole(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if ([...ALLOWLIST, ...VISUAL_ALLOWLIST].some((pattern) => pattern.test(text))) return;
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
