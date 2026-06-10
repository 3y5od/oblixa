import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { analyzeThirdPartyScriptIntegrity } from "./check-third-party-script-integrity.mjs";

function makeRoot(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-third-party-script-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}

test("passes when no external scripts are present", () => {
  const root = makeRoot({
    "src/app/page.tsx": "export default function Page() { return <div />; }\n",
  });
  const report = analyzeThirdPartyScriptIntegrity(root);
  assert.equal(report.ok, true);
});

test("fails external script tags without integrity and crossorigin metadata", () => {
  const root = makeRoot({
    "src/app/page.tsx": 'export default function Page() { return <Script src="https://cdn.example.test/app.js" />; }\n',
  });
  const report = analyzeThirdPartyScriptIntegrity(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "external_script_missing_integrity"));
  assert(report.issues.some((issue) => issue.issue === "external_script_missing_crossorigin"));
});

test("accepts external scripts with integrity and crossorigin metadata", () => {
  const root = makeRoot({
    "src/app/page.tsx": 'export default function Page() { return <Script src="https://cdn.example.test/app.js" integrity="sha384-example" crossOrigin="anonymous" />; }\n',
  });
  const report = analyzeThirdPartyScriptIntegrity(root);
  assert.equal(report.ok, true);
});

test("ignores relative same-origin script URLs", () => {
  const root = makeRoot({
    "src/app/page.tsx": 'export default function Page() { return <script src="/static/app.js" />; }\n',
  });
  const report = analyzeThirdPartyScriptIntegrity(root);
  assert.equal(report.ok, true);
});
