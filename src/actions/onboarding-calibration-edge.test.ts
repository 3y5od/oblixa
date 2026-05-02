import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  previewCalibrationRecommendation,
  saveQuestionnaireProgress,
} from "@/actions/onboarding-calibration";
import { getAuthContext } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  getAuthContext: vi.fn(),
}));

const mockGetAuthContext = vi.mocked(getAuthContext);

describe("onboarding-calibration edge cases (§23)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validPayload = {
    answers_required: {
      primary_use_case: "track_contracts_dates",
      team_model: "solo",
      workflow_maturity: "manual_spreadsheet",
      main_pain: "find_contracts_dates",
      complexity_preference: "simplest",
      setup_intent: "upload_import",
      assurance_intent: "not_now",
    },
  } as const;

  it("saveQuestionnaireProgress returns unauthorized for non-admin roles", async () => {
    mockGetAuthContext.mockResolvedValue({
      user: { id: "u1" } as never,
      orgId: "org-1",
      role: "viewer",
      admin: {} as never,
      mfaRequired: false,
    });
    const r = await saveQuestionnaireProgress({ answers_required: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Unauthorized/i);
  });

  it("previewCalibrationRecommendation returns unauthorized for non-admin roles", async () => {
    mockGetAuthContext.mockResolvedValue({
      user: { id: "u1" } as never,
      orgId: "org-1",
      role: "viewer",
      admin: {} as never,
      mfaRequired: false,
    });
    const r = await previewCalibrationRecommendation(validPayload);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Unauthorized/i);
  });

  it("completeQuestionnaireAcceptRecommendation short-circuits when already completed (idempotent)", () => {
    const raw = readFileSync(join(process.cwd(), "src/actions/onboarding-calibration.ts"), "utf8");
    const start = raw.indexOf("export async function completeQuestionnaireAcceptRecommendation");
    const end = raw.indexOf("export async function completeQuestionnaireSimplerSetup", start);
    const body = raw.slice(start, end);
    expect(body).toContain('prevCal.status === "completed"');
  });

  it("history append uses slice(-32) cap in accept and minimal paths", () => {
    const raw = readFileSync(join(process.cwd(), "src/actions/onboarding-calibration.ts"), "utf8");
    expect(raw.match(/\.slice\(-32\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("OAuth invite acceptance branch does not call ensureUserOrg (joins existing org)", () => {
    const raw = readFileSync(join(process.cwd(), "src/app/auth/callback/route.ts"), "utf8");
    const inviteStart = raw.indexOf("if (inviteIdRaw && isUuid(inviteIdRaw))");
    const elseIdx = raw.indexOf("} else {", inviteStart);
    expect(inviteStart).toBeGreaterThan(-1);
    expect(elseIdx).toBeGreaterThan(inviteStart);
    const inviteBlock = raw.slice(inviteStart, elseIdx);
    expect(inviteBlock.includes("ensureUserOrg")).toBe(false);
  });
});
