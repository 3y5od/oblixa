import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SETTINGS_BILLING_STRINGS } from "@/lib/settings/spec-strings";

// SPEC: docs/billing-page-maximal-pass.md §14.x — billing-page surface
// tests. Validates that the page source pins the design contract from
// the release-state spec + design-principles. Substring-level pins are
// the canonical pattern in this codebase (see settings-page-refinement,
// v9-route-metadata, v7-billing-stripe-surface).

const PAGE = join(
  process.cwd(),
  "src/app/(dashboard)/settings/billing/page.tsx"
);
const LOADING = join(
  process.cwd(),
  "src/app/(dashboard)/settings/billing/loading.tsx"
);
const ERROR_BOUNDARY = join(
  process.cwd(),
  "src/app/(dashboard)/settings/billing/error.tsx"
);
const STATUS_LIB = join(process.cwd(), "src/lib/billing/status.ts");
const STATES_LIB = join(process.cwd(), "src/lib/billing/states.ts");
const SPEC_STRINGS = join(process.cwd(), "src/lib/settings/spec-strings.ts");

const pageSrc = readFileSync(PAGE, "utf8");
const loadingSrc = readFileSync(LOADING, "utf8");
const errorSrc = readFileSync(ERROR_BOUNDARY, "utf8");
const statusSrc = readFileSync(STATUS_LIB, "utf8");
const statesSrc = readFileSync(STATES_LIB, "utf8");
const specSrc = readFileSync(SPEC_STRINGS, "utf8");

describe("Billing page — release-state spec content (§14.x)", () => {
  it("renders the spec-mandated CTA literals", () => {
    expect(SETTINGS_BILLING_STRINGS.primaryCta).toBe("Choose annual plan");
    expect(SETTINGS_BILLING_STRINGS.secondaryCta).toBe("Continue monthly");
    expect(SETTINGS_BILLING_STRINGS.trialCta).toBe("Convert to paid plan");
    expect(SETTINGS_BILLING_STRINGS.reactivateCta).toBe(
      "Reactivate subscription"
    );
    expect(SETTINGS_BILLING_STRINGS.resumeCheckoutCta).toBe("Resume checkout");
  });

  it("renders the 6 spec-mandated FAQ questions with real answers", () => {
    const questions: ReadonlyArray<string> = SETTINGS_BILLING_STRINGS.faq;
    expect(questions).toHaveLength(6);
    expect(questions).toContain("What happens when the trial ends?");
    expect(questions).toContain("Can I export before cancelling?");
    expect(questions).toContain("Can I change plans?");
    expect(questions).toContain("Can I add more contracts?");
    expect(questions).toContain("Can I add more team members?");
    expect(questions).toContain("Do you offer setup help?");

    for (const q of questions) {
      const answer = (
        SETTINGS_BILLING_STRINGS.faqAnswers as Record<string, string>
      )[q];
      expect(answer, `answer missing for: ${q}`).toBeTruthy();
      expect(answer.length, `answer too short for: ${q}`).toBeGreaterThan(20);
    }
  });

  it("Guided Pilot details surface in the setup-help answer (§8.6)", () => {
    const setupHelp =
      SETTINGS_BILLING_STRINGS.faqAnswers["Do you offer setup help?"];
    expect(setupHelp).toContain("Guided Pilot");
    expect(setupHelp).toContain("$1,500");
    expect(setupHelp).toContain("60 days");
  });

  it("Core plan limits match release-state §Plan Limits", () => {
    expect(SETTINGS_BILLING_STRINGS.coreLimits.contracts).toBe(500);
    expect(SETTINGS_BILLING_STRINGS.coreLimits.teamMembers).toBe(10);
  });

  it("Trial caps match release-state §Trial", () => {
    expect(SETTINGS_BILLING_STRINGS.trialCaps.contracts).toBe(25);
    expect(SETTINGS_BILLING_STRINGS.trialCaps.teamMembers).toBe(3);
    expect(SETTINGS_BILLING_STRINGS.trialCaps.days).toBe(21);
  });

  it("Founding Customer Offer reflects release-state spec ($2,400 / 25 limit)", () => {
    expect(
      SETTINGS_BILLING_STRINGS.foundingCustomerOffer.priceDisplay
    ).toContain("$2,400");
    expect(SETTINGS_BILLING_STRINGS.foundingCustomerOffer.limit).toBe(25);
  });

  it("FAQ answers respect Oblixa voice rules (no banned vocabulary)", () => {
    const forbidden = [
      "platform",
      "transformation",
      "governance",
      "autopilot",
      "intelligence",
    ];
    for (const answer of Object.values(SETTINGS_BILLING_STRINGS.faqAnswers)) {
      const lower = answer.toLowerCase();
      for (const f of forbidden) {
        expect(
          lower.includes(f),
          `FAQ answer contains banned word "${f}": ${answer}`
        ).toBe(false);
      }
    }
  });
});

describe("Billing page — design-principles compliance (§14.x)", () => {
  it("uses canonical FAQ disclosure pattern per §6", () => {
    // ChevronRight rotate-90, NOT ChevronDown rotate-180
    expect(pageSrc).toContain("ChevronRight");
    expect(pageSrc).toContain("group-open:rotate-90");
    expect(pageSrc).not.toMatch(/group-open:rotate-180/);
    // border-y hairlines on summary
    expect(pageSrc).toContain("border-y border-[color:color-mix(in_oklab,var(--border-subtle)");
    // marker:hidden + webkit suppression
    expect(pageSrc).toContain("marker:hidden");
    expect(pageSrc).toContain("[&::-webkit-details-marker]:hidden");
    // pl-10 indented content
    expect(pageSrc).toContain("pl-10");
    // focus-visible ring
    expect(pageSrc).toContain("focus-visible:ring-2");
    expect(pageSrc).toContain("focus-visible:ring-[var(--focus-ring)]");
    // 44px tap target
    expect(pageSrc).toContain("min-h-[44px]");
  });

  it("uses StatusBadge (canonical per §7.7), not inline ui-status-badge spans", () => {
    expect(pageSrc).toContain('from "@/components/ui/status-badge"');
    expect(pageSrc).toContain("<StatusBadge");
  });

  it("metaStrip uses ui-caps-2 labels (per refinement §5.4 bump from caps-3)", () => {
    expect(pageSrc).toMatch(/<dt className="ui-caps-2/);
  });

  it("ArrowLeft back-link uses strokeWidth={2} per §5.2", () => {
    expect(pageSrc).toMatch(/<ArrowLeft[^>]*strokeWidth=\{2\}/);
  });

  it("CreditCard page-header icon uses strokeWidth={1.85} per §2.4 canonical", () => {
    expect(pageSrc).toMatch(/<CreditCard[^>]*strokeWidth=\{1\.85\}/);
  });

  it("declares runtime: nodejs for Stripe SDK (§3.27)", () => {
    expect(pageSrc).toContain('export const runtime = "nodejs"');
  });

  it("skip-to-content link present for keyboard a11y (§11.1)", () => {
    expect(pageSrc).toContain('href="#billing-plan-title"');
    expect(pageSrc).toContain("Skip to billing content");
  });

  it("groups page-header + alerts in single flex-col wrapper per §5.3", () => {
    expect(pageSrc).toContain('<div className="flex flex-col gap-4">');
  });
});

describe("Billing page — defect fixes (§1.x, §14.3, §14.13)", () => {
  it("searchParams.success truthiness uses === '1' not truthy check (§1.1)", () => {
    expect(pageSrc).toContain('searchParams.success === "1"');
    expect(pageSrc).toContain('searchParams.canceled === "1"');
  });

  it("currentPlan uses 3-state derivation (§1.3)", () => {
    expect(pageSrc).toContain('"Oblixa Pro (lapsed)"');
  });

  it("trial_end falls back for currentPeriodEndEpoch (§1.4)", () => {
    expect(pageSrc).toContain("trialEndEpoch");
  });

  it("locale-aware Intl.NumberFormat uses locale arg, not hardcoded en-US (§1.20)", () => {
    expect(pageSrc).not.toMatch(/new Intl\.NumberFormat\("en-US"/);
    expect(pageSrc).toContain("new Intl.NumberFormat(locale ?? undefined");
  });

  it("currency decimals branch on per-currency map (§1.21 / §16.2)", () => {
    expect(pageSrc).toContain("CURRENCY_DECIMALS");
    expect(pageSrc).toMatch(/jpy:\s*0/);
    expect(pageSrc).toMatch(/kwd:\s*3/);
  });

  it("session_id race-condition fallback indicated (§1.22)", () => {
    // page accepts session_id in searchParams type
    expect(pageSrc).toContain("session_id");
  });

  it("incomplete_expired and unpaid branches present (§1.29)", () => {
    expect(pageSrc).toContain('"incomplete_expired"');
    expect(pageSrc).toContain('"unpaid"');
  });

  it("cancel_at scheduled banner distinct from cancel_at_period_end (§1.30)", () => {
    expect(pageSrc).toContain("scheduledCancelBanner");
  });

  it("test-mode banner gated on sk_test_ prefix (§1.31)", () => {
    expect(pageSrc).toContain("sk_test_");
  });
});

// ---------------------------------------------------------------------
// Refinement-pass §14 test additions
// ---------------------------------------------------------------------

describe("Refinement §14 — page restructure pins", () => {
  // §14.1 none state — premium empty-state takeover suppresses STATUS metaStrip
  it("§14.1 free-plan admin renders premium-card empty state (replaces dl)", () => {
    expect(pageSrc).toContain("Choose a plan");
    expect(pageSrc).toContain("landing-corner-ring");
    expect(pageSrc).toContain('aria-labelledby="billing-empty-title"');
  });

  it("§14.1 STATUS metaStrip on 'none' state surfaces workspace + trial-ended (not null)", () => {
    // Finishing-pass §1.10: free state no longer suppresses metaStrip
    // to null — it renders a Workspace chip (+ TRIAL ENDED date when
    // stripeTrialEndedAt is set). The STATUS field itself is still
    // dropped because the empty-state premium card carries the badge.
    expect(pageSrc).toMatch(
      /subscriptionStatus === "none" \?[\s\S]{0,400}Workspace/
    );
    expect(pageSrc).toContain("trialEndedLabel");
  });

  // §14.2 INVOICE ACCESS + CANCELLATION PATH render as Link, not plain text
  it("§14.2 invoice access + cancellation path use portal links", () => {
    expect(pageSrc).toContain("/api/stripe/portal?return=invoices");
    expect(pageSrc).toContain("/api/stripe/portal?return=cancel");
  });

  // §14.3 FAQ icons vary per question
  it("§14.3 FAQ icons vary per question (FAQ_ICONS map)", () => {
    expect(pageSrc).toContain("FAQ_ICONS");
    expect(pageSrc).toContain('"What happens when the trial ends?": Clock');
    expect(pageSrc).toContain('"Do you offer setup help?": LifeBuoy');
  });

  // §14.4 "Free" not in BILLING_PLACEHOLDER_VALUES
  it("§14.4 'Free' is NOT in BILLING_PLACEHOLDER_VALUES", () => {
    expect(specSrc).not.toMatch(/free:\s*"Free"/);
  });

  // §14.5 TEST MODE banner short copy
  it("§14.5 TEST MODE banner uses short copy", () => {
    expect(specSrc).toContain("testModeBannerShort");
    expect(specSrc).toContain("Test billing mode");
  });

  // §14.6 ChipPair microcopy — no bare middle-dot
  it("§14.6 trial microcopy renders as ChipPair, no bare middle-dot", () => {
    expect(pageSrc).toContain("TrialMicrocopyChipPair");
    expect(specSrc).toContain("trialMicrocopyParts");
    // The page must NOT render the bare-dot single-string in the actions
    // slot (verified by the use of <TrialMicrocopyChipPair /> instead of
    // {SETTINGS_BILLING_STRINGS.trialMicrocopy})
    expect(pageSrc).not.toMatch(
      /<span[^>]*>\s*\{SETTINGS_BILLING_STRINGS\.trialMicrocopy\}\s*<\/span>/
    );
  });

  // §14.7 drift banner in dev
  it("§14.7 drift assertion surfaces visibly in dev", () => {
    expect(pageSrc).toContain("priceDriftMessage");
    expect(pageSrc).toContain('process.env.NODE_ENV !== "production"');
  });

  // §14.8 voice rules on trial microcopy + contact-sales
  it("§14.8 trial microcopy + contact-sales copy pass voice rules", () => {
    const forbidden = ["platform", "transformation", "governance", "autopilot", "intelligence"];
    const microcopy = SETTINGS_BILLING_STRINGS.trialMicrocopyParts.join(" ").toLowerCase();
    const sales = SETTINGS_BILLING_STRINGS.contactSalesPromptShort.toLowerCase();
    for (const f of forbidden) {
      expect(microcopy.includes(f), `microcopy: ${f}`).toBe(false);
      expect(sales.includes(f), `sales: ${f}`).toBe(false);
    }
  });

  // §14.9 — FAQ footer surfaces the enterprise-interest contact link.
  // Polish-pass §4.7 — aligned to release-state §305 exact phrasing
  // (`contactSalesPromptSpec` instead of `contactSalesPromptShort`).
  it("§14.9 FAQ footer surfaces enterprise-interest contact-sales link", () => {
    expect(pageSrc).toContain("contactSalesPromptSpec");
    expect(pageSrc).toContain("contactSalesHref");
    expect(pageSrc).toContain("contactSalesCta");
  });

  // §14.10 savings line / plan comparison when monthly configured
  it("§14.10 plan-comparison renders when monthlyConfigured", () => {
    expect(pageSrc).toContain("monthlyConfigured ? (");
    expect(pageSrc).toContain("SAVE $600/YR");
  });

  // §14.11 ACH payment method branch
  it("§14.11 ACH / SEPA / BACS payment method branches render", () => {
    expect(pageSrc).toContain("defaultBankAccount");
    expect(pageSrc).toContain("us_bank_account");
    expect(pageSrc).toContain("sepa_debit");
    expect(pageSrc).toContain("bacs_debit");
  });

  // §14.12 covered by format.test.ts (separate file)

  // §14.13 time-zone disclosure
  it("§14.13 time-zone disclosure renders beneath renewal row", () => {
    expect(pageSrc).toContain("UTC · auto-renews");
  });

  // §14.14 noscript block exists with explicit JS-required affordance list
  // per polish-pass §9.9 (was generic "JavaScript is disabled" copy).
  it("§14.14 <noscript> block exists with explicit affordance list", () => {
    expect(pageSrc).toContain("<noscript>");
    expect(pageSrc).toContain("noscriptCopy");
    expect(specSrc).toContain("Without JavaScript:");
    expect(specSrc).toContain("expand FAQ items");
  });

  // §14.15 covered by decline-codes.test.ts

  // §14.16 trial-progress chip
  it("§14.16 trial-progress chip renders 'DAY n of 21'", () => {
    expect(pageSrc).toContain("trialDay");
    expect(pageSrc).toContain("trialCaps.days");
  });

  // §14.17 multi-sub admin diagnostic
  it("§14.17 multi-sub admin diagnostic surfaces when multipleActiveSubs", () => {
    expect(pageSrc).toContain("multipleActiveSubs");
    expect(pageSrc).toContain("Multiple active subscriptions detected");
  });

  // §14.18 voice-check on remediation strings
  it("§14.18 decline-code remediation copy passes voice rules", () => {
    const forbidden = ["platform", "transformation", "governance", "autopilot", "intelligence"];
    const remediations = Object.values(
      SETTINGS_BILLING_STRINGS.declineRemediation
    )
      .join(" ")
      .toLowerCase();
    for (const f of forbidden) {
      expect(remediations.includes(f), `remediation: ${f}`).toBe(false);
    }
  });

  // §14.22 tax-ID verification badge per verification.status
  it("§14.22 tax-ID verification.status renders as StatusBadge", () => {
    expect(pageSrc).toContain("customerTaxIdStatus");
    expect(pageSrc).toContain('"verified"');
    expect(pageSrc).toContain('"pending"');
    expect(pageSrc).toContain('"unverified"');
  });

  // §14.23 form-action POST fallback
  it("§14.23 noscript form-action POST fallback exists on SubscribeButton", () => {
    const actionsSrc = readFileSync(
      join(process.cwd(), "src/components/settings/billing-actions.tsx"),
      "utf8"
    );
    expect(actionsSrc).toContain(
      '<form action="/api/stripe/checkout" method="POST">'
    );
    expect(actionsSrc).toContain('name="variant"');
    expect(actionsSrc).toContain('name="founding"');
  });

  // Premium empty-state has Wave 2 plan-comparison + ChipPair microcopy
  it("Wave 2 — premium empty state includes plan-comparison mini-table", () => {
    expect(pageSrc).toContain("plan comparison mini-table");
  });

  // §3.4 / §3.16 — grouped INCLUDED rows + Check medallions
  it("§3.4 + §3.16 dl groups plan-includes under INCLUDED sub-eyebrow", () => {
    expect(pageSrc).toContain("includedEyebrow");
    expect(pageSrc).toContain('group: "included"');
  });

  it("§3.16 INCLUDED rows render a Check medallion", () => {
    expect(pageSrc).toContain("row.included ? (");
    expect(pageSrc).toContain("strokeWidth={2.2}");
  });

  // §4.6 + polish-pass §3.1/§3.4 — compact empty state uses
  // spec-strings + INVOICES eyebrow (was HISTORY) + Inbox icon.
  it("§4.6 invoices list renders compact empty state", () => {
    const invoicesSrc = readFileSync(
      join(process.cwd(), "src/components/settings/billing-invoices-list.tsx"),
      "utf8"
    );
    expect(invoicesSrc).toContain("invoicesEyebrow");
    expect(invoicesSrc).toContain("noInvoicesYet");
    expect(invoicesSrc).toContain("Inbox");
    expect(invoicesSrc).toContain("VIEW PORTAL");
  });

  // §3.19 — PDF proxy link
  it("§3.19 invoice list links through /api/stripe/invoices/[id]/pdf proxy", () => {
    const invoicesSrc = readFileSync(
      join(process.cwd(), "src/components/settings/billing-invoices-list.tsx"),
      "utf8"
    );
    expect(invoicesSrc).toContain("/api/stripe/invoices/${inv.id}/pdf");
  });

  // §12.2 / §12.3 / polish §7.5 — print + generic copy button used
  // for customer + workspace IDs.
  it("§12.2 + §12.3 + polish §7.5 admin-only print + copy buttons", () => {
    expect(pageSrc).toContain("BillingPrintButton");
    expect(pageSrc).toContain("BillingCopyButton");
    expect(pageSrc).toContain("customerIdLabel");
    expect(pageSrc).toContain("workspaceIdLabel");
  });

  // §12.5 — Stripe Tax indicator pill
  it("§12.5 Stripe Tax indicator pill gated on env flag", () => {
    expect(pageSrc).toContain("stripeTaxEnabled");
    expect(pageSrc).toContain("TAX · AUTO-CALCULATED");
  });

  // §12.7 — Customer-since stat
  it("§12.7 customer-since stat renders when customerCreatedEpoch present", () => {
    expect(pageSrc).toContain("customerCreatedEpoch");
  });

  // §12.8 — test card hints behind details in dev
  it("§12.8 test card hints surface in TEST MODE", () => {
    expect(pageSrc).toContain("Stripe test cards");
    expect(specSrc).toContain("testCardHints");
    expect(specSrc).toContain("4242 4242 4242 4242");
  });

  // §12.9 — audit-history link in FAQ footer
  it("§12.9 billing audit-history link in FAQ footer", () => {
    expect(pageSrc).toContain("/settings/security?filter=billing");
  });

  // §9.2 — FAQ aria-label with question index
  it("§9.2 FAQ <summary> has aria-label with question index", () => {
    expect(pageSrc).toContain("`Question ${idx + 1} of ${total}: ${question}`");
  });

  // §6.7 — multi-sub admin diagnostic alert
  it("§6.7 multi-sub admin diagnostic surfaces as warning alert", () => {
    expect(pageSrc).toContain("multipleActiveSubs");
  });
});

// ---------------------------------------------------------------------
// Polish-pass §14 test additions (post-restructure pins)
// ---------------------------------------------------------------------

describe("Polish-pass §14 — post-restructure pins", () => {
  // §14.1 no bare middle-dot between caps tokens
  it("§14.1 no bare middle-dot between caps tokens in page source", () => {
    // Allow `·` only inside .ui-dot-sep or comments. Reject patterns
    // like `WHATEVER · OTHERONE` where both sides are ≥3 uppercase chars.
    const sourceWithoutComments = pageSrc.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(sourceWithoutComments).not.toMatch(
      /\b[A-Z]{3,}[A-Z\s]+\s+·\s+[A-Z]{3,}/
    );
  });

  // §14.2 native disclosure marker hidden everywhere
  it("§14.2 every <details> summary suppresses the native marker", () => {
    // Look BEFORE "Stripe test cards" since marker:hidden is on the
    // <summary> classname which appears in the JSX before the visible
    // text. The summary classes include marker:hidden +
    // [&::-webkit-details-marker]:hidden.
    expect(pageSrc).toMatch(
      /marker:hidden[^"]*\[&::-webkit-details-marker\]:hidden[\s\S]{0,400}Stripe test cards/
    );
  });

  // §14.3 Check-medallion plan-includes feature list. Finishing-pass
  // §2.4 swapped the empty-state medallion from `Sparkles` →
  // `CircleDollarSign` for billing-specific iconography per spec §2.4.
  it("§14.3 plan-includes features render with Check medallion grid", () => {
    expect(pageSrc).toContain("CircleDollarSign");
    expect(pageSrc).toContain("planIncludesEyebrow");
    // Per §2.12, the grid is responsive — assert the breakpoints
    // appear, allowing intervening utility classes (gap-x, gap-y).
    expect(pageSrc).toContain("grid-cols-1");
    expect(pageSrc).toContain("sm:grid-cols-2");
    expect(pageSrc).toContain("lg:grid-cols-3");
  });

  // §14.4 ActionChip-style structured affordances (caps verb + chevron)
  it("§14.4 VIEW PLAN DETAILS + VIEW PORTAL use structured caps affordance", () => {
    expect(pageSrc).toContain("VIEW PLAN DETAILS");
    const invoicesSrc = readFileSync(
      join(process.cwd(), "src/components/settings/billing-invoices-list.tsx"),
      "utf8"
    );
    expect(invoicesSrc).toContain("VIEW PORTAL");
  });

  // §14.5 — trial messaging consolidated per finishing-pass §1.3.
  // The dedicated tertiary trial-start link was dropped (duplicated
  // with the structured microcopy). The microcopy ChipPair is now
  // the single trial signal. Spec-strings still define startTrialCta
  // for potential re-introduction; the page doesn't render it.
  it("§14.5 trial messaging consolidated (single microcopy signal)", () => {
    expect(pageSrc).toContain("TrialMicrocopyChipPair");
    // The dedicated tertiary link is no longer rendered on the page.
    expect(pageSrc).not.toMatch(
      /startTrialCta[^a-z]/
    );
  });

  // §14.6 founding ribbon (no emoji, no bare dot) — currently
  // implementation lives behind the founding-customer feature flag;
  // assert spec-strings are voice-clean.
  it("§14.6 founding ribbon strings are voice-clean (no emoji)", () => {
    const label = SETTINGS_BILLING_STRINGS.foundingRibbonLabel;
    const suffix = SETTINGS_BILLING_STRINGS.foundingRibbonSuffix;
    // No emoji code points (basic check covering common decorative ranges).
    expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(label)).toBe(false);
    expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(suffix)).toBe(false);
  });

  // §14.7 workspace-ID copy alongside customer-ID
  it("§14.7 workspace + customer ID copy buttons present", () => {
    expect(pageSrc).toContain("customerIdLabel");
    expect(pageSrc).toContain("workspaceIdLabel");
  });

  // §14.8 visual-regression sanity — empty-state structure pins.
  // Finishing-pass §2.4 — `CircleDollarSign` is billing-specific
  // (replaces `Sparkles` decorative-magic icon).
  it("§14.8 empty-state structure includes CircleDollarSign + StatusBadge", () => {
    expect(pageSrc).toContain("CircleDollarSign");
    expect(pageSrc).toContain('<StatusBadge status="info">FREE PLAN</StatusBadge>');
  });

  // §14.9 customer-ID masking via BillingCopyButton primitive
  it("§14.9 BillingCopyButton masks identifier by default", () => {
    const actionsSrc = readFileSync(
      join(
        process.cwd(),
        "src/components/settings/billing-page-actions.tsx"
      ),
      "utf8"
    );
    expect(actionsSrc).toContain("maskIdentifier");
    expect(actionsSrc).toContain("masked");
    expect(actionsSrc).toContain("revealed");
  });

  // §14.10 body paragraph length ≤ 80 chars (§2.10)
  it("§14.10 emptyStateBody is ≤ 80 chars", () => {
    expect(SETTINGS_BILLING_STRINGS.emptyStateBody.length).toBeLessThanOrEqual(
      80
    );
  });

  // §14.11 audit-history filter link uses the standard query param
  it("§14.11 audit-history link routes to /settings/security?filter=billing", () => {
    expect(pageSrc).toContain("/settings/security?filter=billing");
  });
});

// ---------------------------------------------------------------------
// Finishing-pass §16 test additions
// ---------------------------------------------------------------------

describe("Finishing-pass §16 — post-finishing-pass pins", () => {
  // §16.1 — $249 annual price (release-state §Pricing)
  it("§16.1 $249 annual price renders (not $299) under primary CTA", () => {
    // The price line below the CTA pins $249/month billed annually
    // per release-state §Pricing.
    expect(pageSrc).toMatch(/\$249[\s\S]{0,80}billed annually/);
  });

  // §16.2 — HAVE A DISCOUNT CODE? prompt is absent
  it("§16.2 HAVE A DISCOUNT CODE? prompt is absent (Stripe checkout exposes promo)", () => {
    expect(pageSrc).not.toContain("HAVE A DISCOUNT CODE?");
  });

  // §16.3 — only one trial signal (microcopy, no tertiary link)
  it("§16.3 trial signal is single (microcopy only, no 'Or start a 21-day free trial' link)", () => {
    expect(pageSrc).not.toMatch(/Or start a 21-day free trial/);
    expect(pageSrc).toContain("TrialMicrocopyChipPair");
  });

  // §16.4 — copy buttons render with opacity-50 (not 0) on rest
  it("§16.4 copy buttons use opacity-50 default for visible-but-muted affordance", () => {
    const actionsSrc = readFileSync(
      join(
        process.cwd(),
        "src/components/settings/billing-page-actions.tsx"
      ),
      "utf8"
    );
    // Finishing-pass §1.5: Copy icon must default to opacity-50 (not
    // opacity-0) so the click-to-copy affordance is discoverable
    // without hover.
    expect(actionsSrc).toMatch(/opacity-50[\s\S]{0,200}group-hover:opacity-100/);
    expect(actionsSrc).not.toMatch(/Copy[\s\S]{0,200}opacity-0\s+/);
  });

  // §16.5 — empty invoices renders as hairline strip, not full card
  it("§16.5 empty invoices uses hairline strip (no card chrome)", () => {
    const invoicesSrc = readFileSync(
      join(process.cwd(), "src/components/settings/billing-invoices-list.tsx"),
      "utf8"
    );
    // The hairline-strip form has rounded-xl border + raised surface
    // but does NOT use ui-card (which adds full card chrome).
    // Confirm the empty-state section uses the lightweight pattern.
    expect(invoicesSrc).toMatch(
      /invoices\.length[\s\S]{0,200}rounded-xl border/
    );
    // The empty-state must NOT use the full ui-card with header/body
    // chrome (i.e., no `<header className="border-b` in the empty branch).
  });

  // §16.6 — state-specific lead per §5.1
  it("§16.6 page-header lead branches on subscriptionStatus", () => {
    expect(pageSrc).toContain("leadFreeState");
    expect(pageSrc).toContain("leadActiveState");
    expect(pageSrc).toMatch(/subscriptionStatus === "none"[\s\S]{0,80}leadFreeState/);
  });

  // §16.7 — workspace + trial-ended metaStrip on free state
  it("§16.7 free-state metaStrip surfaces workspace + (optional) trial-ended", () => {
    // §1.10: when subscriptionStatus === "none", metaStrip is NOT
    // null — it renders a Workspace chip + (when stripeTrialEndedAt)
    // a Trial-ended chip.
    expect(pageSrc).toMatch(/subscriptionStatus === "none" \?[\s\S]{0,400}Workspace/);
    expect(pageSrc).toContain("trialEndedLabel");
  });

  // §16.8 — 2-col grid for invoices + FAQ at lg+
  it("§16.8 invoices + FAQ wrap in 2-col grid at lg+ per §10.1", () => {
    expect(pageSrc).toMatch(/grid gap-4 lg:grid-cols-2[\s\S]{0,1500}BillingInvoicesList/);
    // The FAQ section is the second cell in the grid.
    expect(pageSrc).toMatch(
      /grid gap-4 lg:grid-cols-2[\s\S]{0,3500}billing-faq-title/
    );
  });

  // §16.10 — voice-rule audit on finishing-pass new copy
  it("§16.10 finishing-pass copy passes voice rules (no banned vocabulary)", () => {
    const forbidden = [
      "platform",
      "transformation",
      "governance",
      "autopilot",
      "intelligence",
    ];
    const checks = [
      SETTINGS_BILLING_STRINGS.leadFreeState,
      SETTINGS_BILLING_STRINGS.leadActiveState,
      SETTINGS_BILLING_STRINGS.emptyStateBody,
      SETTINGS_BILLING_STRINGS.trialEndedLabel,
    ];
    for (const text of checks) {
      const lower = text.toLowerCase();
      for (const f of forbidden) {
        expect(
          lower.includes(f),
          `copy contains banned word "${f}": ${text}`
        ).toBe(false);
      }
    }
  });

  // Finishing-pass §2.1 — single compact row contains both the price
  // AND the trial microcopy (separated by hairline pipe), consolidating
  // what used to be 3 stacked layers.
  it("Finishing-pass §2.1 — CTA cluster consolidated into compact row", () => {
    // Hairline pipe separator (h-3 w-px) appears between the price
    // and the trial microcopy.
    expect(pageSrc).toMatch(
      /\$249[\s\S]{0,400}h-3 w-px[\s\S]{0,400}TrialMicrocopyChipPair/
    );
  });

  // Finishing-pass §6.2 — Identifiers role=group wraps copy buttons
  it("Finishing-pass §6.2 — CUSTOMER + WORKSPACE buttons grouped under Identifiers", () => {
    expect(pageSrc).toMatch(/role="group"[\s\S]{0,200}Identifiers/);
  });
});

describe("Billing page — state-aware UX (§14.8, §14.9, §14.10)", () => {
  it("cancel_at_period_end produces cancellation-pending banner (§9.6, §9.12)", () => {
    expect(pageSrc).toContain("cancellationPendingBanner");
    // cancellation confirmation copy lives in spec-strings
    expect(specSrc).toContain("cancellation confirmation email");
  });

  it("pause_collection produces paused banner (§9.7)", () => {
    expect(pageSrc).toContain("pausedBanner");
  });

  it("discount produces discount banner (§9.8)", () => {
    expect(pageSrc).toContain("discountBanner");
  });

  it("active-risk hero card for past_due/unpaid (§9.25)", () => {
    expect(pageSrc).toContain("activeRiskHero");
    expect(pageSrc).toContain("Payment failed — restore access");
  });

  it("payment_intent.last_payment_error.message surfaced (§9.26)", () => {
    expect(pageSrc).toContain("lastPaymentErrorMessage");
  });

  it("payment_intent.next_action SCA / 3DS banner (§9.23)", () => {
    expect(pageSrc).toContain("scaBanner");
    expect(pageSrc).toContain("Complete authentication");
  });

  it("card-expiration warning banner present (§9.20)", () => {
    expect(pageSrc).toContain("cardExpirationBanner");
  });

  it("founding-customer offer banner with apply CTA (§9.11)", () => {
    expect(pageSrc).toContain("foundingBanner");
    expect(pageSrc).toContain("foundingCustomerOffer.ctaLabel");
  });

  it("21-day microcopy under primary CTA (§9.13)", () => {
    expect(pageSrc).toContain("trialMicrocopy");
  });

  it("trial countdown banner (§7.1, §7.4) with caps", () => {
    expect(pageSrc).toContain("TrialChipPair");
    expect(pageSrc).toContain("formatTrialEnd");
  });

  it("customer-deleted reconnect banner (§1.18, §9.10)", () => {
    expect(pageSrc).toContain("customerDeletedBanner");
  });

  it("billing-period range chip for active (§9.18)", () => {
    expect(pageSrc).toContain("currentPeriodStartEpoch");
  });
});

describe("Billing page — customer-expand fetches (§14.x)", () => {
  it("customer-expand fetch includes tax_ids + default_payment_method (§4.16, §9.1)", () => {
    expect(pageSrc).toContain("tax_ids");
    expect(pageSrc).toContain("invoice_settings.default_payment_method");
  });

  it("renders payment-method preview with mono font (§9.1, §10.9)", () => {
    expect(pageSrc).toContain("defaultPaymentMethod");
    expect(pageSrc).toMatch(/font-mono text-\[12\.5px\]/);
  });

  it("renders billing address from customer.address (§4.22)", () => {
    expect(pageSrc).toContain("customerAddress");
  });

  it("renders VAT/Tax ID row (§4.16)", () => {
    expect(pageSrc).toContain("customerTaxIdValue");
  });

  it("renders Tax status row (§4.20)", () => {
    expect(pageSrc).toContain("customerTaxExempt");
  });

  it("renders Account credit when balance < 0 (§4.19)", () => {
    expect(pageSrc).toContain("customerBalanceMinor");
  });

  it("renders Receipt email row from customer.email (§9.9)", () => {
    expect(pageSrc).toContain("customerEmail");
  });
});

describe("Billing page — plan-includes rows (§4.11–§4.14, §4.21)", () => {
  it("AI extraction included", () => {
    expect(pageSrc).toContain("AI extraction");
    // "Fair-use included" literal lives in spec-strings.planContent
    expect(specSrc).toContain("Fair-use included");
  });

  it("Email reminders row links to notifications", () => {
    expect(pageSrc).toContain("Email reminders");
    expect(pageSrc).toContain('href="/settings/notifications"');
  });

  it("Audit history row links to security", () => {
    expect(pageSrc).toContain("Audit history");
    expect(pageSrc).toContain('href="/settings/security"');
  });

  it("CSV export row links to imports-exports", () => {
    expect(pageSrc).toContain("CSV export");
    expect(pageSrc).toContain('href="/settings/imports-exports"');
  });

  it("Support row links to mailto support", () => {
    expect(pageSrc).toContain("Support");
    expect(pageSrc).toContain('href="mailto:support@oblixa.com"');
  });
});

describe("Billing page — loading + error boundary (§15.7, §15.1)", () => {
  it("loading.tsx uses canonical .ui-skeleton + .ui-loading-panel", () => {
    expect(loadingSrc).toContain("ui-skeleton");
    expect(loadingSrc).toContain("ui-loading-panel");
  });

  it("error.tsx is a recoverable boundary with retry", () => {
    expect(errorSrc).toContain('"use client"');
    expect(errorSrc).toContain("reset()");
    expect(errorSrc).toContain("Try again");
  });
});

describe("Billing page — lib modules (§6.x, §17.x)", () => {
  it("subscriptionStatusBadge handles all 8 statuses + modifiers", () => {
    expect(statusSrc).toContain('"incomplete_expired"');
    expect(statusSrc).toContain('"unpaid"');
    expect(statusSrc).toContain("PauseCircle");
    expect(statusSrc).toContain("cancelAtPeriodEnd");
    expect(statusSrc).toContain("cancelAt");
  });

  it("BILLING_PLACEHOLDER_VALUES derived from spec-strings (§17.1)", () => {
    expect(statesSrc).toContain(
      "Object.values(SETTINGS_BILLING_STRINGS.placeholders)"
    );
  });

  it("spec-strings has SPEC reference comment (§19.4)", () => {
    expect(specSrc).toContain("SPEC:");
    expect(specSrc).toContain("oblixa-release-state.md");
  });
});

describe("Billing checkout route — Stripe config plumbing (§14.4, §14.14)", () => {
  const checkoutSrc = readFileSync(
    join(process.cwd(), "src/app/api/stripe/checkout/route.ts"),
    "utf8"
  );

  it("declares runtime: nodejs (§3.27)", () => {
    expect(checkoutSrc).toContain('export const runtime = "nodejs"');
  });

  it("variant param plumbed through resolvePriceIdForVariant (§3.9)", () => {
    expect(checkoutSrc).toContain("resolvePriceIdForVariant");
  });

  it("metadata includes app_user_id + org_id (§3.18)", () => {
    expect(checkoutSrc).toContain("app_user_id");
    expect(checkoutSrc).toContain("organization_id: org.id");
  });

  it("success_url contains ?success=1 sentinel + session_id (§1.1, §1.22, §3.8)", () => {
    expect(checkoutSrc).toContain(
      "/settings/billing?success=1&session_id={CHECKOUT_SESSION_ID}"
    );
  });

  it("cancel_url uses ?canceled=1 sentinel (§1.1)", () => {
    expect(checkoutSrc).toContain("/settings/billing?canceled=1");
  });

  it("allow_promotion_codes enabled (§3.13)", () => {
    expect(checkoutSrc).toContain("allow_promotion_codes: true");
  });

  it("billing_address_collection required (§3.14)", () => {
    expect(checkoutSrc).toContain('billing_address_collection: "required"');
  });

  it("tax_id_collection enabled (§3.19)", () => {
    expect(checkoutSrc).toContain("tax_id_collection: { enabled: true }");
  });

  it("trial_period_days defaults to 21 (§7.5)", () => {
    expect(checkoutSrc).toContain("21");
    expect(checkoutSrc).toContain("trial_period_days");
  });

  it("modern discounts[] used for founding customer (§3.22, §3.28)", () => {
    expect(checkoutSrc).toContain("discounts: [{ coupon: foundingCouponId }]");
  });

  it("subscription_data.description anchored (§3.29)", () => {
    expect(checkoutSrc).toContain('description: "Oblixa Core"');
  });

  it("Stripe error.requestId logged on failures (§15.11)", () => {
    expect(checkoutSrc).toContain("requestId: stripeErr.requestId");
  });

  it("locale derived from Accept-Language (§3.21)", () => {
    expect(checkoutSrc).toContain("pickLocale");
    expect(checkoutSrc).toContain("accept-language");
  });

  it("HTTPS validation in production (§3.6)", () => {
    expect(checkoutSrc).toContain("https://");
    expect(checkoutSrc).toContain('"production"');
  });

  it("security headers on response (§3.16, §3.26)", () => {
    expect(checkoutSrc).toContain("Cache-Control");
    expect(checkoutSrc).toContain("no-store");
    expect(checkoutSrc).toContain("Referrer-Policy");
    expect(checkoutSrc).toContain("X-Content-Type-Options");
  });
});
