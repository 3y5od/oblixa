import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 §17–§19 import, extraction, and export route surfaces", () => {
  it("anchors import contracts API handler", () => {
    const raw = readFileSync(join(process.cwd(), "src/app/api/import/contracts/route.ts"), "utf8");
    expect(raw.length).toBeGreaterThan(80);
    expect(raw).toMatch(/POST|GET|export async function/i);
    expect(raw).toContain("runContractCsvImport");
  });

  it("anchors export contracts API handler", () => {
    const raw = readFileSync(join(process.cwd(), "src/app/api/export/contracts/route.ts"), "utf8");
    const csv = readFileSync(join(process.cwd(), "src/lib/export/contracts-csv.ts"), "utf8");
    expect(raw.length).toBeGreaterThan(80);
    expect(raw).toMatch(/export async function GET/);
    expect(raw).toMatch(/export async function POST/);
    expect(`${raw}\n${csv}`).toContain("product.v9.export_started");
    expect(csv).toContain("product.v9.export_completed");
  });

  it("anchors export job-detail API handler for follow-through visibility", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/app/api/export/contracts/[jobId]/route.ts"),
      "utf8"
    );
    expect(raw.length).toBeGreaterThan(80);
    expect(raw).toMatch(/export async function GET/);
    expect(raw).toContain("getExportJobHeadline");
    expect(raw).toContain("getExportJobDetail");
    expect(raw).toContain("getExportJobTone");
  });

  it("anchors extraction pipeline entry", () => {
    const raw = readFileSync(join(process.cwd(), "src/lib/extraction/run-pipeline.ts"), "utf8");
    expect(raw.length).toBeGreaterThan(200);
  });

  it("anchors non-CSV export handlers to the same export telemetry lifecycle", () => {
    const calendar = readFileSync(join(process.cwd(), "src/app/api/export/calendar/route.ts"), "utf8");
    const reviewPacket = readFileSync(
      join(process.cwd(), "src/app/api/export/review-packet/route.ts"),
      "utf8"
    );
    for (const raw of [calendar, reviewPacket]) {
      expect(raw).toContain("product.v9.export_started");
      expect(raw).toContain("product.v9.export_completed");
    }
    expect(reviewPacket).toContain("product.v9.export_failed");
  });
});
