import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeVersionedContentContracts,
  buildVersionedContentContractInventory,
  classifyContentContract,
  classifyContentSubSurface,
  suggestedNeutralContentName,
} from "./check-versioned-content-contracts.mjs";

function makeRoot(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "versioned-content-contracts-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`);
}

test("suggestedNeutralContentName normalizes env keys, telemetry names, and selectors", () => {
  assert.equal(suggestedNeutralContentName("V5_DECISION_PACKET_BUCKET"), "DECISION_PACKET_BUCKET");
  assert.equal(suggestedNeutralContentName("NEXT_PUBLIC_V10_SUPPORT_DIAGNOSTICS"), "NEXT_PUBLIC_SUPPORT_DIAGNOSTICS");
  assert.equal(suggestedNeutralContentName("ENABLE_V6_ASSURANCE_CORE"), "ENABLE_ASSURANCE_CORE");
  assert.equal(suggestedNeutralContentName("product.v9.example"), "product.example");
  assert.equal(suggestedNeutralContentName("data-v10-state"), "data-state");
  assert.equal(suggestedNeutralContentName("REQUIRED_V10_TABLES"), "REQUIRED_TABLES");
  assert.equal(suggestedNeutralContentName("plain"), null);
});

test("classifyContentContract preserves legitimate provider and crypto versions", () => {
  assert.equal(
    classifyContentContract({
      path: "src/lib/crypto.ts",
      excerpt: "const prefix = 'enc:v1:';",
      token: "v1",
    }),
    "provider_or_crypto_format",
  );
  assert.equal(
    classifyContentContract({
      path: "src/app/api/stripe/route.ts",
      excerpt: "const signature = 'Stripe-Signature: v1=';",
      token: "v1",
    }),
    "provider_or_crypto_format",
  );
});

test("classifyContentSubSurface adds concrete content-surface metadata", () => {
  assert.equal(
    classifyContentSubSurface({
      path: "src/lib/example.test.ts",
      excerpt: "test('data-v10-state is visible', () => {})",
      token: "v10",
      surfaceClass: "dom_or_test_selector",
      contractName: "data-v10-state",
    }),
    "dom_data_attribute",
  );
  assert.equal(
    classifyContentSubSurface({
      path: "supabase/migrations/001.sql",
      excerpt: "create policy v6_policy on organizations",
      token: "v6",
      surfaceClass: "sql_object",
      contractName: "v6_policy",
    }),
    "migration_sql_content",
  );
});

test("inventory groups content contracts without storing source excerpts", () => {
  const root = makeRoot({
    "src/lib/example.ts": [
      "const bucket = process.env.V5_DECISION_PACKET_BUCKET;",
      "const event = 'product.v9.example';",
      "const selector = 'data-v10-state';",
    ].join("\n"),
  });

  const inventory = buildVersionedContentContractInventory(root);
  const names = inventory.contracts.map((row) => [row.contractName, row.surfaceClass]);

  assert.deepEqual(names, [
    ["data-v10-state", "dom_or_test_selector"],
    ["V5_DECISION_PACKET_BUCKET", "environment_key"],
    ["product.v9.example", "telemetry_event"],
  ]);
  assert.ok(inventory.contracts.every((row) => !("excerpt" in row)));
  assert.ok(inventory.contracts.every((row) => typeof row.subSurfaceClass === "string" && row.subSurfaceClass.length > 0));
  assert.ok(inventory.contracts.every((row) => typeof row.manualFollowUp === "string" && row.manualFollowUp.length > 0));
  assert.ok(inventory.contracts.every((row) => row.evidenceHashes.every((hash) => /^[a-f0-9]{16}$/u.test(hash))));
});

test("analyzeVersionedContentContracts detects artifact drift", () => {
  const root = makeRoot({
    "src/lib/example.ts": "const bucket = process.env.V5_DECISION_PACKET_BUCKET;\n",
  });
  writeJson(root, "artifacts/compatibility/versioned-content-contract-inventory.json", {
    stale: true,
  });

  const report = analyzeVersionedContentContracts({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_content_contract_inventory_drift"));
});

test("analyzeVersionedContentContracts accepts current artifact", () => {
  const root = makeRoot({
    "src/lib/example.ts": "const bucket = process.env.V5_DECISION_PACKET_BUCKET;\n",
  });
  writeJson(
    root,
    "artifacts/compatibility/versioned-content-contract-inventory.json",
    buildVersionedContentContractInventory(root),
  );

  const report = analyzeVersionedContentContracts({ root });

  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});
