import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveFeatureMappingForApiPath } from "@/lib/product-surface/surface-mapping";

const API_ROOT = path.resolve(process.cwd(), "src/app/api");
const APP_ROOT = path.resolve(process.cwd(), "src/app");
const SESSION_AUTH_MARKERS = [
  "getApiAuthContext",
  "auth.getUser()",
  "requireV6Context",
  "requireV6ReadContext",
];
const V8_API_GUARD_MARKER = "requireApiWorkspaceEligibility(";

function walkApiRoutes(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkApiRoutes(full, out);
      continue;
    }
    if (name === "route.ts") out.push(full);
  }
  return out;
}

function toApiPath(absFile: string): string {
  const rel = path.relative(APP_ROOT, absFile).split(path.sep).join("/");
  const noSuffix = rel.replace(/\/route\.ts$/, "");
  return `/${noSuffix}`;
}

function isSessionAuthenticatedRouteSource(raw: string): boolean {
  return SESSION_AUTH_MARKERS.some((marker) => raw.includes(marker));
}

describe("v8 api inventory coverage", () => {
  it("maps or exempts session-authenticated and v8-guarded api routes", () => {
    const routes = walkApiRoutes(API_ROOT);
    const unmapped: string[] = [];

    for (const routeFile of routes) {
      const raw = readFileSync(routeFile, "utf8");
      if (!isSessionAuthenticatedRouteSource(raw) && !raw.includes(V8_API_GUARD_MARKER)) continue;
      const apiPath = toApiPath(routeFile);
      const mapping = resolveFeatureMappingForApiPath(apiPath);
      if (mapping.status === "unmapped") unmapped.push(apiPath);
    }

    expect(unmapped).toEqual([]);
  });

  it("classifies representative governed and exempt API families (§12.2)", () => {
    expect(resolveFeatureMappingForApiPath("/api/decisions").status).toBe("mapped");
    expect(resolveFeatureMappingForApiPath("/api/cron/sample").status).toBe("exempt");
    expect(resolveFeatureMappingForApiPath("/api/stripe/webhook").status).toBe("exempt");
    expect(resolveFeatureMappingForApiPath("/api/health").status).toBe("exempt");
  });

  it("documents inbound integration route: mapped to work + automation auth (§17.1 / §12.2)", () => {
    expect(resolveFeatureMappingForApiPath("/api/tasks/from-slack").status).toBe("mapped");
    const raw = readFileSync(
      path.join(process.cwd(), "src/app/api/tasks/from-slack/route.ts"),
      "utf8"
    );
    expect(raw.includes("isInboundAutomationAuthorized")).toBe(true);
  });
});
