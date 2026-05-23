import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeXssClientExposure } from "./check-xss-client-exposure.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeValidFixture(root) {
  write(root, "package.json", JSON.stringify({ scripts: { "check:xss-client-exposure": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:xss-client-exposure\nnpm run check:dangerously-set-inner-html\nnpm run check:postmessage-origins\nnpm run check:client-storage-sensitivity\nnpm run check:next-public-surface\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:xss-client-exposure"\n"check:dangerously-set-inner-html"\n"check:postmessage-origins"\n"check:client-storage-sensitivity"\n"check:outbound-message-safety"\n');
  write(root, "src/lib/security/json-ld-inline-script.ts", 'export function serializeJsonLdForInlineScript(value: unknown): string {\nreturn JSON.stringify(value).replace(/</g, "\\\\u003c")\n}\n');
  write(root, "src/lib/security/json-ld-inline-script.test.ts", 'it("does not emit raw </script> inside string values", () => {})\nit("escapes user-controlled names and titles with script tags", () => {})\n');
  write(root, "src/components/landing/landing-json-ld.tsx", 'type="application/ld+json"\ndangerouslySetInnerHTML={{ __html: serializeJsonLdForInlineScript(payload) }}\n');
  write(root, "src/components/landing/legal-page-json-ld.tsx", 'type="application/ld+json"\ndangerouslySetInnerHTML={{ __html: serializeJsonLdForInlineScript([webPage, breadcrumbs]) }}\n');
  write(root, "src/lib/security/safe-external-href.ts", 'const DANGEROUS_SCHEME = /x/;\nexport function sanitizeExternalHref(\nreplace(/[\\u0000-\\u001f]+/g, "")\nt.includes("\\u007f")\nlower.startsWith("//")\n');
  write(root, "src/lib/security/safe-external-href.test.ts", 'expect(sanitizeExternalHref(" javaScript :alert(1)")).toBeNull();\nexpect(sanitizeExternalHref("java\\nscript:alert(1)")).toBeNull();\nexpect(sanitizeExternalHref("//evil.example/path")).toBeNull();\n');
  write(root, "src/components/ui/external-link.tsx", 'target="_blank"\nconst parts = new Set(["noreferrer", "noopener"]);\nconst safeHref = sanitizeExternalHref(href);\nif (!safeHref)\nrel={mergeRel(rel)}\n');
  for (const [name, fn] of [["chat", "sanitizeChatSnippet"], ["adaptive-card", "sanitizeAdaptiveCardSnippet"], ["discord-embed", "sanitizeDiscordEmbedSnippet"]]) {
    write(root, `src/lib/messaging/${name}-snippet-sanitize.ts`, `export function ${fn}(){\n.replace(/javascript:/gi, "javascript\\u200b:")\n.replace(/vbscript:/gi, "vbscript\\u200b:")\n.replace(/data:text\\/html/gi, "data\\u200b:text/html")\n.replace(/<\\/?script/gi, "<scr\\u200bipt")\n}\n`);
  }
  write(root, "src/lib/messaging/chat-snippet-sanitize.test.ts", 'it("breaks script tags and HTML data URLs", () => {})\nit("defangs Slack-style auto-link openers", () => {})\n');
  write(root, "src/lib/messaging/adaptive-card-snippet-sanitize.test.ts", 'it("breaks script tags and HTML data URLs", () => {})\n');
  write(root, "src/lib/messaging/discord-embed-snippet-sanitize.test.ts", 'it("breaks active content URL and script tokens", () => {})\n');
  write(root, "src/lib/v9-dashboard-no-dangerous-html.v9.test.ts", 'Core dashboard tree avoids dangerouslySetInnerHTML\nexpect(hits, hits.join("\\n")).toEqual([]);\n');
  write(root, "scripts/check-dangerously-set-inner-html.mjs", "dangerouslySetInnerHTML\n");
  write(root, "scripts/check-next-public-surface.mjs", "NEXT_PUBLIC_\n");
  write(root, "scripts/check-client-storage-sensitivity.mjs", "analyzeClientStorageSensitivity\ndirect_client_storage_access\nsensitive_storage_key\nunapproved_storage_key\n");
  write(
    root,
    "src/lib/security/client-storage.ts",
    [
      "const CLIENT_STORAGE_JSON_MAX_LENGTH = 4096;",
      "function readStoredJson(parsed) {",
      "  hasUnsafeJsonKey(parsed);",
      "  isJsonShapeWithinLimits(parsed, {});",
      "}",
      "export function readCommandPaletteRecentCommands() {}",
      "export function readUploadMetadataDraft() {}",
      "export function writeContractTableSelection() {}",
    ].join("\n")
  );
  write(root, "scripts/check-client-bundle-secret-leakage.mjs", "analyzeClientBundleSecretLeakage\nserver_env_in_client_bundle\nsupabase_server_import_in_client_bundle\n");
  write(root, "src/components/layout/sidebar.tsx", "readSidebarCollapsedPreference();\n");
  write(root, "src/app/error.tsx", '"use client";\ncaptureClientException(error, { extra: { route: "app/error", digest: error.digest } });\n<RouteStatePanel title="This page could not load" digest={error.digest} />\n');
}

test("analyzeXssClientExposure accepts approved JSON-LD sinks, sanitizers, public env, and storage policy", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-xss-client-"));
  writeValidFixture(root);
  const report = analyzeXssClientExposure(root);
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
  assert.equal(report.issueCount, 0);
});

test("analyzeXssClientExposure rejects unapproved HTML sinks and sensitive storage", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-xss-client-bad-"));
  writeValidFixture(root);
  write(root, "src/components/bad.tsx", 'export function Bad(){ return <div dangerouslySetInnerHTML={{__html: userHtml}} /> }\n');
  write(root, "src/components/storage.tsx", 'window.localStorage.setItem("token", token)\n');
  const report = analyzeXssClientExposure(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((i) => i.issue === "unapproved_dangerously_set_inner_html"));
  assert(report.issues.some((i) => i.issue === "sensitive_client_storage"));
});

test("analyzeXssClientExposure rejects postMessage, unsafe target blank, and server-only client imports", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-xss-client-more-bad-"));
  writeValidFixture(root);
  write(root, "src/components/post-message.tsx", 'export function Bad(){ window.postMessage({ ok: true }, "*"); return null; }\n');
  write(root, "src/components/blank.tsx", 'export function Bad(){ return <a target="_blank" href="https://evil.test">x</a>; }\n');
  write(root, "src/components/client-secret.tsx", '"use client";\nimport { createAdminClient } from "@/lib/supabase/server";\nexport function Bad(){ return null; }\n');
  const report = analyzeXssClientExposure(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((i) => i.issue === "unapproved_postmessage"));
  assert(report.issues.some((i) => i.issue === "unsafe_target_blank"));
  assert(report.issues.some((i) => i.issue === "client_server_only_import"));
});

test("analyzeXssClientExposure rejects raw error boundary message rendering", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-xss-client-error-boundary-"));
  writeValidFixture(root);
  write(root, "src/app/error.tsx", '"use client";\ncaptureClientException(error);\nexport function Bad({ error }) { return <p>{error.message}</p>; }\n');
  const report = analyzeXssClientExposure(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((i) => i.issue === "frontend_error_boundary_raw_error"));
});
