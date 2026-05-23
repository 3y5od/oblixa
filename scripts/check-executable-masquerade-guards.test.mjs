import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeExecutableMasqueradeGuards } from "./check-executable-masquerade-guards.mjs";

const BASE_ALLOWLIST = [
  {
    path: "scripts/github-actions/secret-gate.sh",
    rules: ["reviewed_script_extension", "shebang"],
    owner: "security",
    reason: "Fixture shell helper.",
    expires: "2027-12-31",
  },
  {
    path: "visual-export.js",
    rules: ["shebang"],
    owner: "frontend-platform",
    reason: "Fixture node helper.",
    expires: "2027-12-31",
  },
];

function write(root, rel, content, mode) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  if (mode !== undefined) fs.chmodSync(abs, mode);
}

test("analyzeExecutableMasqueradeGuards accepts reviewed scripts and normal source files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-exec-ok-"));
  write(root, "scripts/check-example.mjs", "#!/usr/bin/env node\nconsole.log('ok');\n");
  write(root, "scripts/github-actions/secret-gate.sh", "#!/usr/bin/env bash\necho ok\n");
  write(root, "visual-export.js", "#!/usr/bin/env node\nconsole.log('ok');\n");
  write(root, "src/app/page.tsx", "export default function Page(){ return null; }\n");

  const report = analyzeExecutableMasqueradeGuards(root, BASE_ALLOWLIST);
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
  assert.equal(report.issueCount, 0);
});

test("analyzeExecutableMasqueradeGuards rejects unreviewed shell scripts and hidden executable signatures", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-exec-bad-"));
  write(root, "scripts/run-me.sh", "#!/usr/bin/env bash\necho no\n");
  write(root, "src/assets/logo.png", Buffer.from([0x4d, 0x5a, 0x90, 0x00]));

  const report = analyzeExecutableMasqueradeGuards(root, BASE_ALLOWLIST);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "unreviewed_script_extension"), true);
  assert.equal(report.issues.some((issue) => issue.issue === "executable_binary_signature"), true);
});

test("analyzeExecutableMasqueradeGuards rejects disguised shebangs and executable bits", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-exec-mode-"));
  write(root, "docs/notes.md", "#!/usr/bin/env bash\nnot actually markdown\n");
  write(root, "src/components/card.tsx", "export function Card(){ return null; }\n", 0o755);

  const report = analyzeExecutableMasqueradeGuards(root, BASE_ALLOWLIST);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "unexpected_shebang"), true);
  assert.equal(report.issues.some((issue) => issue.issue === "unexpected_executable_bit"), true);
});

test("analyzeExecutableMasqueradeGuards rejects stale or incomplete allowlist metadata", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-exec-allowlist-"));
  write(root, "src/app/page.tsx", "export default function Page(){ return null; }\n");

  const report = analyzeExecutableMasqueradeGuards(root, [
    {
      path: "scripts/old.sh",
      rules: ["reviewed_script_extension"],
      owner: "",
      reason: "old fixture",
      expires: "2020-01-01",
    },
  ]);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "invalid_allowlist_metadata"), true);
  assert.equal(report.issues.some((issue) => issue.issue === "expired_allowlist_entry"), true);
});
