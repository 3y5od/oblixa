#!/usr/bin/env node
/**
 * Static release-state guardrails. This script encodes source-owned assertions
 * directly and does not read docs as configuration.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const strict = process.argv.includes("--strict");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

const files = {
  pricing: read("src/app/(marketing)/pricing/page.tsx"),
  contactPage: read("src/app/(marketing)/contact/page.tsx"),
  contactForm: read("src/components/landing/contact-form.tsx"),
  contactRoute: read("src/app/api/contact/route.ts"),
  billingStrings: read("src/lib/settings/spec-strings.ts"),
  calibrationCopy: read("src/lib/onboarding/calibration-copy.ts"),
  calibrationWizard: read("src/components/onboarding/calibration-wizard.tsx"),
  emailTemplates: read("src/lib/release-state-email-templates.ts"),
  analytics: read("src/lib/release-state-analytics.ts"),
};

const issues = [];

function requireContains(name, source, needle) {
  if (!source.includes(needle)) issues.push(`${name}: missing ${JSON.stringify(needle)}`);
}

function requireAbsent(name, source, pattern) {
  if (typeof pattern === "string") {
    if (source.includes(pattern)) issues.push(`${name}: contains forbidden ${JSON.stringify(pattern)}`);
    return;
  }
  if (pattern.test(source)) issues.push(`${name}: contains forbidden ${String(pattern)}`);
}

requireContains(
  "pricing",
  files.pricing,
  "Need portfolio operations, controls, or assurance workflows?"
);
requireContains("contactForm", files.contactForm, "assurance_workflows");
requireContains("contactForm", files.contactForm, "Assurance workflows");
requireContains("contactRoute", files.contactRoute, "assurance_workflows");
requireContains("contactPage", files.contactPage, "Start free trial");
requireContains("contactPage", files.contactPage, 'href="/signup"');

requireContains("billingStrings", files.billingStrings, "21-day free trial");
requireContains("billingStrings", files.billingStrings, "No credit card required");
requireContains("billingStrings", files.billingStrings, "Core includes up to 500 active contracts");
requireAbsent("billingStrings", files.billingStrings, /\bunmetered\b/i);
requireAbsent("billingStrings", files.billingStrings, /\bunlimited\b/i);

requireContains("calibrationCopy", files.calibrationCopy, "Set up your contract tracking workspace");
requireContains("calibrationCopy", files.calibrationCopy, "Your workspace is ready to track contracts");
requireContains("calibrationWizard", files.calibrationWizard, "/contracts/new");
requireAbsent("calibrationWizard", files.calibrationWizard, "completeQuestionnaireOpenAdvancedSettings");
requireAbsent("calibrationWizard", files.calibrationWizard, "skipQuestionnaireExplicitMinimal");
requireAbsent("calibrationWizard", files.calibrationWizard, "Product settings");
requireAbsent("calibrationWizard", files.calibrationWizard, "Recommended workspace mode");
requireAbsent("calibrationWizard", files.calibrationWizard, "Advanced areas visible");
requireAbsent("calibrationWizard", files.calibrationWizard, "Assurance areas visible");

for (const needle of [
  "welcome_after_signup",
  "invite_teammate",
  "calibration_completed",
  "first_contract_uploaded",
  "extraction_ready",
  "extraction_failed",
  "field_review_reminder",
  "upcoming_renewal_reminder",
  "notice_deadline_reminder",
  "work_item_assigned",
  "work_item_overdue",
  "evidence_requested",
  "evidence_overdue",
  "weekly_digest",
  "trial_day_3",
  "trial_day_10",
  "trial_ending_2_days",
  "payment_succeeded",
  "payment_failed",
  "cancellation_confirmation",
]) {
  requireContains("emailTemplates", files.emailTemplates, needle);
}
requireAbsent("emailTemplates", files.emailTemplates, /\blegal advice\b/i);
requireAbsent("emailTemplates", files.emailTemplates, /\bautonomous\b/i);
requireAbsent("emailTemplates", files.emailTemplates, /\bnever miss\b/i);

for (const needle of [
  "product.v10.signup_completed",
  "product.v10.calibration_completed",
  "product.v10.first_contract_uploaded",
  "product.v10.extraction_completed",
  "product.v10.field_reviewed",
  "product.v10.owner_assigned",
  "product.v10.key_date_added",
  "product.v10.work_item_created",
  "product.v10.evidence_requested",
  "product.v10.report_exported",
  "product.v10.trial_converted",
  "product.v10.pilot_converted",
  "product.v10.cancellation_recorded",
]) {
  requireContains("analytics", files.analytics, needle);
}
requireContains("analytics", files.analytics, "isReleaseStateActivationComplete");

if (issues.length) {
  console.error(`Release-state code-only audit: ${issues.length} issue(s)\n`);
  for (const issue of issues) console.error(`  - ${issue}`);
  if (strict) process.exit(1);
} else {
  console.log("Release-state code-only audit: all static guardrails passed.");
}
