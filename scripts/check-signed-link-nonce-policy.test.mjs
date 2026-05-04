import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeSignedLinkNoncePolicy } from "./check-signed-link-nonce-policy.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeSignedLinkNoncePolicy validates step-up ticket signing and verification anchors", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-signed-link-nonce-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:signed-link-nonce-policy": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:signed-link-nonce-policy\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:signed-link-nonce-policy"\n');
  write(root, "src/lib/v5/api.ts", 'const SUBMIT_TICKET_TTL_MS = 15 * 60 * 1000;\n`EXTERNAL_ACTION_SUBMIT_TICKET_SECRET` (must not reuse CRON_SECRET or the passcode pepper).\nconst exp = Date.now() + SUBMIT_TICKET_TTL_MS;\nconst body = JSON.stringify({ lid: input.linkId, t: input.urlToken, exp });\nconst sig = createHmac("sha256", externalSubmitTicketSecret()).update(body, "utf8").digest("base64url");\nif (raw.lid !== expectedLinkId) return { ok: false, reason: "submit_ticket_invalid" };\nreturn { ok: false, reason: "submit_ticket_expired" };\n');
  write(root, "src/lib/v5/api.external.test.ts", 'it("signExternalSubmitTicket works in production with dedicated submit secret", () => {})\nit("rejects CRON_SECRET as submit-ticket HMAC key in production", () => {})\n');
  write(root, "src/app/api/external-actions/[token]/status/route.ts", 'import { nowIso, signExternalSubmitTicket } from "@/lib/v5/api";\nconst submitTicket =\ndata.requires_reauth && effectiveStatus === "open" && !expired\n? signExternalSubmitTicket({ linkId: data.id, urlToken: token })\n: undefined;\nCall GET status before each submit; include submitTicket from this response in your POST body.\n');
  write(root, "src/app/api/external-actions/[token]/status/route.test.ts", 'it("includes submitTicket when requires_reauth and link is open", async () => {})\n');
  write(root, "src/app/api/external-actions/[token]/submit/route.ts", 'import { nowIso, verifyExternalPasscode, verifyExternalSubmitTicket } from "@/lib/v5/api";\nconst ticketCheck = verifyExternalSubmitTicket(token, submitTicket, String(link.id));\nconst error =\nticketCheck.reason === "submit_ticket_required"\n? "This link requires a fresh status check before submit. Load the page or call GET status, then try again."\n: "Invalid or expired submit ticket. Refresh the page to obtain a new ticket.",\ncode: ticketCheck.reason;\n');
  write(root, "src/app/api/external-actions/[token]/submit/route.test.ts", 'it("returns 403 when requires_reauth and submit ticket missing", async () => {})\nit("accepts submit when requires_reauth and valid ticket", async () => {})\n');

  const report = analyzeSignedLinkNoncePolicy(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});