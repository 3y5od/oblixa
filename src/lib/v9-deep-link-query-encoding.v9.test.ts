/**
 * V9 §8.5 + §16 + §18.3 — deep links encode query parameters safely and parse back to the same intent.
 */
import { describe, expect, it } from "vitest";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import {
  getCmdkSearchJumpItems,
  hrefV9SevenNotificationClass,
} from "@/lib/product-surface/cmdk-search-jumps";
import { getRenewalNextAction } from "@/lib/renewal-next-action";
import { buildContractsSearchListHref } from "@/lib/contracts-search-url";

const noFlags = {} as Record<FeatureFlagKey, boolean>;

function surface(): NavSurfaceInput {
  return {
    mode: "core",
    role: "viewer",
    featureFlags: noFlags,
    seesAdvancedPrimaryNav: false,
    seesAssuranceNav: false,
    advancedModulesHidden: [],
    assuranceModulesHidden: [],
    utilityModulesHidden: [],
    searchScope: "match_mode",
  };
}

describe("deep link query encoding (V9 §8.5 / §16)", () => {
  it("CmdK contracts search stays parseable through the canonical contracts helper", () => {
    const q = "a & b = c/d";
    const items = getCmdkSearchJumpItems(surface(), q);
    const row = items.find((i) => i.id === "search-jump:contracts");
    expect(row?.href).toBe(buildContractsSearchListHref(q));
    const parsed = new URL(row!.href, "https://app.example");
    expect(parsed.searchParams.get("search")).toBe(q);
  });

  it("notification-class hrefs stay parseable (lens, status, horizon)", () => {
    expect(hrefV9SevenNotificationClass("overdue_work")).toBe("/work?lens=overdue");
    const overdue = new URL(hrefV9SevenNotificationClass("overdue_work"), "https://app.example");
    expect(overdue.searchParams.get("lens")).toBe("overdue");

    const renew = new URL(hrefV9SevenNotificationClass("renewal_horizon"), "https://app.example");
    expect(renew.pathname).toBe("/contracts/renewals");
    expect(renew.searchParams.get("horizon")).toBe("renewal_90");

    const ex = new URL(hrefV9SevenNotificationClass("exception_assignment"), "https://app.example");
    expect(ex.pathname).toBe("/contracts/exceptions");
    expect(ex.searchParams.get("status")).toBe("open");
  });

  it("renewal next-action contract filter preserves UUID in query", () => {
    const id = "550e8400-e29b-41d4-a716-446655440001";
    const next = getRenewalNextAction({
      contractId: id,
      ownerAssigned: true,
      openExceptions: 1,
      outstandingEvidence: 0,
      blocker: null,
    });
    const u = new URL(next.href, "https://app.example");
    expect(u.searchParams.get("contract")).toBe(id);
  });
});
