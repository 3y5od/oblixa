#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const configPath = path.join(ROOT, "config", "database-backup-restore-evidence.json");
const artifactPath = path.join(ROOT, "artifacts", "rpo-rto-status.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const payload = {
  schemaVersion: 1,
  source: "code-owned-rpo-rto-status",
  generatedFrom: "config/database-backup-restore-evidence.json",
  manualBoundaryId: config.manualBoundaryId,
  rpoMinutes: config.rpoRto?.rpoMinutes ?? null,
  rtoMinutes: config.rpoRto?.rtoMinutes ?? null,
  reviewedOn: config.rpoRto?.reviewedOn ?? null,
  expiresOn: config.rpoRto?.expiresOn ?? null,
  evidencePolicy: "metadata-only",
};

fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
fs.writeFileSync(artifactPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));
process.exit(0);
