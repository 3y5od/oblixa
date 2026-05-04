import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  analyzeDbPrivilegeSurface,
  hasOrgScopeSignal,
  hasRuntimeAdminSignal,
  isRuntimeSourceFile,
  loadReviewedSafeExceptions,
} from "./report-db-privilege-surface.mjs";

test("isRuntimeSourceFile excludes test files", () => {
  assert.equal(isRuntimeSourceFile("src/lib/foo.ts"), true);
  assert.equal(isRuntimeSourceFile("src/lib/foo.tsx"), true);
  assert.equal(isRuntimeSourceFile("src/lib/foo.test.ts"), false);
  assert.equal(isRuntimeSourceFile("src/lib/foo.spec.tsx"), false);
  assert.equal(isRuntimeSourceFile("src/app/api/cron/v6/route-shell-test-helper.ts"), false);
});

test("hasRuntimeAdminSignal ignores import-only and type-only mentions", () => {
  assert.equal(
    hasRuntimeAdminSignal('import type { createAdminClient } from "@/lib/supabase/server";\ntype Admin = Awaited<ReturnType<typeof createAdminClient>>;'),
    false
  );
  assert.equal(
    hasRuntimeAdminSignal('import { createAdminClient } from "@/lib/supabase/server";\nconst admin = await createAdminClient();'),
    true
  );
  assert.equal(
    hasRuntimeAdminSignal('import { createAdminClient } from "@/lib/supabase/server";\nconst opts = { adminFactory: createAdminClient };'),
    true
  );
});

test("hasOrgScopeSignal recognizes common org scoping variants", () => {
  assert.equal(hasOrgScopeSignal('const organizationId = "org_1";'), true);
  assert.equal(hasOrgScopeSignal('const orgIds = ["org_1"];'), true);
  assert.equal(hasOrgScopeSignal('const auditOrgId = "org_1";'), true);
  assert.equal(hasOrgScopeSignal('const token = "abc";'), false);
});

test("loadReviewedSafeExceptions requires metadata and preserves review details", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-db-priv-meta-"));
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "scripts", "db-privilege-surface-safe-exceptions.txt"),
    "# meta: owner=@security expiry=2027-12-31 reason=shared boundary\nsrc/lib/cron/route-runner.ts\n"
  );

  const entries = loadReviewedSafeExceptions(root);

  assert.deepEqual(entries.get("src/lib/cron/route-runner.ts"), {
    owner: "@security",
    expiry: "2027-12-31",
    reason: "shared boundary",
  });
  fs.writeFileSync(path.join(root, "scripts", "db-privilege-surface-safe-exceptions.txt"), "src/lib/cron/route-runner.ts\n");
  assert.throws(() => loadReviewedSafeExceptions(root), /requires preceding meta line/);
});

test("analyzeDbPrivilegeSurface ignores tests while keeping runtime hits", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-db-priv-"));
  fs.mkdirSync(path.join(root, "src", "lib"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "app", "api", "cron", "v6"), { recursive: true });
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "src", "lib", "runtime.ts"),
    'import { createAdminClient } from "@/lib/supabase/server";\nconst admin = await createAdminClient();\nconst organizationId = "org_1";\n'
  );
  fs.writeFileSync(
    path.join(root, "src", "lib", "runtime.test.ts"),
    'import { createAdminClient } from "@/lib/supabase/server";\nconst admin = await createAdminClient();\n'
  );
  fs.writeFileSync(
    path.join(root, "src", "lib", "type-only.ts"),
    'import type { createAdminClient } from "@/lib/supabase/server";\nexport type Admin = Awaited<ReturnType<typeof createAdminClient>>;\n'
  );
  fs.writeFileSync(
    path.join(root, "src", "app", "api", "cron", "v6", "route-shell-test-helper.ts"),
    'import { vi } from "vitest";\nconst createAdminClient = vi.fn();\n'
  );
  fs.writeFileSync(
    path.join(root, "scripts", "db-privilege-surface-safe-exceptions.txt"),
    [
      "# meta: owner=@security expiry=2027-12-31 reason=shared boundary",
      "src/lib/runtime-exception.ts",
      "# meta: owner=@security expiry=2027-12-31 reason=stale entry check",
      "src/lib/missing.ts",
      "",
    ].join("\n")
  );
  fs.writeFileSync(
    path.join(root, "src", "lib", "runtime-exception.ts"),
    'import { createAdminClient } from "@/lib/supabase/server";\nconst admin = await createAdminClient();\n'
  );

  const report = analyzeDbPrivilegeSurface(root);

  assert.equal(report.fileCount, 2);
  assert.equal(report.reviewedSafeExceptionCount, 1);
  assert.equal(report.unreviewedCount, 0);
  assert.deepEqual(report.staleReviewedSafeExceptions, ["src/lib/missing.ts"]);
  assert.deepEqual(report.rows, [
    {
      file: "src/lib/runtime-exception.ts",
      usesAdmin: true,
      usesMembership: false,
      usesOrgScope: false,
      reviewedSafeException: true,
      reviewOwner: "@security",
      reviewExpiry: "2027-12-31",
      reviewReason: "shared boundary",
      needsReview: false,
    },
    {
      file: "src/lib/runtime.ts",
      usesAdmin: true,
      usesMembership: false,
      usesOrgScope: true,
      reviewedSafeException: false,
      needsReview: false,
    },
  ]);
});