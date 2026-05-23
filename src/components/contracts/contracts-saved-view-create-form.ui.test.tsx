/** @vitest-environment jsdom */
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { ContractsSavedViewCreateForm } from "./contracts-saved-view-create-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const defaults = {
  search: "",
  status: "",
  owner: "",
  counterparty: "",
  contract_type: "",
  region: "",
  deadline: "",
  sort: "",
  exceptions: "",
  review: "",
  data_quality: "",
  evidence: "",
  work: "",
};

describe("ContractsSavedViewCreateForm", () => {
  it("surfaces the shared not-permitted hint when the user cannot edit", () => {
    renderWithProviders(
      <ContractsSavedViewCreateForm organizationId="org-1" canEdit={false} defaults={defaults} />
    );
    expect(screen.getByText(/your role cannot perform this action/i)).toBeTruthy();
  });

  it("renders the save form when editing is allowed", () => {
    renderWithProviders(
      <ContractsSavedViewCreateForm organizationId="org-1" canEdit defaults={defaults} />
    );
    expect(screen.getByLabelText(/save current view/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^save$/i })).toBeTruthy();
  });
});
