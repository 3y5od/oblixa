#!/usr/bin/env node
function renderBulletList(items, emptyLine) {
  if (items.length === 0) return `- ${emptyLine}`;
  return items.map((item) => `- ${item}`).join("\n");
}

function renderV9PrBodyRollup(input = {}) {
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

function parseListFlag(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((entry) => entry.startsWith(prefix));
  if (!arg) return [];
  return arg
    .slice(prefix.length)
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean);
}

const body = renderV9PrBodyRollup({
  summaryBullets: parseListFlag("summary"),
  specSectionsTouched: parseListFlag("sections"),
  scriptsRunGreen: parseListFlag("scripts"),
  testAnchorUpdates: parseListFlag("anchors"),
});

process.stdout.write(body);
