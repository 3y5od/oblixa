/**
 * product-surface policy §7.1–7.3 — navigation IA contract (Core primary set, Advanced hubs, Assurance children).
 * Fails if NAV_ITEMS drifts without updating the spec or this test.
 */
import { describe, expect, it } from "vitest";
import { NAV_ITEMS, getWorkflowAreaForNavItem } from "@/lib/navigation";

const CORE_PRIMARY_HREFS = [
  "/dashboard",
  "/contracts",
  "/contracts/review",
  "/work",
  "/contracts/renewals",
  "/contracts/exceptions",
  "/contracts/evidence-studio",
  "/reports",
  "/settings",
  "/more",
] as const;

const ADVANCED_PRIMARY_HREFS = ["/decisions", "/campaigns", "/contracts/programs", "/relationship-workspaces"] as const;

/** §7.3 — hrefs under Assurance (order matches spec list). */
const ASSURANCE_CHILD_HREFS = [
  "/assurance/findings",
  "/assurance/control-policies",
  "/assurance/scorecards",
  "/assurance/playbooks",
  "/assurance/review-boards",
  "/assurance/autopilot",
  "/assurance/segments",
  "/assurance/program-evolution",
  "/assurance/health-graph",
] as const;

function primaryByHref(href: string) {
  return NAV_ITEMS.find((i) => i.section === "primary" && i.href === href);
}

describe("refinement §7 navigation", () => {
  it("§7.1 includes every Core primary destination (plus Tools as /more)", () => {
    for (const href of CORE_PRIMARY_HREFS) {
      const item = primaryByHref(href);
      expect(item, `missing primary nav item for ${href}`).toBeTruthy();
    }
  });

  it("§7.2 advanced hubs exist as primary items", () => {
    for (const href of ADVANCED_PRIMARY_HREFS) {
      const item = primaryByHref(href);
      expect(item, `missing advanced primary ${href}`).toBeTruthy();
    }
  });

  it("§7.3 Assurance nav lists all required children in spec order", () => {
    const assurance = primaryByHref("/assurance");
    expect(assurance?.navChildren?.length).toBeGreaterThanOrEqual(ASSURANCE_CHILD_HREFS.length);
    const hrefs = (assurance?.navChildren ?? []).map((c) => c.href.split("?")[0]);
    let cursor = 0;
    for (const required of ASSURANCE_CHILD_HREFS) {
      const idx = hrefs.indexOf(required, cursor);
      expect(idx, `expected ${required} after prior children`).toBeGreaterThanOrEqual(0);
      cursor = idx + 1;
    }
  });

  it("§9.2 Review and Renewals stay primary (not only under Work)", () => {
    expect(primaryByHref("/contracts/review")).toBeTruthy();
    expect(primaryByHref("/contracts/renewals")).toBeTruthy();
  });

  it("§9.1 Work hub includes §7.1 first-class destinations (Renewals, Exceptions, Evidence stay primary)", () => {
    const work = NAV_ITEMS.find((i) => i.name === "Work");
    const childHrefs = new Set((work?.navChildren ?? []).map((c) => c.href.split("?")[0]));
    for (const href of ["/contracts/renewals", "/contracts/exceptions", "/contracts/evidence-studio"] as const) {
      expect(childHrefs.has(href)).toBe(true);
      expect(primaryByHref(href)).toBeTruthy();
    }
  });

  it("classifies Work as a workflow area, not a monitor surface", () => {
    const work = NAV_ITEMS.find((i) => i.href === "/work");
    const dashboard = NAV_ITEMS.find((i) => i.href === "/dashboard");
    const settings = NAV_ITEMS.find((i) => i.href === "/settings");
    expect(work && getWorkflowAreaForNavItem(work)).toBe("workflows");
    expect(dashboard && getWorkflowAreaForNavItem(dashboard)).toBe("monitor");
    expect(settings && getWorkflowAreaForNavItem(settings)).toBe("workspace");
  });
});
