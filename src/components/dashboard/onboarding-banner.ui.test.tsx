/** @vitest-environment jsdom */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { completeProductOnboarding } from "@/actions/settings";
import { OnboardingBanner } from "./onboarding-banner";

vi.mock("@/actions/settings", () => ({
  completeProductOnboarding: vi.fn(async () => ({ ok: true })),
}));

describe("OnboardingBanner", () => {
  it("makes workspace calibration the first CTA when setup is still incomplete", () => {
    renderWithProviders(
      <OnboardingBanner
        stats={{
          setupConfigured: false,
          contractCount: 0,
          hasExtractions: false,
          approvedOperationalDates: 0,
          pendingReviewCount: 0,
          ownerAssignedContracts: 0,
          visibleWorkItems: 0,
          renewalAttention: 0,
          dashboardReady: false,
        }}
        setupChecklist={["upload_contract", "review_fields"]}
      />
    );

    const calibrationLink = screen.getByRole("link", { name: /complete workspace calibration/i });
    expect(calibrationLink.getAttribute("href")).toBe("/onboarding/calibration");
    expect(screen.getAllByText(/right operational surfaces/i).length).toBeGreaterThan(0);
  });

  it("shows actionable progress and next-step CTA when onboarding is incomplete", () => {
    renderWithProviders(
      <OnboardingBanner
        stats={{
          setupConfigured: true,
          contractCount: 1,
          hasExtractions: false,
          approvedOperationalDates: 0,
          pendingReviewCount: 2,
          ownerAssignedContracts: 1,
          visibleWorkItems: 0,
          renewalAttention: 0,
          dashboardReady: true,
        }}
        setupChecklist={["upload_contract", "review_fields"]}
      />
    );

    expect(screen.getByText("4/7 complete")).toBeTruthy();
    expect(screen.getByRole("link", { name: /review extracted fields/i })).toBeTruthy();
    expect(screen.getAllByText(/run extraction, then confirm fields with source-backed review/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/1 contract created/i)).toBeTruthy();
    const workLens = screen.getByText("renewals queue").closest("a");
    expect(workLens?.getAttribute("href")).toBe("/contracts/renewals");
  });

  it("does not render once the activation baseline is complete", () => {
    const { container } = renderWithProviders(
      <OnboardingBanner
        stats={{
          setupConfigured: true,
          contractCount: 2,
          hasExtractions: true,
          approvedOperationalDates: 3,
          pendingReviewCount: 0,
          ownerAssignedContracts: 2,
          visibleWorkItems: 4,
          renewalAttention: 2,
          dashboardReady: true,
        }}
        setupChecklist={["upload_contract", "review_fields", "organize_work"]}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("surfaces bulk import progress when a CSV job is still processing (§7.2 + §17.2)", () => {
    renderWithProviders(
      <OnboardingBanner
        stats={{
          setupConfigured: true,
          contractCount: 0,
          hasExtractions: false,
          approvedOperationalDates: 0,
          pendingReviewCount: 0,
          ownerAssignedContracts: 0,
          visibleWorkItems: 0,
          renewalAttention: 0,
          dashboardReady: false,
          importJobProcessing: true,
          importJobCompletedInserts: false,
        }}
        setupChecklist={["upload_contract", "review_fields"]}
      />
    );

    expect(
      screen.getByRole("link", { name: /view import progress/i }).getAttribute("href")
    ).toBe("/contracts/bulk#recent-imports");
    expect(screen.getAllByText(/csv import is still running/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: /bulk import status/i })).toBeTruthy();
  });

  it("softens the banner and focuses the last steps once meaningful progress exists", () => {
    renderWithProviders(
      <OnboardingBanner
        stats={{
          setupConfigured: true,
          contractCount: 2,
          hasExtractions: true,
          approvedOperationalDates: 0,
          pendingReviewCount: 0,
          ownerAssignedContracts: 2,
          visibleWorkItems: 0,
          renewalAttention: 0,
          dashboardReady: true,
        }}
        setupChecklist={["upload_contract", "review_fields"]}
      />
    );

    expect(screen.getByText(/complete the remaining activation steps/i)).toBeTruthy();
    expect(
      screen.getByText(/finish the remaining activation steps so reminders, renewals, and work queues can trust this workspace/i)
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: /approve key operational dates/i })).toBeTruthy();
  });

  it("keeps the review step incomplete while extracted fields still need approval", () => {
    renderWithProviders(
      <OnboardingBanner
        stats={{
          setupConfigured: true,
          contractCount: 2,
          hasExtractions: true,
          approvedOperationalDates: 0,
          pendingReviewCount: 1,
          ownerAssignedContracts: 2,
          visibleWorkItems: 0,
          renewalAttention: 0,
          dashboardReady: true,
        }}
        setupChecklist={["upload_contract", "review_fields"]}
      />
    );

    expect(screen.getByText("4/7 complete")).toBeTruthy();
    expect(screen.getByRole("link", { name: /review extracted fields/i })).toBeTruthy();
    expect(screen.getAllByText(/still need review attention before this step is complete/i).length).toBeGreaterThan(0);
  });

  it("maps dismiss failures to recoverable onboarding copy", async () => {
    vi.mocked(completeProductOnboarding).mockResolvedValueOnce({ error: "Not authenticated" });

    renderWithProviders(
      <OnboardingBanner
        stats={{
          setupConfigured: true,
          contractCount: 1,
          hasExtractions: false,
          approvedOperationalDates: 0,
          pendingReviewCount: 1,
          ownerAssignedContracts: 1,
          visibleWorkItems: 0,
          renewalAttention: 0,
          dashboardReady: false,
        }}
        setupChecklist={["upload_contract", "review_fields"]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /hide for now/i }));

    await waitFor(() => {
      expect(screen.getByText(/session expired/i)).toBeTruthy();
    });
  });
});
