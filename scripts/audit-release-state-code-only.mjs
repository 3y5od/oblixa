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
  homePage: read("src/app/page.tsx"),
  landingContent: read("src/components/landing/landing-content.ts"),
  landingPage: read("src/components/landing/landing-page.tsx"),
  marketingChrome: read("src/components/landing/marketing-site-chrome.tsx"),
  landingJsonLd: read("src/components/landing/landing-json-ld.tsx"),
  productPage: read("src/app/(marketing)/product/page.tsx"),
  pricingPage: read("src/app/(marketing)/pricing/page.tsx"),
  contactPage: read("src/app/(marketing)/contact/page.tsx"),
  requestAccessPage: read("src/app/(marketing)/request-access/page.tsx"),
  earlyAccessPage: read("src/app/(marketing)/early-access/page.tsx"),
  contactForm: read("src/components/landing/contact-form.tsx"),
  contactRoute: read("src/app/api/contact/route.ts"),
  securityPage: read("src/app/(marketing)/security/page.tsx"),
  signupPage: read("src/app/(auth)/signup/page.tsx"),
  authForm: read("src/components/auth/auth-form.tsx"),
  authActions: read("src/actions/auth.ts"),
  billingStrings: read("src/lib/settings/spec-strings.ts"),
  billingPage: read("src/app/(dashboard)/settings/billing/page.tsx"),
  checkoutRoute: read("src/app/api/stripe/checkout/route.ts"),
  calibrationCopy: read("src/lib/onboarding/calibration-copy.ts"),
  calibrationWizard: read("src/components/onboarding/calibration-wizard.tsx"),
  emailTemplates: read("src/lib/release-state-email-templates.ts"),
  analytics: read("src/lib/release-state-analytics.ts"),
  programAssets: read("src/lib/release-state/program-assets.ts"),
  privateControls: read("src/lib/release-state-private-controls.ts"),
  publicPaths: read("src/lib/marketing/public-paths.ts"),
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

function requireAllAbsent(name, source, patterns) {
  for (const pattern of patterns) requireAbsent(name, source, pattern);
}

const publicSources = {
  homePage: files.homePage,
  landingContent: files.landingContent,
  landingPage: files.landingPage,
  marketingChrome: files.marketingChrome,
  landingJsonLd: files.landingJsonLd,
  productPage: files.productPage,
  pricingPage: files.pricingPage,
  contactPage: files.contactPage,
  requestAccessPage: files.requestAccessPage,
  earlyAccessPage: files.earlyAccessPage,
  contactForm: files.contactForm,
  contactRoute: files.contactRoute,
  securityPage: files.securityPage,
  signupPage: files.signupPage,
  authForm: files.authForm,
  billingStrings: files.billingStrings,
  billingPage: files.billingPage,
  emailTemplates: files.emailTemplates,
  analytics: files.analytics,
};

const forbiddenPublicPhrases = [
  "Start free trial",
  "21-day free trial",
  "Book setup call",
  "Core $249/mo billed annually",
  "$249/mo",
  "$299/mo",
  "Founding Customer offer",
  "Guided Pilot",
  "assurance_workflows",
  "within 1 business day",
  "Maintained by security team",
  "Standard support",
  "self-serve trial to paid",
  "Founder-led early access",
  "Request early access",
  "early-access limits",
  "founder-led early access",
];

for (const [name, source] of Object.entries(publicSources)) {
  requireAllAbsent(name, source, forbiddenPublicPhrases);
}

requireContains("landingContent", files.landingContent, "Track what signed contracts require next.");
requireContains("landingContent", files.landingContent, "review source-backed fields");
requireContains("landingContent", files.landingContent, 'export const ctaPrimaryLabel = "Request access"');
requireContains("landingPage", files.landingPage, "Track what signed contracts require next.");
requireContains("landingPage", files.landingPage, 'href="/request-access"');
requireContains("landingPage", files.landingPage, 'href="/product"');
requireContains("marketingChrome", files.marketingChrome, "Request access");
requireContains("marketingChrome", files.marketingChrome, 'href="/request-access"');
requireContains("landingJsonLd", files.landingJsonLd, "SoftwareApplication");
requireAbsent("landingJsonLd", files.landingJsonLd, "priceCurrency");
requireAbsent("landingJsonLd", files.landingJsonLd, "UnitPriceSpecification");

requireContains("publicPaths", files.publicPaths, '"/request-access"');
requireContains("publicPaths", files.publicPaths, '"/early-access"');
requireContains("pricingPage", files.pricingPage, "Simple pricing for");
requireContains("pricingPage", files.pricingPage, "charged only after access is approved");
requireContains("contactPage", files.contactPage, "Contact Oblixa");
requireContains("contactPage", files.contactPage, "Request workspace access");
requireContains("contactPage", files.contactPage, "Security and vulnerability reports");
requireContains("contactPage", files.contactPage, "Existing workspace or billing issue");
requireAbsent("contactPage", files.contactPage, "ContactForm");
requireContains("contactForm", files.contactForm, 'name="trackingMethod"');
requireContains("contactForm", files.contactForm, 'name="redactedSample"');
requireContains("contactForm", files.contactForm, 'name="preference"');
requireContains("contactRoute", files.contactRoute, '"request_access"');
requireContains("contactRoute", files.contactRoute, "ALLOWED_TRACKING_METHODS");
requireContains("requestAccessPage", files.requestAccessPage, "Reviewed workspace access");
requireContains("requestAccessPage", files.requestAccessPage, "Redacted sample contracts");
requireContains("earlyAccessPage", files.earlyAccessPage, 'redirect("/request-access")');

requireContains(
  "authForm",
  files.authForm,
  "Signup is limited to approved workspace access links"
);
requireContains("authForm", files.authForm, 'type="hidden" name="accessCode"');
requireContains("authActions", files.authActions, "validateWorkspaceAccessGrant");
requireContains("authActions", files.authActions, "markWorkspaceAccessGrantUsed");
requireContains("authActions", files.authActions, "access_grant_id");
requireContains("authActions", files.authActions, "Signup requires approved workspace access");
requireAbsent("authActions", files.authActions, "OBLIXA_EARLY_ACCESS_SIGNUP_CODE");
requireAbsent("authActions", files.authActions, "isEarlyAccessSignupAllowed");

requireContains(
  "securityPage",
  files.securityPage,
  "Security basics for contract records"
);
requireContains("securityPage", files.securityPage, "reviewed access");
requireContains("securityPage", files.securityPage, "does not provide legal advice");

requireContains("billingStrings", files.billingStrings, "Billing is available only after access approval");
requireContains("billingStrings", files.billingStrings, "Product support during activation");
requireContains("billingPage", files.billingPage, "billingCheckoutEnabled");
requireContains("billingPage", files.billingPage, "Public billing checkout is available only after access approval");
requireContains("checkoutRoute", files.checkoutRoute, "isPublicBillingCheckoutEnabled");
requireContains("checkoutRoute", files.checkoutRoute, "billing_checkout_not_enabled");
requireContains("checkoutRoute", files.checkoutRoute, "OBLIXA_ENABLE_PUBLIC_BILLING_CHECKOUT=1");
requireContains("checkoutRoute", files.checkoutRoute, "checkout adds a trial only if explicitly configured");
requireContains("privateControls", files.privateControls, "OBLIXA_ENABLE_PRIVATE_PRODUCT_CONTROLS");
requireContains("emailTemplates", files.emailTemplates, "Welcome to Oblixa");
requireContains("emailTemplates", files.emailTemplates, "RELEASE_STATE_SECONDARY_BILLING_EMAIL_TEMPLATE_KEYS");
requireAbsent("emailTemplates", files.emailTemplates, /trial_day_|trial_ending/i);

for (const needle of [
  "product.v10.access_requested",
  "product.v10.request_qualified",
  "product.v10.tracker_reviewed",
  "product.v10.evaluation_workspace_started",
  "product.v10.activation_completed",
  "product.v10.founder_support_time_recorded",
  "product.v10.evaluation_converted",
  "product.v10.evaluation_paused",
  "product.v10.evaluation_closed",
]) {
  requireContains("analytics", files.analytics, needle);
}
requireAbsent("analytics", files.analytics, "trial_converted");
requireAbsent("analytics", files.analytics, "pilot_converted");
requireContains("analytics", files.analytics, "isReleaseStateActivationComplete");

for (const needle of [
  "RELEASE_STATE_DISCOVERY_QUESTIONS",
  "RELEASE_STATE_OBJECTION_ANSWERS",
  "RELEASE_STATE_GRADUATION_CRITERIA",
  "RELEASE_STATE_MANUAL_BOUNDARIES",
  "classifyEarlyAccessFit",
]) {
  requireContains("programAssets", files.programAssets, needle);
}

requireContains("calibrationCopy", files.calibrationCopy, "Set up your contract tracking workspace");
requireContains("calibrationCopy", files.calibrationCopy, "Your workspace is ready to track contracts");
requireContains("calibrationWizard", files.calibrationWizard, "/contracts/new");
requireAbsent("calibrationWizard", files.calibrationWizard, "completeQuestionnaireOpenAdvancedSettings");
requireAbsent("calibrationWizard", files.calibrationWizard, "skipQuestionnaireExplicitMinimal");
requireAbsent("calibrationWizard", files.calibrationWizard, "Product settings");
requireAbsent("calibrationWizard", files.calibrationWizard, "Recommended workspace mode");
requireAbsent("calibrationWizard", files.calibrationWizard, "Advanced areas visible");
requireAbsent("calibrationWizard", files.calibrationWizard, "Assurance areas visible");

if (issues.length) {
  console.error(`Release-state code-only audit: ${issues.length} issue(s)\n`);
  for (const issue of issues) console.error(`  - ${issue}`);
  if (strict) process.exit(1);
} else {
  console.log("Release-state code-only audit: all static guardrails passed.");
}
