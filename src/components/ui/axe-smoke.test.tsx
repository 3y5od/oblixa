/** @vitest-environment jsdom */
import { render } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";

describe("component axe smoke", () => {
  it("simple landmark + button has no serious or critical violations", async () => {
    const { container } = render(
      <main>
        <h1>Title</h1>
        <button type="button">Save</button>
      </main>
    );
    const results = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a"] },
    });
    const bad = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(bad).toHaveLength(0);
  });
});
