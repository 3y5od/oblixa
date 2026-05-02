import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_SWEEP_ITEMS, CATALOG_GENERATED_HASH } from "./catalog-generated";
import { getMergedSweepItems } from "./catalog-index.server";
import { PARTITION_ROW_CHECKSUMS } from "./partition-checksums.generated";
import { PARTITION_MANIFEST } from "./partition-manifest.generated";
import { STUB_CLASS_COUNT, STUB_CLASS_REGISTRY } from "./stubs/catalog-stubs.generated";

function stableJsonStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((x) => stableJsonStringify(x)).join(",")}]`;
  }
  const keys = Object.keys(value as object).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJsonStringify((value as Record<string, unknown>)[k])}`).join(",")}}`;
}

describe("debugging sweep catalog", () => {
  it("has unique ids across merged catalog", () => {
    const items = getMergedSweepItems();
    const ids = items.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("matches provenance.json row count", () => {
    const provPath = path.join(process.cwd(), "scripts", "debugging-sweep", "provenance.json");
    const prov = JSON.parse(fs.readFileSync(provPath, "utf8")) as unknown[];
    expect(ALL_SWEEP_ITEMS.length).toBe(prov.length);
  });

  it("exposes stable generated hash", () => {
    expect(CATALOG_GENERATED_HASH).toMatch(/^[a-f0-9]{64}$/);
  });

  it("has partition checksums aligned with rows", () => {
    for (const [part, expected] of Object.entries(PARTITION_ROW_CHECKSUMS)) {
      const rows = ALL_SWEEP_ITEMS.filter((r) => (r.partition ?? "pass8") === part).sort((a, b) =>
        a.id.localeCompare(b.id)
      );
      const h = createHash("sha256").update(stableJsonStringify(rows)).digest("hex");
      expect(h, part).toBe(expected);
    }
  });

  it("lists every partition anchor file on disk", () => {
    const base = path.join(process.cwd(), "src", "lib", "debugging-sweep", "catalog-partitions");
    for (const f of PARTITION_MANIFEST) {
      expect(fs.existsSync(path.join(base, f)), f).toBe(true);
    }
  });

  it("keeps stub registry aligned with STUB_CLASS_COUNT", () => {
    expect(Object.keys(STUB_CLASS_REGISTRY).length).toBe(STUB_CLASS_COUNT);
  });
});
