/**
 * Appendix D — inventory for scripts/check-*.mjs, scripts/report-*.mjs, and npm test* scripts.
 */
import fs from "node:fs";
import path from "node:path";

function walkAssuranceScripts(scriptsDir, root, acc = []) {
  if (!fs.existsSync(scriptsDir)) return acc;
  for (const name of fs.readdirSync(scriptsDir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = path.join(scriptsDir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkAssuranceScripts(full, root, acc);
    else if (
      name.endsWith(".mjs") &&
      (name.startsWith("check-") || name.startsWith("report-"))
    ) {
      acc.push(path.relative(root, full).replace(/\\/g, "/"));
    }
  }
  return acc;
}

/** @param {string} root — repo root */
export function buildScriptsToEpicMapPayload(root) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const scriptsRoot = path.join(root, "scripts");
  const paths = walkAssuranceScripts(scriptsRoot, root, []).sort();

  const checkScripts = paths
    .filter((p) => p.endsWith(".mjs") && path.basename(p).startsWith("check-"))
    .map((p) => ({ path: p, primaryEpicNumber: null }));
  const reportScripts = paths
    .filter((p) => p.endsWith(".mjs") && path.basename(p).startsWith("report-"))
    .map((p) => ({ path: p, primaryEpicNumber: null }));

  const npmTestScripts = Object.keys(pkg.scripts ?? {})
    .filter((k) => k === "test" || k.startsWith("test:"))
    .sort()
    .map((name) => ({ name, primaryEpicNumber: null }));

  return {
    version: 1,
    program: "maximal-assurance-appendix-d",
    generatedAt: new Date().toISOString(),
    checkScripts,
    reportScripts,
    npmTestScripts,
  };
}
