/**
 * V9 §28 + Appendix BK — client-invoked telemetry uses `void` so server action latency never blocks UI.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("client telemetry is fire-and-forget (V9 §28)", () => {
  it("page load reporter uses beacon/keepalive telemetry", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/layout/v9-page-load-reporter.tsx"),
      "utf8"
    );
    const httpClient = readFileSync(join(process.cwd(), "src/lib/http/client-json.ts"), "utf8");
    expect(src).toMatch(/sendJsonKeepalive/);
    expect(httpClient).toMatch(/navigator\.sendBeacon/);
    expect(httpClient).toMatch(/keepalive:\s*true/);
    expect(src).not.toMatch(/emitPageLoadMeasuredTelemetry/);
  });

  it("CmdK surfaces void palette and result telemetry", () => {
    const src = readFileSync(join(process.cwd(), "src/components/layout/command-palette.tsx"), "utf8");
    expect(src).toMatch(/void emitCmdkPaletteOpenedTelemetry/);
    expect(src).toMatch(/void emitCmdkZeroResultsTelemetry/);
    expect(src).toMatch(/void emitCmdkResultSelectedTelemetry/);
  });

  it("review save-next link voids telemetry", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/contracts/review-save-next-telemetry-link.tsx"),
      "utf8"
    );
    expect(src).toMatch(/void emitReviewSaveNextUsedTelemetry/);
  });
});
