#!/usr/bin/env node
/**
 * product-surface policy §2 + §22.1 — execution identity must not foreground assurance/campaign/autopilot
 * as the primary product story on marketing, auth, external, and root entry surfaces.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const strict = process.argv.includes("--strict");

const SCAN_ROOTS = [
  join(root, "src", "components", "landing"),
  join(root, "src", "app", "(auth)"),
  join(root, "src", "app", "(external)"),
  join(root, "src", "app", "(marketing)"),
];

const SINGLE_FILES = [
  join(root, "src", "app", "page.tsx"),
  join(root, "src", "components", "auth", "auth-legal-footer.tsx"),
  join(root, "src", "components", "dashboard", "onboarding-banner.tsx"),
  join(root, "src", "components", "dashboard", "usage-section.tsx"),
];

/** Phrases that should not headline default product identity on these surfaces. */
const FORBIDDEN = [
  { re: /\bassurance\b/i, label: "assurance" },
  { re: /\bautopilot\b/i, label: "autopilot" },
  { re: /\bcampaigns?\b/i, label: "campaign(s)" },
  { re: /\bscorecard\b/i, label: "scorecard" },
  { re: /\bplaybook\b/i, label: "playbook" },
  { re: /\boutcome\s+intelligence\b/i, label: "outcome intelligence" },
];

const RELEASE_STATE_ALLOWED_PHRASES = [
  /assurance workflows/gi,
];

const NEGATION_WINDOW_CHARS = 72;
const RELEASE_CLAIM_PATTERNS = [
  {
    re: /\b(?:oblixa\s+)?(?:is|provides|offers|delivers|replaces|becomes|acts\s+as)\b.{0,48}\b(?:full|complete|end-to-end)\s+CLM\b/giu,
    label: "full_clm_claim",
  },
  {
    re: /\b(?:oblixa\s+)?(?:provides|offers|delivers|gives|renders)\b.{0,48}\blegal\s+advice\b/giu,
    label: "legal_advice_claim",
  },
  {
    re: /\b(?:GRC|governance,\s*risk,\s*and\s*compliance)\s+(?:platform|system|suite|tool)\b/giu,
    label: "grc_claim",
  },
  {
    re: /\b(?:autonomous|self-driving)\s+(?:agent|agents|legal\s+agent|contract\s+agent|workflow\s+agent)\b|\b(?:acts\s+as|is|becomes)\s+(?:an?\s+)?(?:autonomous|self-driving)\s+(?:agent|legal\s+agent|contract\s+agent|workflow\s+agent)\b/giu,
    label: "autonomous_agent_claim",
  },
  {
    re: /\benterprise\s+assurance\s+(?:platform|suite|system|program)\b/giu,
    label: "enterprise_assurance_claim",
  },
  {
    re: /\b(?:SOC\s*2|ISO\s*27001)\s+(?:certified|certification|compliant|compliance)\b/giu,
    label: "certification_claim",
  },
  {
    re: /\b(?:e-?signature|electronic\s+signature)\s+(?:platform|provider|workflow|tool)\b/giu,
    label: "esignature_claim",
  },
  {
    re: /\b(?:drafts|redlines|negotiates)\s+(?:contracts|agreements)\s+(?:for|without)\b/giu,
    label: "drafting_redlining_claim",
  },
];

const RELEASE_CLAIM_NEGATIONS = [
  "not",
  "no",
  "does not",
  "do not",
  "doesn’t",
  "isn't",
  "is not",
  "without",
  "not a",
  "not an",
  "does not replace",
  "doesn't replace",
];

function walkTsx(dir, out = []) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkTsx(p, out);
    else if (name.endsWith(".tsx") || name.endsWith(".ts")) out.push(p);
  }
  return out;
}

function collectMarketingIdentityFiles(scanRoot = root) {
  const files = new Set();
  for (const d of SCAN_ROOTS.map((dir) => dir.replace(root, scanRoot))) {
    walkTsx(d).forEach((f) => files.add(f));
  }
  for (const f of SINGLE_FILES.map((file) => file.replace(root, scanRoot))) {
    if (statSync(f, { throwIfNoEntry: false })?.isFile()) files.add(f);
  }
  return [...files].sort();
}

function hasNegatedWindow(text, index) {
  const windowText = text
    .slice(Math.max(0, index - NEGATION_WINDOW_CHARS), index)
    .toLowerCase();
  return containsNegation(windowText, RELEASE_CLAIM_NEGATIONS);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function containsNegation(text, allowedNegations) {
  return allowedNegations.some((needle) =>
    new RegExp(`(?:^|\\W)${escapeRegExp(needle.toLowerCase())}(?:$|\\W)`, "u").test(text)
  );
}

export function analyzeMarketingIdentity(scanRoot = root) {
  const files = collectMarketingIdentityFiles(scanRoot);
  const violations = [];

  for (const file of files) {
    let text = readFileSync(file, "utf8");
    for (const allowed of RELEASE_STATE_ALLOWED_PHRASES) {
      text = text.replace(allowed, "");
    }
    for (const { re, label } of FORBIDDEN) {
      if (re.test(text)) {
        violations.push({ issue: "forbidden_primary_story_lemma", file, label });
      }
    }
    const normalizedText = text.replace(/\s+/gu, " ");
    for (const { re, label } of RELEASE_CLAIM_PATTERNS) {
      for (const match of normalizedText.matchAll(re)) {
        const index = match.index ?? 0;
        const matchText = match[0].toLowerCase();
        const negatedInMatch = containsNegation(matchText, RELEASE_CLAIM_NEGATIONS);
        if (negatedInMatch || hasNegatedWindow(normalizedText, index)) continue;
        violations.push({
          issue: "forbidden_public_launch_claim",
          file,
          label,
          excerpt: match[0].slice(0, 120),
        });
      }
    }
  }

  return {
    checkId: "marketing-identity",
    ok: violations.length === 0,
    issueCount: violations.length,
    filesScanned: files.length,
    issues: violations,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeMarketingIdentity(root);
  if (!report.ok) {
    console.error("Marketing / execution-identity audit: forbidden public-facing surface claims:\n");
    for (const v of report.issues) {
      console.error(`  ${v.label}: ${v.file}`);
    }
    if (strict) process.exit(1);
    process.exit(0);
  }

  console.log(
    `Marketing identity audit: ${report.filesScanned} files scanned — no forbidden primary-story lemmas or launch claims matched.`
  );
}
