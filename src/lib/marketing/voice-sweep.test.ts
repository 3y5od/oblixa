import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * v2 marketing pass — guard against voice-rule regressions.
 *
 * The release-state spec (`docs/oblixa-release-state.md` §Voice And Language)
 * explicitly bans certain words on the public marketing surface. This test
 * fails CI if any of them are reintroduced.
 *
 * Scope: every file under `src/app/(marketing)`, `src/app/page.tsx`,
 * `src/components/landing/`, plus the auth side-panel (`src/components/auth/auth-form.tsx`).
 *
 * The terms listed here come straight from the spec. If you need to add a
 * legitimate use of one of these words (e.g. inside a code-fence example or
 * the voice-rules doc itself), allow-list the file in `ALLOWLIST` below.
 */

const FORBIDDEN_PHRASES = [
  // From the v2 sweep:
  "Contract execution",
  "Execution layer",
  "execution layer",
  "Operations layer",
  "operations layer",
  "Operational layer",
  "operational layer",
  "Audit-friendly evidence",
  "audit-friendly evidence",
  "Try Oblixa free", // legacy CTA — should always be "Start free trial"
  "Press ⌘K to explore", // no command palette on the public landing
  // v3 additions — spec voice rules (avoid list):
  "Governance automation",
  "governance automation",
  "Digital transformation",
  "digital transformation",
  "Contract intelligence",
  "contract intelligence",
  "Autonomous contract",
  "autonomous contract",
  "End-to-end lifecycle",
  "end-to-end lifecycle",
  "Operational data you can defend",
  "Workflow-first operations",
  "Built-in controls for scale",
  "Trust and controls",
  "Create free account", // legacy CTA
  "audit-friendly",
  // v4 additions — broad public language remains banned unless a focused
  // release-state section explicitly requires the phrase.
  "Trust & operations",
  "Trust and operations",
  "accountable contract execution",
  "Operational overview",
  "operational overview",
  "operational data",
] as const;

/**
 * Files exempt from the sweep — e.g. the source comment that documents the
 * forbidden list, or the voice rules memory doc references.
 */
const ALLOWLIST = new Set<string>([
  // landing-content.ts has a header comment that literally lists the forbidden words.
  "src/components/landing/landing-content.ts",
]);

const ROOTS = [
  "src/app/(marketing)",
  "src/components/landing",
  "src/components/auth",
];

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e);
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|md|mdx)$/.test(e)) out.push(p);
  }
  return out;
}

describe("public marketing voice sweep", () => {
  it("does not leak forbidden marketing terms onto public surfaces", () => {
    const cwd = process.cwd();
    const files = [
      ...ROOTS.flatMap((r) => walk(join(cwd, r))),
      join(cwd, "src", "app", "page.tsx"),
      join(cwd, "src", "app", "opengraph-image.tsx"),
      join(cwd, "src", "app", "layout.tsx"),
    ];
    const violations: { file: string; phrase: string }[] = [];
    for (const file of files) {
      const rel = file.replace(cwd + "/", "");
      if (ALLOWLIST.has(rel)) continue;
      const content = readFileSync(file, "utf8");
      for (const phrase of FORBIDDEN_PHRASES) {
        if (content.includes(phrase)) {
          violations.push({ file: rel, phrase });
        }
      }
    }
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it("home hero subhead contains the spreadsheet-wedge phrase", () => {
    const content = readFileSync(
      join(process.cwd(), "src", "components", "landing", "landing-content.ts"),
      "utf8"
    );
    // Positive pin: the wedge phrase must appear at least once in the hero copy
    // so we never accidentally rebrand away from the release-state positioning.
    // v9 — the hero subhead was tightened to singular "spreadsheet" but the
    // file's header comment still carries the plural reference, and the
    // Capabilities subhead carries "spreadsheet" wedge. The pin allows
    // either form.
    expect(content).toMatch(/contract tracking spreadsheet/i);
  });

  it("home page renders all spec-mandated section titles (release-state compliance)", () => {
    const content = readFileSync(
      join(process.cwd(), "src", "components", "landing", "landing-content.ts"),
      "utf8"
    );
    // v10 — Problem / Outcomes / Best-Fit / Pricing CTA section titles all
    // present per release-state spec §Home Page (restored after v9 subtraction
    // violated the spec).
    expect(content).toContain("Your contracts are signed. The follow-up is scattered.");
    expect(content).toContain("Know what needs attention before it becomes a problem");
    expect(content).toContain("Built for teams outgrowing contract spreadsheets");
    expect(content).toContain("Start by replacing the spreadsheet");
  });

  it("home page wires the spec-mandated section components (v10 restoration)", () => {
    const page = readFileSync(
      join(process.cwd(), "src", "components", "landing", "landing-page.tsx"),
      "utf8"
    );
    // v10 — spec-mandated sections restored (release-state §Home Page).
    expect(page).toContain("<ProblemSection />");
    expect(page).toContain("<OutcomesSection />");
    expect(page).toContain("<BestFitSection />");
    expect(page).toContain("<PricingCtaSection />");
    // v9 deletions still removed (these sections were not in the spec):
    expect(page).not.toContain("<DataFlowDiagram");
    expect(page).not.toContain("<ActivityFeedSection");
    expect(page).not.toContain("<HeroStatsStrip");
    // Pre-v9 dropped surfaces (still must not regress):
    expect(page).not.toContain("<MarqueeStrip />");
    expect(page).not.toContain("<PullQuoteSection />");
  });

  // v9 landing-page polish pass — section subtraction + hero 2-col + middle-dot purge.
  it("home page reflects the v9 maximal subtraction pass", () => {
    const page = readFileSync(
      join(process.cwd(), "src", "components", "landing", "landing-page.tsx"),
      "utf8"
    );
    // Hero 2-col layout at lg+.
    expect(page).toContain("lg:grid-cols-[1.1fr_0.9fr]");
    // product-cta-halo on hero primary CTA.
    expect(page).toContain("product-cta-halo");
    // v10 — Pricing CTA section uses the spec-mandated message (replaces the
    // v9 ad-hoc mid-page CTA strip).
    expect(page).not.toContain("Start replacing the spreadsheet today.");
    // Closing CTA tertiary security link.
    expect(page).toContain("Security overview");
    // Sub-nav updated: "Compare" + "Honest answers" + no "Use cases" or "Security".
    expect(page).toContain('href="#compare"');
    expect(page).toContain('href="#objections"');
    expect(page).not.toContain('href="#use-cases"');
    expect(page).not.toContain('href="#trust"');
    // Floating chip annotations dropped from hero mock.
    expect(page).not.toContain("Renewal pipeline");
    expect(page).not.toContain("AI fields · source-backed");
    // LIVE badge dropped from hero mock.
    expect(page).not.toMatch(/Live<\/span>\s*<\/span>\s*<\/div>/);
    // Middle-dot disclaimer purged from CompareCol.
    expect(page).not.toContain("No credit card · email + password · workspace in minutes");
  });

  // v9 — riskReducerLine uses em-dash, not middle dot.
  it("landing-content riskReducerLine uses em-dash", () => {
    const content = readFileSync(
      join(process.cwd(), "src", "components", "landing", "landing-content.ts"),
      "utf8"
    );
    expect(content).toContain("21-day free trial — no credit card required.");
    expect(content).not.toContain("21-day free trial · No credit card required");
  });

  // v9 — Trust chip badges relocated to footer.
  it("footer renders the trust chip badges", () => {
    const footer = readFileSync(
      join(process.cwd(), "src", "components", "landing", "marketing-site-chrome.tsx"),
      "utf8"
    );
    expect(footer).toContain("trustChipBadges");
  });

  it("legal links footer includes Acceptable use", () => {
    const links = readFileSync(
      join(process.cwd(), "src", "components", "layout", "legal-links.tsx"),
      "utf8"
    );
    expect(links).toContain("/acceptable-use");
  });

  // release-state: custom plan copy names the contact path for larger-team
  // operations without presenting it as the Core self-serve product.
  it("pricing page custom-plans copy includes release-state contact language", () => {
    const raw = readFileSync(
      join(process.cwd(), "src", "app", "(marketing)", "pricing", "page.tsx"),
      "utf8"
    );
    expect(raw).toContain("Need portfolio operations, controls, or assurance workflows?");
  });

  // release-state: contact form routes selected prospects into the private
  // assurance-workflow conversation without exposing it as self-serve Core.
  it("contact form interested-in options include assurance workflows", () => {
    const raw = readFileSync(
      join(process.cwd(), "src", "components", "landing", "contact-form.tsx"),
      "utf8"
    );
    expect(raw).toContain("Assurance workflows");
  });

  // v4: security page must reflect spec hero + drop "contract execution".
  it("security page uses spec-aligned hero language without banned phrases", () => {
    const raw = readFileSync(
      join(process.cwd(), "src", "app", "(marketing)", "security", "page.tsx"),
      "utf8"
    );
    expect(raw).not.toContain("contract execution");
    expect(raw).not.toContain("Operational overview");
    expect(raw).not.toMatch(/Trust\s*&\s*operations/i);
  });

  // v5: product page visual structure pins.
  it("product page wires the v5 visual structure (anchor nav, timeline rail, phases, mocks)", () => {
    const raw = readFileSync(
      join(process.cwd(), "src", "app", "(marketing)", "product", "page.tsx"),
      "utf8"
    );
    // Anchor nav + mobile CTA + mocks imports
    expect(raw).toContain('from "@/components/landing/product-anchor-nav"');
    expect(raw).toContain('from "@/components/landing/product-mocks"');
    expect(raw).toContain('from "@/components/landing/product-mobile-cta"');
    expect(raw).toContain('from "@/components/landing/product-sections-data"');
    // Three phase headers
    expect(raw).toContain("PHASES[0]");
    expect(raw).toContain("PHASES[1]");
    expect(raw).toContain("PHASES[2]");
    // Timeline rail decoration class
    expect(raw).toContain("product-timeline-rail");
    // Hero gradient text (scroll cue removed in v7 polish — small plain text caps anti-pattern)
    expect(raw).toContain("product-hero-h1-grad");
    // Mock components actually rendered between sections
    expect(raw).toContain("<ReviewFieldsPreview");
    expect(raw).toContain("<UpcomingDatesPreview");
    expect(raw).toContain("<WorkQueuePreview");
    // HowTo JSON-LD wiring
    expect(raw).toContain("ProductHowToJsonLd");
  });

  // v7 polish refinement: v6 additive items reversed in the subtraction pass.
  // Verifies what v7 KEEPS and what v7 REMOVED from v6.
  it("product page reflects the v7 polish subtraction pass", () => {
    const raw = readFileSync(
      join(process.cwd(), "src", "app", "(marketing)", "product", "page.tsx"),
      "utf8"
    );
    // KEPT from v6: the 4th milestone, the new report mock, the third action
    // (still present, but demoted to a text link, not a button).
    expect(raw).toContain("Quarter 1");
    expect(raw).toContain("ReportsExportPreview");
    expect(raw).toContain("Or talk to founder");
    expect(raw).toContain("PHASE_DESCRIPTIONS");

    // v7 T27.10 — pull-quote component removed from the page render.
    expect(raw).not.toContain('from "@/components/landing/product-pull-quote"');
    expect(raw).not.toContain("<ProductPullQuote");
    expect(raw).not.toContain('phaseId="setup"');

    // v7 T28.1 — section decoration SVG component removed from the page render.
    expect(raw).not.toContain('from "@/components/landing/product-section-decoration"');
    expect(raw).not.toContain("<ProductSectionDecoration");

    // v7 T27.14 — lead-in tag "Oblixa · For contracts" removed.
    expect(raw).not.toContain("Oblixa · For contracts");
    // v7 T27.5 — "End of tour · 7/7" caps line removed.
    expect(raw).not.toContain("End of tour");

    // v7 T28.7 — phase-tone columns removed.
    expect(raw).not.toContain("product-phase-column-left");
    expect(raw).not.toContain("product-phase-column-right");
    // v7 T28.8 — aurora bar removed.
    expect(raw).not.toContain("product-aurora-bar");

    // v7 T28.5 — "Try this in your trial" inline CTAs removed.
    expect(raw).not.toContain("Try this in your trial");

    // v7 accent gradient hairline kept.
    expect(raw).toContain("product-top-hairline");
  });

  // v6 T26.2: section titles render as h3 (nested inside the phase h2)
  it("product page section titles render as h3 (h2 reserved for phase headers)", () => {
    const raw = readFileSync(
      join(process.cwd(), "src", "app", "(marketing)", "product", "page.tsx"),
      "utf8"
    );
    // SectionCard uses <h3> for section title (T26.2 hierarchy fix)
    expect(raw).toMatch(/<h3\b[^>]*id=\{headingId\}/);
  });

  // v7 polish: sections data shape after v7 subtraction.
  // - microStat retained (only inline pill left)
  // - decoration retained in shape only (no longer rendered)
  // - contextStrip + PHASE_PULL_QUOTES REMOVED
  it("product sections data shape reflects the v7 subtraction", () => {
    const raw = readFileSync(
      join(process.cwd(), "src", "components", "landing", "product-sections-data.ts"),
      "utf8"
    );
    // Retained
    expect(raw).toContain("decoration:");
    expect(raw).toContain("microStat:");
    expect(raw).toContain("PHASE_DESCRIPTIONS");
    // Removed in v7
    expect(raw).not.toMatch(/^\s*contextStrip:/m);
    expect(raw).not.toContain("PHASE_PULL_QUOTES");
  });

  // v8: pricing page polish — middle-dot purge + INCLUDED dedup + FAQ grouping
  // + deep-link anchors + closing CTA parity + tax disclaimer.
  it("pricing page reflects the v8 subtraction + parity pass", () => {
    const raw = readFileSync(
      join(process.cwd(), "src", "app", "(marketing)", "pricing", "page.tsx"),
      "utf8"
    );
    // NEGATIVE pins — the six v8-removed middle-dot caps strings should not regress.
    expect(raw).not.toContain("Billed annually  ·  Or $299 monthly");
    expect(raw).not.toContain("Trial includes · 21 days · 25 contracts");
    expect(raw).not.toContain("21-day free trial · No credit card required");
    expect(raw).not.toContain("Available for the first 25 customers · Then standard pricing");
    expect(raw).not.toContain("Done in 60 days · Includes 3 setup sessions");
    expect(raw).not.toContain("500+ contracts · 10+ team members · Custom integrations or SSO");

    // INCLUDED-doubling fix — the category formerly named "Included" was renamed.
    expect(raw).toContain('heading: "Team & support"');
    expect(raw).not.toContain('heading: "Included"');

    // v10: Guided Pilot eyebrow dropped entirely — the warm-toned card chrome
    // + medallion + h2 + warm "Credited to Core" chip carry the offer identity.
    // The "Hands-on setup" eyebrow from v8 is no longer present.
    expect(raw).not.toContain("Want help setting up?");
    expect(raw).not.toContain("Hands-on setup");

    // POSITIVE pins — v8 additions / parity items.
    expect(raw).toContain("product-cta-halo"); // primary CTAs match /product
    expect(raw).toContain("product-top-hairline"); // top accent gradient hairline
    expect(raw).toContain("max-w-7xl"); // page width parity with /product
    expect(raw).toContain("id=\"founding-customer\"");
    expect(raw).toContain("id=\"guided-pilot\"");
    expect(raw).toContain("id=\"custom-plans\"");
    expect(raw).toContain("faq-trial-card");
    expect(raw).toContain("faq-trial-limits");
    // Closing CTA parity with /product.
    expect(raw).toContain("landing-corner-ring");
    expect(raw).toContain("Ready to start");
    // Tax / currency disclaimer footnote — restructured from prose to a 3-cell
    // CSS-divided strip. Each fact appears as its own pill rather than a sentence.
    expect(raw).toContain("Excludes taxes");
    expect(raw).toContain("Subject to change");
  });

  // v10: pricing page maximal visual overhaul — chip-pair pricing + sub-nav +
  // tone-coded feature grid + 5-cell trial strip + tone-varied offer cards +
  // FAQ tone-coding + 2-col FAQ + bigger closing CTA + integrated disclaimer.
  it("pricing page reflects the v10 chip-pair + tone-coded overhaul", () => {
    const raw = readFileSync(
      join(process.cwd(), "src", "app", "(marketing)", "pricing", "page.tsx"),
      "utf8"
    );

    // NEGATIVE pins — v10 dropped prose that was previously rendered inline
    // next to the price (now expressed as chips or eyebrow caps).
    expect(raw).not.toContain("Annual billing. $299/month monthly.");
    expect(raw).not.toContain("Save $588 versus the standard annual price.");
    expect(raw).not.toContain("Applied to your first annual plan if you continue.");

    // POSITIVE pins — v10 chip patterns replacing the dropped prose.
    expect(raw).toContain("Save $588"); // Founding savings chip (success tone)
    expect(raw).toContain("Credited to Core"); // Pilot credit chip (warm tone)
    expect(raw).toContain("Oblixa Core"); // Top-band stamp on Core card
    expect(raw).toContain("First year"); // Founding-card sub-cap
    expect(raw).toContain("60-day pilot"); // Pilot sub-cap

    // Hero h1 is meaningfully larger in v10 (text-[5rem] at lg).
    expect(raw).toMatch(/text-\[5rem\]|lg:text-\[5rem\]/);

    // Tone variation — Founding uses warning-ink (amber), Pilot uses accent-warm.
    expect(raw).toContain("var(--warning-ink)");
    expect(raw).toContain("var(--accent-warm");

    // Sub-nav for in-page anchors (Tier 7).
    expect(raw).toContain("#oblixa-core");
    expect(raw).toContain('id="oblixa-core"');
    expect(raw).toContain("scroll-mt-32"); // anchor offset for sticky-header collisions

    // GradientPhrase wedge on hero h1 + closing CTA.
    expect(raw).toContain("GradientPhrase");
    expect(raw).toContain("21-day trial");

    // FAQ tone-coded category labels — at minimum the four group keys exist.
    expect(raw).toContain("faq-trial-card");
    expect(raw).toContain("faq-trial-limits");
    expect(raw).toContain("faq-annual-billing");
    expect(raw).toContain("faq-setup-help");
  });

  // v8: post-implementation middle-dot purge audit.
  // The pricing page MUST NOT contain ANY plain-text middle-dot separators.
  it("pricing page contains zero text middle-dot separators in plain content", () => {
    const raw = readFileSync(
      join(process.cwd(), "src", "app", "(marketing)", "pricing", "page.tsx"),
      "utf8"
    );
    // Match " · " (space + middle-dot + space) in plain-text contexts.
    // The middle-dot character is U+00B7. Other characters (the en/em dash, the
    // .ui-dot-sep helper) are not what's banned — this catches the lazy caps-token
    // separator pattern only.
    expect(raw).not.toMatch(/[A-Za-z0-9$]\s·\s[A-Za-z0-9$]/);
  });

  // v5: product sections data carries tone tokens + phase grouping.
  it("product sections data exposes 7 sections across 3 phases with tone tokens", () => {
    const raw = readFileSync(
      join(process.cwd(), "src", "components", "landing", "product-sections-data.ts"),
      "utf8"
    );
    expect(raw).toContain("PRODUCT_SECTIONS");
    expect(raw).toContain("PHASES");
    expect(raw).toContain("TONE_TOKENS");
    // 7 section ids
    for (const id of ["replace", "upload", "review", "dates", "work", "evidence", "reports"]) {
      expect(raw).toContain(`id: "${id}"`);
    }
    // 3 phase ids
    for (const id of ["setup", "day-to-day", "output"]) {
      expect(raw).toContain(`id: "${id}"`);
    }
    // 4 tone variants
    for (const tone of ["cool", "warm", "amber", "success"]) {
      expect(raw).toContain(`"${tone}"`);
    }
  });

  // v9 security page polish pass — phase grouping, closing CTA, legal-at-bottom,
  // structured copy refinement. Pins both negative (removed defects) and
  // positive (new structural elements) markers.
  it("security page reflects the v9 phase + closing-CTA refinement", () => {
    const raw = readFileSync(
      join(process.cwd(), "src", "app", "(marketing)", "security", "page.tsx"),
      "utf8"
    );

    // v10 compliance restoration: spec mandates "Keep control of your data" as
    // the data-export H3 AND as the third bullet (per release-state spec
    // §Security Page > Data Export). It now appears twice. The "Track important
    // changes" bullet is also restored per spec.
    {
      const matches = raw.match(/Keep control of your data/g) ?? [];
      expect(matches.length).toBeGreaterThanOrEqual(2);
    }
    expect(raw).toContain('"Track important changes"'); // spec-verbatim audit-history bullet
    expect(raw).not.toContain("21-day free trial · No credit card required"); // middle dot (Tier 0.3)
    // v10 compliance: "MFA where available" is the spec-verbatim Account
    // Security bullet (release-state §Security Page > Account Security). The v9
    // "hedge phrasing" critique was overridden by spec compliance.
    expect(raw).toContain('"MFA where available"');
    expect(raw).not.toContain("MessagesSquare"); // dropped icon (Tier 7.2 / 21.1)
    expect(raw).not.toContain("Security practices for Oblixa:"); // old verbose meta (Tier 1.8)

    // Phase grouping wired.
    expect(raw).toContain("PHASES");
    expect(raw).toContain('id: "access"');
    expect(raw).toContain('id: "data"');
    expect(raw).toContain('id: "transport"');
    expect(raw).toContain('id: "contact"');
    expect(raw).toContain("Access & accountability");
    expect(raw).toContain("Data handling");
    expect(raw).toContain("Transport & isolation");
    expect(raw).toContain("Account & contact");

    // Constants for DRY.
    expect(raw).toContain("SECURITY_EMAIL");
    expect(raw).toContain("SECURITY_MAILTO");
    expect(raw).toContain("LAST_REVIEWED_ISO");

    // Cross-page chrome parity.
    expect(raw).toContain("product-cta-halo");
    expect(raw).toContain("product-top-hairline");
    expect(raw).toContain("landing-corner-ring");
    expect(raw).toContain("landing-card-premium");
    expect(raw).toContain("max-w-7xl");

    // Closing CTA copy + eyebrow pattern.
    // Note: ShieldAlert medallion was dropped in the refinement pass because
    // it competed with the centered eyebrow dot. The closing CTA now uses the
    // /pricing pattern: dot + caps eyebrow + h2, no medallion above.
    expect(raw).not.toContain("ShieldAlert");
    expect(raw).toContain("Report a vulnerability");
    expect(raw).toContain("Reach the security team");
    expect(raw).toContain("Acknowledged within 1 business day");

    // Prose-to-bullet conversion in transport/isolation/integrations.
    expect(raw).toContain("Browser traffic over HTTPS in production");
    expect(raw).toContain("Authorization enforced server-side, not in the UI");
    expect(raw).toContain("Service accounts for automation, not user credentials");
    // Multi-column phase grid at lg+.
    expect(raw).toContain("lg:grid-cols-2");

    // Trust-card rewrite (Tier 1.9).
    expect(raw).toContain("No public issue trackers");

    // v10 compliance: refined section copy reverted to spec-verbatim per
    // release-state §Security Page (audit history, account security, data
    // export bullets).
    expect(raw).not.toContain("Who changed what, when"); // v9 paraphrase, dropped
    expect(raw).not.toContain("Field-level edit trail"); // v9 paraphrase, dropped
    expect(raw).not.toContain("Surfaced on each contract record"); // v9 paraphrase, dropped
    expect(raw).not.toContain("Multi-factor authentication"); // v9 paraphrase, dropped
    expect(raw).not.toContain("CSV format on demand, every plan"); // v9 paraphrase, dropped
    expect(raw).toContain("See who changed key records"); // spec-verbatim
    expect(raw).toContain("Review contract activity"); // spec-verbatim
    expect(raw).toContain("What we don't store");
    expect(raw).toContain("Exclusions");

    // Back-to-top affordance.
    expect(raw).toContain("Back to top");

    // Meta footer strip cells.
    expect(raw).toContain("Maintained by security team");
    expect(raw).toContain("DPA available on request");
  });

  // v9: LAST_REVIEWED_ISO must be a valid ISO date so the rendered footer
  // microcopy doesn't ship a garbage date.
  it("security page LAST_REVIEWED_ISO is a valid ISO date", () => {
    const raw = readFileSync(
      join(process.cwd(), "src", "app", "(marketing)", "security", "page.tsx"),
      "utf8"
    );
    const match = raw.match(/LAST_REVIEWED_ISO\s*=\s*"(\d{4}-\d{2}-\d{2})"/);
    expect(match).toBeTruthy();
    if (match) {
      const iso = match[1];
      const d = new Date(`${iso}T00:00:00Z`);
      expect(Number.isNaN(d.getTime())).toBe(false);
      expect(d.toISOString().slice(0, 10)).toBe(iso);
    }
  });

  // v9: zero middle-dot caps separators on the security page.
  it("security page contains zero text middle-dot separators in plain content", () => {
    const raw = readFileSync(
      join(process.cwd(), "src", "app", "(marketing)", "security", "page.tsx"),
      "utf8"
    );
    expect(raw).not.toMatch(/[A-Za-z0-9$]\s·\s[A-Za-z0-9$]/);
  });

  // v9: security@oblixa.com appears at least twice (DPA + closing CTA + footer
  // references) but is not duplicated 20× — the SECURITY_EMAIL const is the
  // single source of truth.
  it("security page references security@oblixa.com via the constant, not scattered literals", () => {
    const raw = readFileSync(
      join(process.cwd(), "src", "app", "(marketing)", "security", "page.tsx"),
      "utf8"
    );
    // The literal address appears in the SECURITY_EMAIL declaration once.
    // Other usages should reference the const, not re-type the address.
    const literalMatches = raw.match(/security@oblixa\.com/g) ?? [];
    expect(literalMatches.length).toBeGreaterThanOrEqual(1);
    expect(literalMatches.length).toBeLessThanOrEqual(3);
    // SECURITY_EMAIL identifier should appear multiple times (declaration +
    // each usage).
    const constMatches = raw.match(/SECURITY_EMAIL/g) ?? [];
    expect(constMatches.length).toBeGreaterThanOrEqual(3);
  });

  // v9 contact page polish pass — registration purge, cross-page chrome parity,
  // 3-card row restructure, form refinements, skeleton fallback.
  it("contact page reflects the v9 visual pass", () => {
    const raw = readFileSync(
      join(process.cwd(), "src", "app", "(marketing)", "contact", "page.tsx"),
      "utf8"
    );

    // Release-state secondary CTA.
    expect(raw).toContain("Start free trial");
    expect(raw).toContain('href="/signup"');
    expect(raw).not.toContain("21-day free trial"); // no trial mentions

    // Cross-page chrome parity (Tier 2).
    expect(raw).toContain("max-w-7xl");
    expect(raw).toContain("product-top-hairline");
    expect(raw).toContain("landing-corner-ring");
    expect(raw).toContain("landing-card-premium");

    // Hero microstat strip — "Secure form" cell dropped per user feedback
    // (defensive disclaimers about message use + form security read as
    // trust-lowering rather than trust-raising).
    expect(raw).toContain("1-day reply");
    expect(raw).toContain("No marketing list");
    expect(raw).not.toContain("Secure form");

    // 3-card row restructure (Tier 7).
    expect(raw).toContain('href: "/pricing"');
    expect(raw).toContain('href: "/security"');
    expect(raw).toContain('href: "/product"'); // new Product tour card
    expect(raw).toContain("Browse Oblixa"); // section header
    expect(raw).toContain("See how it works"); // Product card title

    // Tone-coded card system.
    expect(raw).toContain("TONE_COLOR");
    expect(raw).toContain("BarChart3"); // Pricing icon
    expect(raw).toContain("ShieldCheck"); // Security icon
    expect(raw).toContain("Compass"); // Product icon

    // Hero subhead generalization (Tier 1.1).
    expect(raw).toContain("Tell us what you");
    expect(raw).toContain("re trying to solve");

    // No middle-dot separators in plain content.
    expect(raw).not.toMatch(/[A-Za-z0-9$]\s·\s[A-Za-z0-9$]/);
  });

  // v9 contact-form polish pass.
  it("contact form reflects the v9 visual pass", () => {
    const raw = readFileSync(
      join(process.cwd(), "src", "components", "landing", "contact-form.tsx"),
      "utf8"
    );

    // Registration purge in the form.
    expect(raw).not.toContain('"Core (self-serve trial)"'); // Tier 0.6
    expect(raw).not.toContain("Or start free trial"); // Tier 0.2
    expect(raw).not.toContain('href="/signup"'); // Tier 0.5
    expect(raw).not.toContain("21-day free trial"); // Tier 0.3
    expect(raw).not.toContain("Start the free trial"); // Tier 0.4

    // New option label + new General inquiry option (Tier 0.6, 8.2).
    expect(raw).toContain('"Core plan"');
    expect(raw).toContain('"General inquiry"');

    // Prefills extended to larger_team and custom (Tier 8.3).
    expect(raw).toContain("Need a larger plan than Core");
    expect(raw).toContain("Custom workflows or SSO");

    // FieldGroup tone-coding restored after user clarified "color was not the
    // issue" — the ugliness was undersized typography. Section headings are
    // now larger (17/19px) tone-colored. Hints stay dropped.
    expect(raw).toContain('tone="cool"');
    expect(raw).toContain('tone="warm"');
    expect(raw).toContain('tone="success"');
    expect(raw).not.toContain("Helps us recommend a plan size");
    expect(raw).not.toContain("What we'll focus on in our reply");

    // Native <select> replaced with custom button + listbox to escape OS-style
    // dropdown chrome on open.
    expect(raw).toContain("CustomSelect");
    expect(raw).toContain('aria-haspopup="listbox"');
    expect(raw).toContain('role="listbox"');

    // Form accessibility (Tier 5.7, 9.2). The consent-prose line and the
    // matching aria-describedby were dropped per user feedback ("Delete the
    // small section about the use of messages"). Browser-level `required` +
    // `aria-required="true"` still handle field-level a11y.
    expect(raw).toContain("aria-busy={submitting}");
    expect(raw).not.toContain('aria-describedby="contact-consent"');
    expect(raw).toContain('aria-required="true"');

    // Required-field stars dropped: visual `*` indicators competed with the
    // section headings. Browser-level `required` + `aria-required="true"` still
    // present on the underlying inputs for accessibility + validation.
    expect(raw).not.toContain("ui-label-required");

    // Role field autoComplete (Tier 9.5).
    expect(raw).toContain('autoComplete="organization-title"');
    expect(raw).toContain("e.g. COO, legal ops, founder"); // tightened placeholder

    // Textarea resize constraint (Tier 9.6).
    expect(raw).toContain("resize-y");

    // Fieldset disable wrapping (Tier 5.8).
    expect(raw).toContain("disabled={submitting}");

    // Submit button arrow + mobile full-width (Tier 5.1, 5.6). product-cta-halo
    // dropped in v2 Tier 2.4 since the surrounding form card already carries
    // landing-card-premium + landing-corner-ring chrome.
    expect(raw).not.toContain("product-cta-halo");
    expect(raw).toContain("ArrowRight");
    expect(raw).toContain("w-full");
    expect(raw).toContain("sm:w-auto");
    // v2 — min-w on submit button prevents loading-state width collapse;
    // justify-end on submit row right-aligns the button on desktop.
    expect(raw).toContain("min-w-[180px]");
    expect(raw).toContain("justify-end");

    // Loading spinner with reduced-motion guard (Tier 11.1, 11.5).
    expect(raw).toContain("Loader2");
    expect(raw).toContain("animate-spin motion-reduce:animate-none");

    // Error state upgrade to inline card (Tier 11.3).
    expect(raw).toContain("AlertTriangle");

    // Skeleton fallback (Tier 11.4, 11.5).
    expect(raw).toContain("ContactFormSkeleton");
    expect(raw).toContain("animate-pulse motion-reduce:animate-none");

    // Submitted state has medallion + landing-card-premium chrome (Tier 6.5, 6.8).
    expect(raw).toContain("SubmittedState");
    expect(raw).toContain("landing-card-premium");
    expect(raw).toContain("CheckCircle2");

    // Submitted-state replacement bullet links to /security and /pricing
    // (replacing dropped trial bullet — Tier 0.4, 6.3).
    expect(raw).toContain("review the security practices");
    expect(raw).toContain("revisit pricing");

    // v2 — submitted-state "Message received." promoted to focused h2; ref + scroll-into-view
    // on success keeps keyboard users oriented.
    expect(raw).toContain('id="contact-success-h"');
    expect(raw).toContain("headingRef");
    expect(raw).toContain("contact-success-medallion"); // entrance animation
    // v2 — error scroll-into-view useEffect on submit failure.
    expect(raw).toContain('[role="alert"]');
    // v2 — duplicate "We respond within 1 business day." line in form footer dropped.
    expect(raw).not.toContain("We respond within 1 business day.");
  });

  // v9 v2 — globals.css must define --accent-warm (not just consume it via the
  // fallback). The fallback silently collapses warm-tone surfaces back to cool.
  it("--accent-warm token is defined in globals.css", () => {
    const raw = readFileSync(
      join(process.cwd(), "src", "app", "globals.css"),
      "utf8"
    );
    // At least one --accent-warm: declaration must appear (light or dark mode).
    expect(raw).toMatch(/--accent-warm:\s*oklch/);
    // Defined for both light and dark mode — look for two distinct declarations.
    const matches = raw.match(/--accent-warm:\s*oklch[^;]+;/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  // v9 honeypot regression pin.
  it("contact form retains the honeypot input", () => {
    const raw = readFileSync(
      join(process.cwd(), "src", "components", "landing", "contact-form.tsx"),
      "utf8"
    );
    expect(raw).toContain('name="website"');
    expect(raw).toContain("tabIndex={-1}");
    expect(raw).toContain('aria-hidden');
  });

  // v4: compliance-claim guardrail (spec line 767 — do not claim certifications
  // unless they are complete). If you need to claim one, add an allowlist entry
  // here AND commit a sibling proof artifact link (attestation PDF, registry URL).
  it("security page does not claim certifications without proof", () => {
    const raw = readFileSync(
      join(process.cwd(), "src", "app", "(marketing)", "security", "page.tsx"),
      "utf8"
    );
    const claims = [
      /\bSOC ?2\b/,
      /\bHIPAA compliant\b/i,
      /\bISO ?27001\b/,
      /\bPCI ?DSS\b/,
      /\bGDPR certified\b/i,
      /\bFedRAMP\b/,
    ];
    for (const re of claims) {
      expect(
        raw,
        `Security page contains an unsubstantiated certification claim matching ${re}. Add a proof artifact link and update this test's allowlist before shipping.`
      ).not.toMatch(re);
    }
  });
});
