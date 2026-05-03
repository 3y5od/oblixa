import fs from "node:fs";
import path from "node:path";

/** Generated security markdown lives here (not under docs/). */
export const SECURITY_REPORTS_RELATIVE_DIR = "artifacts/generated/security";

export const SECURITY_REPORT_FILES = {
  routeCoverage: "SECURITY_API_ROUTE_COVERAGE.md",
  apiAuthHeuristics: "SECURITY_API_AUTH_HEURISTICS.md",
  serverActions: "SECURITY_SERVER_ACTIONS_HEURISTICS.md",
  libAdmin: "SECURITY_LIB_ADMIN_CLIENT_INDEX.md",
};

export function securityReportsDir(root) {
  return path.join(root, SECURITY_REPORTS_RELATIVE_DIR);
}

export function ensureSecurityReportsDir(root) {
  const dir = securityReportsDir(root);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function securityReportFilePath(root, fileName) {
  return path.join(securityReportsDir(root), fileName);
}
