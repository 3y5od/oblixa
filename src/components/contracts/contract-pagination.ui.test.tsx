import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { ContractPagination } from "./contract-pagination";

describe("ContractPagination", () => {
  it("renders navigation links and current page state", () => {
    renderWithProviders(
      <ContractPagination
        total={120}
        page={2}
        pageSize={25}
        basePath="/contracts"
        queryParams={{ status: "active" }}
      />
    );

    expect(screen.getByRole("navigation", { name: /pagination/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Previous" })).toBeTruthy();
    expect(screen.getByText("2 / 5")).toBeTruthy();
  });
});

