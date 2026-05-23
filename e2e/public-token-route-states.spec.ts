import { test, expect, type Page } from "@playwright/test";
import { applyTheme } from "./fixtures/theme-fixture";
import { ExternalSurfacePO } from "./page-objects/ExternalSurfacePO";

type ExternalActionState = {
  id: string;
  action_type: string;
  status: string;
  expired: boolean;
  requires_passcode: boolean;
  expires_at: string;
  requires_reauth: boolean;
  submitted_at: string | null;
  workflow_chain: unknown[];
  workflow_deadline_iso: string | null;
  workflow_ack_required: boolean;
  correction_message: string | null;
};

const MOCK_STATUS_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "private, no-store",
} as const;

function externalActionState(overrides: Partial<ExternalActionState> = {}): ExternalActionState {
  return {
    id: "00000000-0000-4000-8000-000000000049",
    action_type: "submit_evidence",
    status: "open",
    expired: false,
    requires_passcode: false,
    expires_at: "2099-01-01T00:00:00.000Z",
    requires_reauth: false,
    submitted_at: null,
    workflow_chain: [],
    workflow_deadline_iso: null,
    workflow_ack_required: false,
    correction_message: null,
    ...overrides,
  };
}

async function mockExternalStatus(page: Page, token: string, state: ExternalActionState) {
  await page.route(`**/api/external-actions/${token}/status`, async (route) => {
    await route.fulfill({
      status: 200,
      headers: MOCK_STATUS_HEADERS,
      body: JSON.stringify({ externalAction: state }),
    });
  });
}

function expectPrivateNoStore(headers: Record<string, string>, label: string) {
  const cache = headers["cache-control"] ?? "";
  expect(cache.toLowerCase(), label).toContain("private");
  expect(cache.toLowerCase(), label).toContain("no-store");
}

test.describe("public-token route states", () => {
  test.beforeEach(async ({ page }) => {
    await applyTheme(page, "light");
  });

  test("invalid public token status and submit routes return 4xx with private no-store", async ({ request }) => {
    const token = "00000000-0000-0000-0000-000000000000";
    const statusRes = await request.get(`/api/external-actions/${token}/status`);
    expect(statusRes.status(), "invalid token status route").toBeGreaterThanOrEqual(400);
    expect(statusRes.status(), "invalid token status route").toBeLessThan(500);
    expectPrivateNoStore(statusRes.headers(), "invalid token status route cache policy");

    const submitRes = await request.post(`/api/external-actions/${token}/submit`, {
      headers: { "content-type": "application/json" },
      data: JSON.stringify({ message: "invalid-token probe" }),
    });
    expect(submitRes.status(), "invalid token submit route").toBeGreaterThanOrEqual(400);
    expect(submitRes.status(), "invalid token submit route").toBeLessThan(500);
    expectPrivateNoStore(submitRes.headers(), "invalid token submit route cache policy");
  });

  test("valid public token status renders the open submit form", async ({ page }) => {
    const token = "e2e-valid-public-token-state";
    await mockExternalStatus(page, token, externalActionState());

    await page.goto(`/external/${token}`, { waitUntil: "domcontentloaded" });
    await new ExternalSurfacePO(page).expectOpenFormLoaded(/Action: submit evidence/i);
  });

  test("expired public token status renders the expired state", async ({ page }) => {
    const token = "e2e-expired-public-token-state";
    await mockExternalStatus(
      page,
      token,
      externalActionState({
        status: "expired",
        expired: true,
        expires_at: "2000-01-01T00:00:00.000Z",
      })
    );

    await page.goto(`/external/${token}`, { waitUntil: "domcontentloaded" });
    await new ExternalSurfacePO(page).expectExpiredSurfaceLoaded();
  });
});
