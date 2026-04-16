#!/usr/bin/env node
/**
 * Validates scripts/qa-route-coverage.tsv: tabs, headers, enums, unique routes, e2e_url_visit tokens.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const tsvPath = path.join(root, "scripts", "qa-route-coverage.tsv");

const EXPECTED_HEADER = [
  "route",
  "axe_auto",
  "viewport_auto",
  "e2e_url_visit",
  "manual_3g_done",
  "loading_checked",
  "bugs_found",
  "open_p0p1",
  "notes",
];

/** Tokens observed in e2e_url_visit column (comma-separated). Extend when adding new coverage tags. */
const E2E_URL_VISIT_TOKENS = new Set([
  "a11y.spec",
  "smoke",
  "perf",
  "authenticated",
  "v3",
  "v5",
  "v6",
  "manual",
  "manual_a11y_gap",
  "manual_needs_id",
  "v3_workflows",
  "v5_surfaces",
  "v5_surfaces_if_enabled",
  "v5_surfaces_optional",
  "v5_surfaces_invalid_token",
  "v5_workflows_optional",
  "v6_assurance",
  "authenticated_nav",
  "auth-flow",
  "marketing_public",
  "onboarding_calibration_e2e",
  "security_api",
]);

const YN = new Set(["y", "n"]);
const MANUAL_3G = new Set(["pending_human"]);
const OPEN_P0P1 = new Set(["y", "n"]);

function loadGeneratedArray(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const match = source.match(/=\s*(\[[\s\S]*\])\s+as const;/);
  if (!match) {
    throw new Error(`Could not parse generated matrix: ${filePath}`);
  }
  return JSON.parse(match[1]);
}

function main() {
  if (!fs.existsSync(tsvPath)) {
    console.error("Missing", tsvPath);
    process.exit(1);
  }
  const raw = fs.readFileSync(tsvPath, "utf8");
  if (raw.includes("\r\n") && !raw.includes("\n")) {
    console.warn("TSV uses CRLF only; normalizing checks on \\n split");
  }
  const lines = raw.split(/\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) {
    console.error("TSV must have header + rows");
    process.exit(1);
  }
  const headerLine = lines[0];
  if (!headerLine.includes("\t")) {
    console.error("Header must be tab-separated (found no tab)");
    process.exit(1);
  }
  const headerCols = headerLine.split("\t");
  if (headerCols.length !== EXPECTED_HEADER.length) {
    console.error(`Expected ${EXPECTED_HEADER.length} columns, got ${headerCols.length}`);
    process.exit(1);
  }
  for (let i = 0; i < EXPECTED_HEADER.length; i += 1) {
    if (headerCols[i] !== EXPECTED_HEADER[i]) {
      console.error(`Header column ${i}: expected "${EXPECTED_HEADER[i]}", got "${headerCols[i]}"`);
      process.exit(1);
    }
  }

  const routes = new Set();
  let rowNum = 1;
  for (let li = 1; li < lines.length; li += 1) {
    const line = lines[li];
    rowNum += 1;
    if (!line.includes("\t")) {
      console.error(`Line ${rowNum}: must be tab-separated`);
      process.exit(1);
    }
    const cols = line.split("\t");
    while (cols.length < EXPECTED_HEADER.length) cols.push("");
    if (cols.length !== EXPECTED_HEADER.length) {
      console.error(`Line ${rowNum}: expected ${EXPECTED_HEADER.length} columns, got ${cols.length}`);
      process.exit(1);
    }
    const [
      route,
      axeAuto,
      viewportAuto,
      e2eVisit,
      manual3g,
      loadingChecked,
      bugsFound,
      openP0p1,
      notes,
    ] = cols;

    if (!route.startsWith("/")) {
      console.error(`Line ${rowNum}: route must start with /`);
      process.exit(1);
    }
    if (route !== route.trim() || route.includes("  ")) {
      console.error(`Line ${rowNum}: route should not have leading/trailing/double spaces`);
      process.exit(1);
    }
    if (routes.has(route)) {
      console.error(`Duplicate route: ${route}`);
      process.exit(1);
    }
    routes.add(route);

    if (!YN.has(axeAuto)) {
      console.error(`Line ${rowNum}: axe_auto must be y or n`);
      process.exit(1);
    }
    if (!YN.has(viewportAuto)) {
      console.error(`Line ${rowNum}: viewport_auto must be y or n`);
      process.exit(1);
    }
    if (!MANUAL_3G.has(manual3g)) {
      console.error(`Line ${rowNum}: manual_3g_done must be one of`, [...MANUAL_3G].join(", "));
      process.exit(1);
    }
    if (!YN.has(loadingChecked)) {
      console.error(`Line ${rowNum}: loading_checked must be y or n`);
      process.exit(1);
    }
    if (!OPEN_P0P1.has(openP0p1)) {
      console.error(`Line ${rowNum}: open_p0p1 must be y or n`);
      process.exit(1);
    }

    const bugsN = Number.parseInt(bugsFound, 10);
    if (Number.isNaN(bugsN) || bugsN < 0 || String(bugsN) !== bugsFound.trim()) {
      console.error(`Line ${rowNum}: bugs_found must be a non-negative integer`);
      process.exit(1);
    }

    for (const token of e2eVisit.split(",").map((t) => t.trim()).filter(Boolean)) {
      if (!E2E_URL_VISIT_TOKENS.has(token)) {
        console.error(
          `Line ${rowNum}: unknown e2e_url_visit token "${token}". Add to E2E_URL_VISIT_TOKENS in check-qa-route-coverage-tsv.mjs if intentional.`
        );
        process.exit(1);
      }
    }
    if (typeof notes !== "string") {
      console.error(`Line ${rowNum}: notes must be present (can be empty)`);
      process.exit(1);
    }
  }

  const generatedMatrixFiles = [
    path.join(root, "e2e", "generated", "authenticated-routes.ts"),
    path.join(root, "e2e", "generated", "public-routes.ts"),
    path.join(root, "e2e", "generated", "visual-routes.ts"),
  ];
  for (const filePath of generatedMatrixFiles) {
    if (!fs.existsSync(filePath)) {
      console.error("Missing generated matrix", path.relative(root, filePath));
      process.exit(1);
    }
    const generated = loadGeneratedArray(filePath);
    for (const entry of generated) {
      const route = entry?.route;
      if (typeof route === "string" && !routes.has(route)) {
        console.error(
          `Generated route ${route} from ${path.relative(root, filePath)} missing from qa-route-coverage.tsv`
        );
        process.exit(1);
      }
    }
  }

  console.log(`check-qa-route-coverage-tsv: OK (${routes.size} route(s))`);
}

main();
