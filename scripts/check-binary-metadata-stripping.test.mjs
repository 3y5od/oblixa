import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeBinaryMetadataStripping } from "./check-binary-metadata-stripping.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeBinaryMetadataStripping validates PDF metadata and download controls", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-binary-metadata-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:binary-metadata-stripping": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:binary-metadata-stripping\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:binary-metadata-stripping"\n');
  write(root, "src/lib/decision-intelligence/decision-packet-pdf.tsx", 'export const DECISION_PACKET_SAFE_PDF_METADATA = {\ntitle: "Oblixa decision packet"\nauthor: "Oblixa"\ncreator: "Oblixa"\nproducer: "Oblixa"\n}\n<Document {...DECISION_PACKET_SAFE_PDF_METADATA}>\n');
  write(root, "src/lib/decision-intelligence/decision-packet-pdf.test.tsx", 'it("uses product-safe metadata instead of customer packet fields", () => {})\nDECISION_PACKET_SAFE_PDF_METADATA\nnot.toMatch(/Acme|secret|customer/i)\n');
  write(root, "src/lib/decision-intelligence/decision-packet-storage.ts", 'const MAX_DECISION_PACKET_UPLOAD_BYTES = 25 * 1024 * 1024;\nuploadDecisionPacketPdfArtifact\ncontentType: "application/pdf"\nnormalizeDecisionPacketSignedUrlTtl\n');
  write(root, "src/app/api/decisions/[id]/packet-runs/[runId]/route.ts", 'renderDecisionPacketPdfBuffer\n"content-type": "application/pdf"\n"cache-control": "private, no-store"\ncontentDispositionAttachment(filename)\n');

  const report = analyzeBinaryMetadataStripping(root);
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
  assert.equal(report.issueCount, 0);
});
