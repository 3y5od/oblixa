#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const OUTPUT_REL = "artifacts/flake-summary.json";

export const REQUIRED_FLAKE_CLASSES = [
  "timeout",
  "locator_failure",
  "network_failure",
  "assertion_drift",
  "visual_drift",
  "browser_crash",
  "environment_missing",
];

export const DEFAULT_FLAKE_OWNER = "@test-platform";
export const DEFAULT_NEXT_VALIDATION_COMMAND = "check:operational-test-reliability-governance";

export const FLAKE_CLASS_RULES = [
  {
    id: "timeout",
    patterns: [/\btimeout\b/i, /\btimed out\b/i, /\bexceeded \d+ms\b/i, /waiting .* failed/i],
  },
  {
    id: "locator_failure",
    patterns: [/locator/i, /getBy(?:Role|Text|Label|TestId)/, /strict mode violation/i, /element.*(?:not visible|not attached|detached)/i],
  },
  {
    id: "network_failure",
    patterns: [/net::[A-Z_]+/i, /\b(?:ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT)\b/i, /request failed/i, /fetch failed/i, /socket hang up/i],
  },
  {
    id: "assertion_drift",
    patterns: [/\bexpect\(/i, /\bExpected\b/i, /\bReceived\b/i, /\bto(?:Be|Equal|Contain|Match|Have)\b/, /assertion/i],
  },
  {
    id: "visual_drift",
    patterns: [/toHaveScreenshot/i, /screenshot/i, /snapshot/i, /pixelmatch/i, /visual diff/i],
  },
  {
    id: "browser_crash",
    patterns: [/browser.*crash/i, /page.*crash/i, /target closed/i, /browser.*closed/i, /page.*closed/i, /\bcrashed\b/i],
  },
  {
    id: "environment_missing",
    patterns: [/missing env/i, /required env/i, /not configured/i, /credentials required/i, /\bSet [A-Z0-9_]+/i, /secret.*missing/i],
  },
];

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function read(root, relOrAbs) {
  const abs = path.isAbsolute(relOrAbs) ? relOrAbs : path.join(root, relOrAbs);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stableStringify(value));
}

function decodeXml(text) {
  return String(text ?? "")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function parseAttrs(attrText = "") {
  const attrs = {};
  for (const match of attrText.matchAll(/([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*(["'])(.*?)\2/gsu)) {
    attrs[match[1]] = decodeXml(match[3]);
  }
  return attrs;
}

function stripXmlTags(text) {
  return decodeXml(String(text ?? "").replace(/<[^>]+>/gu, " ")).replace(/\s+/gu, " ").trim();
}

function extractJUnitFailureText(body) {
  const parts = [];
  const blockRe = /<(failure|error|skipped)\b([^>]*)>([\s\S]*?)<\/\1>|<(failure|error|skipped)\b([^>]*)\/>/gu;
  for (const match of body.matchAll(blockRe)) {
    const tag = match[1] ?? match[4];
    const attrs = parseAttrs(match[2] ?? match[5] ?? "");
    const inner = stripXmlTags(match[3] ?? "");
    parts.push([tag, attrs.message, attrs.type, inner].filter(Boolean).join(" "));
  }
  return parts.join("\n").trim();
}

export function classifyFailureText(text) {
  const haystack = String(text ?? "");
  const classes = FLAKE_CLASS_RULES.filter((rule) => rule.patterns.some((pattern) => pattern.test(haystack))).map((rule) => rule.id);
  return classes.length ? classes : ["unclassified"];
}

function classCoverage(owner, nextValidationCommand) {
  return REQUIRED_FLAKE_CLASSES.map((id) => {
    const rule = FLAKE_CLASS_RULES.find((candidate) => candidate.id === id);
    return {
      class: id,
      owner,
      nextValidationCommand,
      detectorCount: rule?.patterns.length ?? 0,
    };
  });
}

function parseJUnitReport(root, reportPath, owner, nextValidationCommand) {
  const xml = read(root, reportPath);
  const cases = [];
  const rows = [];
  const caseRe = /<testcase\b([^>]*)>([\s\S]*?)<\/testcase>|<testcase\b([^>]*)\/>/gu;
  for (const match of xml.matchAll(caseRe)) {
    const attrs = parseAttrs(match[1] ?? match[3] ?? "");
    const body = match[2] ?? "";
    const failureText = extractJUnitFailureText(body);
    const hasFailure = /<(failure|error)\b/u.test(body);
    const skipped = /<skipped\b/u.test(body);
    const flaky = String(attrs.flaky ?? attrs.retry ?? "").toLowerCase() === "true";
    const status = hasFailure ? "failed" : skipped ? "skipped" : flaky ? "flaky" : "passed";
    const row = {
      source: "junit",
      reportPath,
      testPath: attrs.file ?? attrs.classname ?? null,
      title: [attrs.classname, attrs.name].filter(Boolean).join(" ").trim() || attrs.name || "unknown",
      status,
      flaky,
      durationSeconds: attrs.time ? Number(attrs.time) : null,
      failureText,
    };
    cases.push(row);
    if (status !== "passed") {
      const classes = classifyFailureText(failureText || row.title);
      rows.push({
        ...row,
        primaryClass: classes[0],
        classes,
        owner,
        nextValidationCommand,
      });
    }
  }
  return { caseCount: cases.length, rows };
}

function resultFailureText(result) {
  const parts = [];
  if (result?.error) {
    parts.push(result.error.message, result.error.stack, result.error.value);
  }
  for (const error of result?.errors ?? []) {
    parts.push(error.message, error.stack, error.value);
  }
  for (const entry of result?.stdout ?? []) parts.push(entry.text);
  for (const entry of result?.stderr ?? []) parts.push(entry.text);
  return parts.filter(Boolean).join("\n").trim();
}

function collectJsonRows(data, reportPath, owner, nextValidationCommand) {
  const rows = [];
  let caseCount = 0;

  function walkSuite(suite, titleParts = []) {
    for (const child of suite?.suites ?? []) walkSuite(child, [...titleParts, child.title].filter(Boolean));
    for (const spec of suite?.specs ?? []) {
      const specTitle = [...titleParts, spec.title].filter(Boolean);
      for (const test of spec.tests ?? []) {
        caseCount += 1;
        const outcome = test.outcome ?? test.status ?? null;
        for (const result of test.results ?? []) {
          const status = result.status ?? outcome ?? "unknown";
          const flaky = outcome === "flaky" || status === "flaky";
          if (status === "passed" && !flaky) continue;
          const failureText = resultFailureText(result);
          const classes = classifyFailureText(failureText || specTitle.join(" "));
          rows.push({
            source: "playwright-json",
            reportPath,
            testPath: spec.file ?? null,
            title: specTitle.join(" > "),
            status,
            flaky,
            durationMs: typeof result.duration === "number" ? result.duration : null,
            failureText,
            primaryClass: classes[0],
            classes,
            owner,
            nextValidationCommand,
          });
        }
      }
    }
  }

  for (const suite of data?.suites ?? []) walkSuite(suite, [suite.title].filter(Boolean));
  return { caseCount, rows };
}

function parseJsonReport(root, reportPath, owner, nextValidationCommand) {
  const data = JSON.parse(read(root, reportPath));
  return collectJsonRows(data, reportPath, owner, nextValidationCommand);
}

function candidateReportPaths(root, configured = []) {
  const envPaths = [
    process.env.PLAYWRIGHT_JSON_OUTPUT,
    process.env.PLAYWRIGHT_JUNIT_OUTPUT,
    process.env.PLAYWRIGHT_FLAKE_REPORT,
  ].filter(Boolean);
  return [
    ...configured,
    ...envPaths,
    "test-results/results.json",
    "test-results/junit.xml",
    "playwright-report/results.json",
  ]
    .map((entry) => (path.isAbsolute(entry) ? path.relative(root, entry).replace(/\\/gu, "/") : entry))
    .filter((entry, index, list) => entry && list.indexOf(entry) === index);
}

export function buildPlaywrightFlakeClassificationReport(options = {}) {
  const root = options.root ?? ROOT;
  const owner = options.owner ?? DEFAULT_FLAKE_OWNER;
  const nextValidationCommand = options.nextValidationCommand ?? DEFAULT_NEXT_VALIDATION_COMMAND;
  const candidates = candidateReportPaths(root, options.reportPaths ?? []);
  const existingReports = candidates.filter((rel) => fs.existsSync(path.join(root, rel)));
  const rows = [];
  const parsedReports = [];
  const issues = [];

  for (const reportPath of existingReports) {
    try {
      const parsed = reportPath.endsWith(".json")
        ? parseJsonReport(root, reportPath, owner, nextValidationCommand)
        : parseJUnitReport(root, reportPath, owner, nextValidationCommand);
      rows.push(...parsed.rows);
      parsedReports.push({ path: reportPath, caseCount: parsed.caseCount, classifiedRowCount: parsed.rows.length });
    } catch (error) {
      issues.push({ issue: "playwright_flake_report_parse_failed", reportPath, message: error?.message ?? String(error) });
    }
  }

  const classCounts = Object.fromEntries([...REQUIRED_FLAKE_CLASSES, "unclassified"].map((id) => [id, 0]));
  for (const row of rows) {
    classCounts[row.primaryClass] = (classCounts[row.primaryClass] ?? 0) + 1;
  }
  for (const row of rows.filter((candidate) => candidate.primaryClass === "unclassified")) {
    issues.push({ issue: "playwright_flake_unclassified_failure", reportPath: row.reportPath, testPath: row.testPath, title: row.title });
  }

  return {
    schemaVersion: 1,
    source: "playwright-flake-classification",
    ok: issues.length === 0,
    mode: existingReports.length ? "parsed_reports" : "no_report",
    configuredReportPaths: candidates,
    parsedReports,
    requiredClasses: REQUIRED_FLAKE_CLASSES,
    classCoverage: classCoverage(owner, nextValidationCommand),
    classifiedFailureCount: rows.length,
    unclassifiedCount: rows.filter((row) => row.primaryClass === "unclassified").length,
    classCounts,
    rows: rows
      .map((row) => ({
        reportPath: row.reportPath,
        testPath: row.testPath,
        title: row.title,
        status: row.status,
        flaky: row.flaky,
        primaryClass: row.primaryClass,
        classes: row.classes,
        owner: row.owner,
        nextValidationCommand: row.nextValidationCommand,
      }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = buildPlaywrightFlakeClassificationReport();
  writeJson(ROOT, OUTPUT_REL, report);
  console.log(stableStringify(report));
  if (!report.ok) process.exitCode = 1;
}
