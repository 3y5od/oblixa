/** @vitest-environment jsdom */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { SlackRenewalSummaryForm } from "./slack-renewal-summary-form";

describe("SlackRenewalSummaryForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("posts renewal summary details with accessible fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "{}",
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(<SlackRenewalSummaryForm defaultContractId="contract-1" />);

    fireEvent.change(screen.getByLabelText(/outcome/i), {
      target: { value: "approved_to_renew" },
    });
    fireEvent.change(screen.getByLabelText(/optional details/i), {
      target: { value: "Approved with pricing guardrails" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send summary/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/integrations/slack/renewal-summary",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          contractId: "contract-1",
          outcome: "approved_to_renew",
          details: "Approved with pricing guardrails",
        }),
      })
    );
    expect((await screen.findByRole("status")).textContent ?? "").toMatch(/posted to slack/i);
  });
});
