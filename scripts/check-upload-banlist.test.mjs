import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeUploadBanlist } from "./check-upload-banlist.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeUploadBanlist accepts the required executable and archive extension set", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-upload-banlist-"));
  write(
    root,
    "config/upload-format-banlist.json",
    JSON.stringify({
      version: 1,
      extensions: [
        ".7z",
        ".app",
        ".bat",
        ".cab",
        ".cmd",
        ".deb",
        ".dll",
        ".dmg",
        ".exe",
        ".jar",
        ".js",
        ".lnk",
        ".mjs",
        ".ps1",
        ".rar",
        ".rpm",
        ".scr",
        ".sh",
        ".vbs",
        ".zip",
      ],
    })
  );

  const report = analyzeUploadBanlist(root);
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
});

test("analyzeUploadBanlist rejects missing critical executable extensions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-upload-banlist-bad-"));
  write(root, "config/upload-format-banlist.json", JSON.stringify({ version: 1, extensions: [".exe"] }));

  const report = analyzeUploadBanlist(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "missing_required_extension" && issue.extension === ".zip"));
});
