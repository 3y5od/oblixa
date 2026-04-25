import { screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { DownloadButton } from "./download-button";

vi.mock("@/actions/contracts", () => ({
  getFileDownloadUrl: vi.fn().mockResolvedValue({ url: "https://example.test/file" }),
}));

describe("DownloadButton", () => {
  it("requests download URL and triggers anchor click", async () => {
    const createElement = document.createElement.bind(document);
    const click = vi.fn();
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") {
        const a = createElement("a");
        a.click = click;
        return a;
      }
      return createElement(tag);
    });
    const { getFileDownloadUrl } = await import("@/actions/contracts");
    renderWithProviders(<DownloadButton storagePath="path/to/x" fileName="doc.pdf" />);
    const btn = screen.getByTitle(/Download doc\.pdf/i);
    await fireEvent.click(btn);
    expect(getFileDownloadUrl).toHaveBeenCalledWith("path/to/x");
    expect(click).toHaveBeenCalled();
  });
});
