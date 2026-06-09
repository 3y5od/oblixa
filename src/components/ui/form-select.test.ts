import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const src = readFileSync(
  join(process.cwd(), "src/components/ui/form-select.tsx"),
  "utf8",
);

describe("FormSelect", () => {
  it("wires a visible label to the control via aria-labelledby", () => {
    expect(src).toContain("<label");
    expect(src).toContain("id={labelId}");
    expect(src).toContain("ariaLabelledBy={labelId}");
  });

  it("shows a danger border + described error line on error", () => {
    expect(src).toContain("describedById={hasError ? errorId : undefined}");
    expect(src).toContain("DANGER_BORDER");
    expect(src).toContain("--danger");
  });

  it("can reserve the footer height to avoid layout shift", () => {
    expect(src).toContain("min-h-[1.25rem]");
    expect(src).toContain("reserveFooter");
  });

  it("is a full-width compact field, not a filter pill", () => {
    expect(src).toContain('variant="compact"');
    expect(src).toContain('className="w-full"');
    expect(src).not.toContain('variant="pill"');
  });

  it("keeps values in sans (no mono in a form field)", () => {
    expect(src).not.toContain("font-mono");
  });

  it("backs onto the shared UiSelect, not a native select", () => {
    expect(src).toContain("UiSelect");
    expect(src).not.toMatch(/<select[\s>]/);
  });
});
