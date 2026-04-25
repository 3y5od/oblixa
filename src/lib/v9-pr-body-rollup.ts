type RenderV9PrBodyRollupInput = {
  summaryBullets?: readonly string[];
  specSectionsTouched?: readonly string[];
  scriptsRunGreen?: readonly string[];
  testAnchorUpdates?: readonly string[];
};

function renderBulletList(items: readonly string[], emptyLine: string): string {
  if (items.length === 0) return `- ${emptyLine}`;
  return items.map((item) => `- ${item}`).join("\n");
}

export function renderV9PrBodyRollup(input: RenderV9PrBodyRollupInput = {}): string {
  const {
    summaryBullets = ["Summarize the user-visible or operator-visible outcome."],
    specSectionsTouched = ["List the implementation references touched in this batch."],
    scriptsRunGreen = ["List the acceptance scripts that ran green."],
    testAnchorUpdates = ["None."],
  } = input;

  return [
    "## Summary",
    renderBulletList(summaryBullets, "Summarize the user-visible or operator-visible outcome."),
    "",
    "## Validation",
    renderBulletList(scriptsRunGreen, "List the acceptance scripts that ran green."),
    "",
    "## Implementation Rollup",
    `- References touched: ${specSectionsTouched.length > 0 ? specSectionsTouched.join(", ") : "List the implementation references touched in this batch."}`,
    `- Test-anchor updates: ${testAnchorUpdates.length > 0 ? testAnchorUpdates.join("; ") : "None."}`,
    "",
  ].join("\n");
}
