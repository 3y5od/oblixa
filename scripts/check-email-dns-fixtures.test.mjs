import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeEmailDnsFixtures } from "./check-email-dns-fixtures.mjs";

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`);
}

test("analyzeEmailDnsFixtures validates code-owned SPF, DKIM, DMARC, MX, and MTA-STS fixtures", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-email-dns-"));
  writeJson(root, "artifacts/mta-sts-contract.json", { version: 1 });
  writeJson(root, "config/email-auth-dns-fixtures.json", {
    schemaVersion: 1,
    source: "code-owned-email-auth-dns-fixtures",
    domain: "oblixa.io",
    records: [
      { type: "SPF", host: "oblixa.io", expected: "v=spf1 include:_spf.resend.com -all", required: true },
      { type: "DKIM", host: "resend._domainkey.oblixa.io", expected: "v=DKIM1; k=rsa; p=x", required: true },
      { type: "DMARC", host: "_dmarc.oblixa.io", expected: "v=DMARC1; p=quarantine", required: true },
      { type: "MX", host: "oblixa.io", expected: "provider-managed", required: true },
      { type: "MTA-STS", host: "_mta-sts.oblixa.io", expected: "v=STSv1; id=fixture", required: true },
    ],
  });

  const report = analyzeEmailDnsFixtures(root, {});
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});

test("analyzeEmailDnsFixtures rejects missing auth record types", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-email-dns-bad-"));
  writeJson(root, "artifacts/mta-sts-contract.json", { version: 1 });
  writeJson(root, "config/email-auth-dns-fixtures.json", {
    schemaVersion: 1,
    source: "code-owned-email-auth-dns-fixtures",
    domain: "oblixa.io",
    records: [],
  });

  const report = analyzeEmailDnsFixtures(root, {});
  assert.equal(report.ok, false);
  assert(report.issues.some((entry) => entry.issue === "email_dns_required_record_missing" && entry.type === "DMARC"));
});
