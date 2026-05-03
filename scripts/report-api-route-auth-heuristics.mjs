#!/usr/bin/env node
/**
 * Heuristic scan of src/app/api route.ts files (substring signals only; not proof of correct auth).
 * Writes artifacts/generated/security/SECURITY_API_AUTH_HEURISTICS.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureSecurityReportsDir, securityReportFilePath, SECURITY_REPORT_FILES } from "./lib/security-report-paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const apiRoot = path.join(root, "src", "app", "api");
ensureSecurityReportsDir(root);
const outPath = securityReportFilePath(root, SECURITY_REPORT_FILES.apiAuthHeuristics);

/** @type {{ id: string, re: RegExp }[]} */
const SIGNALS = [
  { id: "CRON_SECRET", re: /\bCRON_SECRET\b/ },
  { id: "isAuthorized", re: /\bisAuthorized\b/ },
  { id: "inbound_automation", re: /\bisInboundAutomation\w*/ },
  { id: "stripe_constructEvent", re: /\bconstructEvent\b/ },
  { id: "stripe_signature_header", re: /stripe-signature/i },
  { id: "getApiAuthContext", re: /\bgetApiAuthContext\b/ },
  { id: "canManageCapability", re: /\bcanManageCapability\b/ },
  { id: "requireV5ApiFeature", re: /\brequireV5ApiFeature\b/ },
  { id: "requireV6ApiFeature", re: /\brequireV6ApiFeature\b/ },
  { id: "createAdminClient", re: /\bcreateAdminClient\b/ },
  { id: "createServerClient", re: /\bcreateServerClient\b/ },
  { id: "createClient_supabase", re: /\bcreateClient\b/ },
  { id: "getUser", re: /\.auth\.getUser\b|\bgetUser\s*\(/ },
  { id: "parseBearerToken", re: /\bparseBearerToken\b/ },
  { id: "EXTRACTION_WORKER_SECRET", re: /\bEXTRACTION_WORKER_SECRET\b/ },
  { id: "x_api_key", re: /x-api-key/i },
  { id: "secureCompare", re: /\bsecureCompare\w*\b/ },
  { id: "segment_token_param", re: /\[token\]/ },
  { id: "segment_id_param", re: /\[id\]/ },
  { id: "NextResponse_401_403", re: /NextResponse\.json\([^)]*status:\s*40[13]/ },
  { id: "export_dynamic", re: /\bexport\s+const\s+dynamic\b/ },
  { id: "revalidate_export", re: /\bexport\s+const\s+revalidate\b/ },
  { id: "runtime_edge", re: /\bruntime\s*=\s*["']edge["']/ },
];

function walkRoutes(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkRoutes(p, acc);
    else if (name === "route.ts") acc.push(p);
  }
  return acc;
}

function toApiRelative(abs) {
  return path.relative(apiRoot, abs).replace(/\\/g, "/");
}

function detectSignals(content) {
  return SIGNALS.filter((s) => s.re.test(content)).map((s) => s.id);
}

const routes = walkRoutes(apiRoot).sort();
const rows = [];

for (const abs of routes) {
  const rel = toApiRelative(abs);
  const content = fs.readFileSync(abs, "utf8");
  const tags = detectSignals(content);
  rows.push({ rel, tags: tags.length ? tags.join(", ") : "—" });
}

const lines = [
  "# API route auth heuristics",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "**Disclaimer:** Substring matches only. They do **not** prove authentication or authorization is correct. Use for inventory and review prompts.",
  "",
  "Regenerate:",
  "",
  "```bash",
  "npm run report:security-api-auth-heuristics",
  "```",
  "",
  `**Total routes:** ${routes.length}`,
  "",
  "| Route | Detected signals |",
  "|-------|------------------|",
];

for (const r of rows) {
  lines.push(`| \`${r.rel}\` | ${r.tags} |`);
}

lines.push("");
fs.writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`Wrote ${path.relative(root, outPath)} (${routes.length} routes).`);
