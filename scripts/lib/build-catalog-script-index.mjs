/**
 * Epic 13 — catalog partition → assurance script index rows.
 */
import fs from "node:fs";
import path from "node:path";

export function buildCatalogScriptIndexPayload(root) {
  const catalogDir = path.join(root, "src", "lib", "debugging-sweep", "catalog-partitions");
  const catalogs = fs
    .readdirSync(catalogDir)
    .filter((f) => f.startsWith("catalog-") && f.endsWith(".ts") && !f.endsWith(".generated.ts"))
    .sort()
    .map((file) => ({
      catalogFile: `src/lib/debugging-sweep/catalog-partitions/${file}`,
      catalogId: file.replace(/\.ts$/, ""),
      npmScripts: ["check:debugging-sweep", "generate:debugging-sweep-catalog"],
      tests: ["src/lib/debugging-sweep/debugging-sweep-catalog.test.ts"],
    }));
  return {
    version: 1,
    program: "maximal-assurance-epic13",
    generatedAt: new Date().toISOString(),
    catalogCount: catalogs.length,
    catalogs,
  };
}
