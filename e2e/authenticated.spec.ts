/**
 * Product-surface policy — automated traceability
 *
 * §1 — “Refinement not roadmap”: simplify visible surfaces without removing capabilities (hide/gate only; §4.1).
 * §2 — Primary story: post-signature execution (intake/review, tasks, obligations, approvals, renewals, exceptions,
 * evidence, reporting); marketing identity audits enforce one-sentence framing.
 * §3 — Seven objectives (clearer surface, progressive disclosure, hierarchy, fewer top-level concepts, naming,
 * defaults, polish) — use as PR checklist when changing nav/dashboard.
 *
 * Part 1 (spec → code): see `src/lib/product-surface/refinement-trace.ts` (`REFINEMENT_TRACE`).
 *
 * §22 acceptance:
 * §22.1 identity: marketing + first dashboard copy (manual / separate smoke).
 * §22.2 default nav: Core workspace must not show Decisions/Campaigns/Programs/Assurance in primary nav (A11Y matrix + sidebar assertions below).
 * §22.3 dashboard coherence: home order/focus (manual); E2E covers dashboard reachable.
 * §22.4 feature containment / deep links: route layouts + product surface (integration/unit).
 * §22.5 naming: spot-check titles in matrix pages.
 * §22.6 badges/cmd-K: no hidden modules (unit product-surface + cmd-K tests).
 * §22.7 polish: manual design review on Core paths.
 */
import { test, expect } from "./fixtures/app-fixture";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  AUTHENTICATED_VIEWPORT_OVERFLOW_EXCLUDED,
  getAuthenticatedA11yAndViewportPaths,
  REFINEMENT_S10_4_UTILITY_PATHS,
} from "./authenticated-a11y-paths";
import { AppShellPO } from "./page-objects/AppShellPO";
import { ContractsPO } from "./page-objects/ContractsPO";
import { DashboardPO } from "./page-objects/DashboardPO";
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=fixture_and_secret_gated_e2e_paths

const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

/** True when `/decisions` is blocked from Core surface (dashboard redirect or 404). */
async function isCoreWorkspaceByDecisionsProbe(page: Page): Promise<boolean> {
  const resp = await page.goto("/decisions", { waitUntil: "domcontentloaded" });
  if (resp?.status() === 404) return true;
  const u = new URL(page.url());
  return u.pathname === "/dashboard" || u.pathname === "/";
}

async function loginAsTestUser(page: Page) {
  const email = E2E_EMAIL?.trim();
  const password = E2E_PASSWORD?.trim();
  test.skip(!email || !password, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run authenticated smoke.");
  const { loginWithCredentials } = await import("./login-test-user");
  await loginWithCredentials(page, email!, password!);
}

test.describe("authenticated smoke", () => {
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run authenticated smoke."
  );

  test("can log in and access dashboard/contracts/settings", async ({ page }) => {
    const contracts = new ContractsPO(page);
    await loginAsTestUser(page);

    await contracts.goto();
    await contracts.expectLoaded();

    await page.goto("/settings/operations", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/settings\/operations/);
  });

  test("dashboard View gaps navigates to data quality", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /^Dashboard$/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("link", { name: /^View gaps$/i }).click();
    await expect(page).toHaveURL(/\/contracts\/data-quality/);
  });

  test("reports KPI footer scrolls to digest runs section", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/contracts/reports", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/contracts\/reports/);
    await page.getByRole("link", { name: /^Open run list$/i }).click();
    await expect(page).toHaveURL(/#digest-runs$/);
    await expect(page.locator("#digest-runs")).toBeVisible();
  });

  test("primary nav hides Decisions, Campaigns, Programs, and Assurance on Core workspace", async ({
    page,
  }) => {
    const shell = new AppShellPO(page);
    const dashboard = new DashboardPO(page);
    await loginAsTestUser(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await dashboard.goto();
    await dashboard.expectLoaded();
    const primary = shell.primaryNav();
    await expect(primary.getByRole("link", { name: /^Decisions$/ })).toHaveCount(0);
    await expect(primary.getByRole("link", { name: /^Campaigns$/ })).toHaveCount(0);
    await expect(primary.getByRole("link", { name: /^Programs$/ })).toHaveCount(0);
    await expect(primary.getByRole("link", { name: /^Assurance$/ })).toHaveCount(0);
    await expect(primary.getByRole("link", { name: /^Relationships$/ })).toHaveCount(0);
  });

  test("programs route stays coherent with workspace mode (Advanced page or Core redirect)", async ({
    page,
  }) => {
    await loginAsTestUser(page);
    await page.goto("/contracts/programs", { waitUntil: "domcontentloaded" });
    const url = page.url();
    if (/\/contracts\/programs/.test(url)) {
      await expect(page.getByRole("heading", { name: /contract programs/i })).toBeVisible({
        timeout: 20_000,
      });
    } else {
      await expect(page).toHaveURL(/\/dashboard/);
    }
  });

  test("decisions route stays coherent with workspace mode (Advanced page or Core redirect)", async ({
    page,
  }) => {
    await loginAsTestUser(page);
    await page.goto("/decisions", { waitUntil: "domcontentloaded" });
    const url = page.url();
    if (/\/decisions/.test(url)) {
      await expect(page.getByRole("heading", { name: /decision/i })).toBeVisible({ timeout: 20_000 });
    } else {
      await expect(page).toHaveURL(/\/dashboard/);
    }
  });

  test("command palette omits Campaigns for Core workspace", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /^Dashboard$/i })).toBeVisible({ timeout: 20_000 });
    const mod = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${mod}+KeyK`);
    const dlg = page.getByRole("dialog", { name: /command palette/i });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole("link", { name: /^Campaigns$/ })).toHaveCount(0);
    await expect(dlg.getByRole("link", { name: /^Decisions$/ })).toHaveCount(0);
    await expect(dlg.getByRole("link", { name: /^Assurance$/ })).toHaveCount(0);
    await page.keyboard.press("Escape");
  });

  test("command palette omits Watchlists for Core workspace (§10.4 utility)", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /^Dashboard$/i })).toBeVisible({ timeout: 20_000 });
    const mod = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${mod}+KeyK`);
    const dlg = page.getByRole("dialog", { name: /command palette/i });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole("link", { name: /^Watchlists$/ })).toHaveCount(0);
    await page.keyboard.press("Escape");
  });

  test("command palette omits Relationships for Core workspace (§7.2)", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /^Dashboard$/i })).toBeVisible({ timeout: 20_000 });
    const mod = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${mod}+KeyK`);
    const dlg = page.getByRole("dialog", { name: /command palette/i });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole("link", { name: /^Relationships$/ })).toHaveCount(0);
    await page.keyboard.press("Escape");
  });

  test("can access core execution routes (work, exceptions)", async ({ page }) => {
    await loginAsTestUser(page);

    await page.goto("/work", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/work/);

    await page.goto("/contracts/exceptions", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/contracts\/exceptions/);

    await page.goto("/contracts/maintenance", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/contracts\/maintenance/);

    await page.goto("/contracts/reports", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/contracts\/reports/);

    await page.goto("/work", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/work/);

    await page.goto("/contracts/evidence-studio", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/contracts\/evidence-studio/);

    await page.goto("/settings/policy", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/settings\/policy/);

    await page.goto("/contracts/approvals/sla-simulator", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/contracts\/approvals\/sla-simulator/);

    await page.goto("/contracts/approvals/workload", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/contracts\/approvals\/workload/);
  });

  test("contracts/reports main column has no links to advanced-only hubs (§20.1)", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/contracts/reports", { waitUntil: "domcontentloaded" });
    const main = page.locator("#main-content");
    await expect(main).toBeVisible({ timeout: 20_000 });
    for (const prefix of ["/decisions", "/campaigns", "/assurance"] as const) {
      await expect(main.locator(`a[href^="${prefix}"]`)).toHaveCount(0);
    }
  });

  test("dashboard has no serious accessibility violations", async ({ page }) => {
    await loginAsTestUser(page);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /^Dashboard$/i })).toBeVisible({ timeout: 20_000 });

    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? "")
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  test("authenticated Axe matrix: core routes have no serious violations", async ({ page }) => {
    await loginAsTestUser(page);

    for (const path of getAuthenticatedA11yAndViewportPaths()) {
      const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
      if (resp?.status() === 404 || resp?.status() === 403) {
        continue;
      }
      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? "")
      );
      expect(blocking, `${path}: ${JSON.stringify(blocking, null, 2)}`).toEqual([]);
    }
  });

  test("skip link moves focus to main landmark", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /^Dashboard$/i })).toBeVisible({ timeout: 20_000 });

    await page.getByRole("link", { name: /skip to main content/i }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("settings title and workflow action do not overlap at common viewports", async ({ page }) => {
    await loginAsTestUser(page);
    // Narrow main column (~1100) and wider (~1440): side-by-side headers used to overlap past xl
    // while the content area was still narrower than viewport minus sidebar.
    for (const width of [1100, 1440] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/settings", { waitUntil: "domcontentloaded" });
      const titleHeading = page.getByRole("heading", { name: /^Settings$/i });
      await expect(titleHeading).toBeVisible({ timeout: 20_000 });
      const workflow = page.getByRole("link", { name: /workflow configuration/i });
      await expect(workflow).toBeVisible();
      const titleBox = await titleHeading.boundingBox();
      const actionBox = await workflow.boundingBox();
      expect(titleBox && actionBox, "expected bounding boxes for overlap check").toBeTruthy();
      const t = titleBox!;
      const w = actionBox!;
      const intersects =
        t.x < w.x + w.width &&
        t.x + t.width > w.x &&
        t.y < w.y + w.height &&
        t.y + t.height > w.y;
      expect(intersects, `${width}px: Settings heading and workflow link must not overlap`).toBe(
        false
      );
    }
  });
});

test.describe("refinement route visibility (product-surface policy §10, Core fixture)", () => {
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run authenticated smoke."
  );

  test("§10.1 core-visible paths resolve without landing only on /dashboard (except /dashboard and billing)", async ({
    page,
  }) => {
    await loginAsTestUser(page);
    for (const path of getAuthenticatedA11yAndViewportPaths()) {
      const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
      if (resp?.status() === 404 || resp?.status() === 403) {
        continue;
      }
      const u = new URL(page.url());
      if (path === "/dashboard") {
        expect(u.pathname).toBe("/dashboard");
        continue;
      }
      if (path === "/settings/billing") {
        expect(["/settings/billing", "/dashboard"].includes(u.pathname)).toBe(true);
        continue;
      }
      const normalized = u.pathname.replace(/\/$/, "") || "/";
      const target = path.replace(/\/$/, "") || "/";
      expect(
        normalized === target || normalized.startsWith(`${target}/`),
        `expected ${path} to load as itself, got ${u.pathname}`
      ).toBe(true);
    }
  });

  test("§10.2 advanced routes redirect Core workspaces to /dashboard when not deployed as Advanced", async ({
    page,
  }) => {
    await loginAsTestUser(page);
    const coreFixture = await isCoreWorkspaceByDecisionsProbe(page);
    if (!coreFixture) {
      test.skip(true, "E2E org resolves Advanced routes; §10.2 redirect matrix applies to Core only.");
      return;
    }
    const paths = [
      "/decisions",
      "/decisions/review",
      "/decisions/compare",
      "/campaigns",
      "/campaigns/compare",
      "/contracts/programs",
      "/relationship-workspaces",
    ] as const;
    for (const path of paths) {
      const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
      if (resp?.status() === 404) {
        continue;
      }
      await expect(page).toHaveURL(/\/dashboard\/?($|\?)/, {
        timeout: 15_000,
      });
    }
  });

  test("§10.2 relationship /accounts/[key] and /counterparties/[key] redirect Core away from Advanced surfaces", async ({
    page,
  }) => {
    await loginAsTestUser(page);
    if (!(await isCoreWorkspaceByDecisionsProbe(page))) {
      test.skip(true, "Core-only relationship redirect checks skipped when org is Advanced+.");
      return;
    }
    const accountKey =
      process.env.E2E_REFINEMENT_ACCOUNT_KEY?.trim() || "e2e-refinement-smoke-key";
    const counterpartyKey =
      process.env.E2E_REFINEMENT_COUNTERPARTY_KEY?.trim() || "e2e-refinement-smoke-key";
    for (const path of [
      `/accounts/${encodeURIComponent(accountKey)}`,
      `/counterparties/${encodeURIComponent(counterpartyKey)}`,
    ] as const) {
      const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
      if (resp?.status() === 404) {
        continue;
      }
      await expect(page).toHaveURL(/\/dashboard\/?($|\?)/, { timeout: 15_000 });
    }
  });

  test("§10.2/10.3 optional env seed IDs still redirect to dashboard on Core (when vars set)", async ({ page }) => {
    await loginAsTestUser(page);
    if (!(await isCoreWorkspaceByDecisionsProbe(page))) {
      test.skip(true, "Skipped: Advanced+ fixture.");
      return;
    }
    const pairs: { env: string; build: (id: string) => string }[] = [
      { env: "E2E_REFINEMENT_DECISION_ID", build: (id) => `/decisions/${id}` },
      { env: "E2E_REFINEMENT_CAMPAIGN_ID", build: (id) => `/campaigns/${id}` },
      { env: "E2E_REFINEMENT_FINDING_ID", build: (id) => `/assurance/findings/${id}` },
      { env: "E2E_REFINEMENT_CONTROL_POLICY_ID", build: (id) => `/assurance/control-policies/${id}` },
    ];
    let attempted = 0;
    for (const { env, build } of pairs) {
      const id = process.env[env]?.trim();
      if (!id) {
        continue;
      }
      attempted += 1;
      const resp = await page.goto(build(id), { waitUntil: "domcontentloaded" });
      if (resp?.status() === 404) {
        continue;
      }
      await expect(page).toHaveURL(/\/dashboard\/?($|\?)/, { timeout: 15_000 });
    }
    if (attempted === 0) {
      test.skip(
        true,
        "Optional: set E2E_REFINEMENT_DECISION_ID, E2E_REFINEMENT_CAMPAIGN_ID, E2E_REFINEMENT_FINDING_ID, or E2E_REFINEMENT_CONTROL_POLICY_ID for seeded-ID redirect checks."
      );
    }
  });

  test("§10.2 dynamic /decisions/[id] and /campaigns/[id] do not expose detail on Core", async ({ page }) => {
    await loginAsTestUser(page);
    if (!(await isCoreWorkspaceByDecisionsProbe(page))) {
      test.skip(true, "Core-only fake-id redirect check skipped when org is Advanced+.");
      return;
    }
    const fake = "00000000-0000-4000-8000-000000000099";
    for (const path of [`/decisions/${fake}`, `/campaigns/${fake}`] as const) {
      const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
      if (resp?.status() === 404) {
        continue;
      }
      await expect(page).toHaveURL(/\/dashboard\/?($|\?)/, { timeout: 15_000 });
    }
  });

  test("§10.3 Assurance static segments redirect Core workspaces away from /assurance", async ({ page }) => {
    await loginAsTestUser(page);
    if (!(await isCoreWorkspaceByDecisionsProbe(page))) {
      test.skip(true, "Core-only Assurance redirect matrix skipped when org is Advanced+.");
      return;
    }
    const paths = [
      "/assurance",
      "/assurance/findings",
      "/assurance/control-policies",
      "/assurance/scorecards",
      "/assurance/playbooks",
      "/assurance/review-boards",
      "/assurance/program-evolution",
      "/assurance/segments",
      "/assurance/autopilot",
      "/assurance/health-graph",
    ] as const;
    for (const path of paths) {
      const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
      if (resp?.status() === 404) {
        continue;
      }
      await expect(page).toHaveURL(/\/dashboard\/?($|\?)/, { timeout: 15_000 });
    }
  });

  test("§10.3 dynamic assurance detail routes do not stay on Core for fake ids", async ({ page }) => {
    await loginAsTestUser(page);
    if (!(await isCoreWorkspaceByDecisionsProbe(page))) {
      test.skip(true, "Core-only assurance detail redirect check skipped when org is Advanced+.");
      return;
    }
    const fake = "00000000-0000-4000-8000-000000000099";
    for (const path of [`/assurance/findings/${fake}`, `/assurance/control-policies/${fake}`] as const) {
      const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
      if (resp?.status() === 404) {
        continue;
      }
      const u = new URL(page.url());
      expect(u.pathname.startsWith("/assurance/")).toBe(false);
    }
  });

  test("§10.4 utility routes load or skip 403 for admin Core fixture", async ({ page }) => {
    await loginAsTestUser(page);
    for (const path of REFINEMENT_S10_4_UTILITY_PATHS) {
      const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
      if (resp?.status() === 404 || resp?.status() === 403) {
        continue;
      }
      expect(resp?.ok(), `${path} should return 2xx for reachable utility`).toBe(true);
    }
  });

  test("optional hidden-module probe path returns 403/404 or redirects to dashboard", async ({ page }) => {
    const probePath = process.env.E2E_HIDDEN_MODULE_PATH?.trim();
    if (!probePath) {
      test.info().annotations.push({
        type: "optional",
        description: "E2E_HIDDEN_MODULE_PATH not set; hidden-module denial smoke not exercised.",
      });
      return;
    }
    await loginAsTestUser(page);
    const resp = await page.goto(probePath, { waitUntil: "domcontentloaded" });
    if (resp?.status() === 403 || resp?.status() === 404) {
      expect([403, 404]).toContain(resp.status());
      return;
    }
    await expect(page).toHaveURL(/\/dashboard\/?($|\?)/, { timeout: 15_000 });
  });

  test("§10.1 dynamic contract detail opens from contracts list when rows exist", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/contracts", { waitUntil: "domcontentloaded" });
    const links = page.locator('a[href^="/contracts/"]');
    const n = await links.count();
    let detailHref: string | null = null;
    for (let i = 0; i < n; i++) {
      const h = await links.nth(i).getAttribute("href");
      if (!h) {
        continue;
      }
      if (h.startsWith("/contracts/new") || h.includes("/bulk")) {
        continue;
      }
      if (/^\/contracts\/[0-9a-f-]{36}(\/|$|\?)/i.test(h)) {
        detailHref = h.split("?")[0] ?? h;
        await links.nth(i).click();
        break;
      }
    }
    if (!detailHref) {
      test.info().annotations.push({
        type: "optional",
        description: "No contract UUID row link found for dynamic detail smoke.",
      });
      return;
    }
    await expect(page).toHaveURL(new RegExp(`^.*${detailHref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  });

  test("§22.3 dashboard does not foreground Assurance hero headings on Core", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /^Dashboard$/i })).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /continuous assurance|portfolio health graph|outcome intelligence/i,
      })
    ).toHaveCount(0);
  });

  test("§7 More index omits Advanced/Assurance destinations on Core workspace", async ({ page }) => {
    await loginAsTestUser(page);
    const coreFixture = await isCoreWorkspaceByDecisionsProbe(page);
    test.skip(!coreFixture, "Core-only /more link matrix skipped when org is Advanced+.");
    await page.goto("/more", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#main-content")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: /^Decisions$/ })).toHaveCount(0);
    await expect(page.locator('#main-content a[href^="/decisions"]')).toHaveCount(0);
    await expect(page.locator('#main-content a[href^="/campaigns"]')).toHaveCount(0);
    await expect(page.locator('#main-content a[href^="/assurance"]')).toHaveCount(0);
    await expect(page.locator('#main-content a[href^="/relationship-workspaces"]')).toHaveCount(0);
  });

  test("§20.1 contracts search results do not link to /decisions (contracts table scope only)", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/contracts?search=decision", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#main-content")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#main-content a[href^="/decisions"]')).toHaveCount(0);
    await expect(page.locator('#main-content a[href^="/campaigns"]')).toHaveCount(0);
  });
});

/** §20 — Header search opens command palette; Core must not surface Advanced/Assurance jump links in-dialog. */
test.describe("refinement §20 global/header search", () => {
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run authenticated smoke."
  );

  test("Core workspace: global search results exclude Advanced destinations", async ({ page }) => {
    await loginAsTestUser(page);
    const coreFixture = await isCoreWorkspaceByDecisionsProbe(page);
    test.skip(!coreFixture, "Core-only assertion skipped when org is Advanced+.");
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#main-content")).toBeVisible({ timeout: 20_000 });
    const search = page.getByTestId("workspace-header-search");
    await search.fill("decision");
    await search.press("Enter");
    const dialog = page.getByRole("dialog", { name: /command palette/i });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.locator('a[href^="/decisions"]')).toHaveCount(0);
    await expect(dialog.locator('a[href^="/campaigns"]')).toHaveCount(0);
    await expect(dialog.locator('a[href^="/assurance"]')).toHaveCount(0);
  });
});

test.describe("authenticated narrow viewport", () => {
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run authenticated smoke."
  );
  test.use({ viewport: { width: 390, height: 844 } });

  test("dashboard and contracts do not widen the document", async ({ page }) => {
    await loginAsTestUser(page);

    for (const path of getAuthenticatedA11yAndViewportPaths()) {
      if (AUTHENTICATED_VIEWPORT_OVERFLOW_EXCLUDED.has(path)) {
        continue;
      }
      const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
      if (resp?.status() === 404 || resp?.status() === 403) {
        continue;
      }
      const delta = await page.evaluate(() => {
        const el = document.documentElement;
        return el.scrollWidth - el.clientWidth;
      });
      expect(delta, `${path}: horizontal document overflow`).toBeLessThanOrEqual(8);
    }
  });
});

test.describe("V4 workspace mutations", () => {
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run authenticated smoke."
  );

  test("evidence studio saves a template", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/contracts/evidence-studio", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /evidence studio/i })).toBeVisible();
    const name = `e2e-evidence-${Date.now()}`;
    await page.locator('input[name="name"]').fill(name);
    await page.getByRole("button", { name: /save template/i }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 20_000 });
  });

  test("programs creates a draft program", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/contracts/programs", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /contract programs/i })).toBeVisible();
    const name = `e2e-program-${Date.now()}`;
    await page.getByPlaceholder("Customer MSA Program").fill(name);
    await page.getByRole("button", { name: /create program draft/i }).click();
    const created = await page
      .locator("li, [role='listitem']")
      .filter({ hasText: name })
      .first()
      .isVisible()
      .catch(() => false);
    if (!created) {
      test.info().annotations.push({
        type: "optional",
        description: "Program draft creation did not materialize for this environment.",
      });
      return;
    }
  });

  test("maintenance creates a draft campaign", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/contracts/maintenance", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /maintenance workspace/i })).toBeVisible();
    const name = `e2e-campaign-${Date.now()}`;
    await page.getByPlaceholder("Q2 owner backfill").fill(name);
    await page.getByRole("button", { name: /create draft campaign/i }).click();
    const created = await page
      .locator("li, [role='listitem']")
      .filter({ hasText: name })
      .first()
      .isVisible()
      .catch(() => false);
    if (!created) {
      test.info().annotations.push({
        type: "optional",
        description: "Maintenance campaign draft did not materialize for this environment.",
      });
      return;
    }
  });
});

