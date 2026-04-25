import { describe, expect, it } from "vitest";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import {
  getCmdkSearchJumpItems,
  hrefV9SevenNotificationClass,
  V9_SEVEN_NOTIFICATION_CLASS_KEYS,
} from "@/lib/product-surface/cmdk-search-jumps";
import { resolveCollaborationInternalNotificationHref } from "@/lib/notification-internal-deeplink";

const noFlags = {} as Record<FeatureFlagKey, boolean>;

function coreSurface(): NavSurfaceInput {
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

describe("V9 §18.3 notification deep-link matrix", () => {
  it("maps all seven §18.2 classes to same-origin Core paths", () => {
    for (const key of V9_SEVEN_NOTIFICATION_CLASS_KEYS) {
      const href = hrefV9SevenNotificationClass(key);
      expect(href.startsWith("/"), key).toBe(true);
      expect(href.includes("://"), key).toBe(false);
    }
  });

  it("keeps CmdK jump hrefs aligned for registry-backed notification classes", () => {
    const items = getCmdkSearchJumpItems(coreSurface(), "");
    const hrefByJumpId = new Map(items.map((i) => [i.id, i.href]));
    expect(hrefV9SevenNotificationClass("due_work")).toBe(hrefByJumpId.get("search-jump:tasks"));
    expect(hrefV9SevenNotificationClass("pending_approvals")).toBe(hrefByJumpId.get("search-jump:approvals"));
    expect(hrefV9SevenNotificationClass("renewal_horizon")).toBe(hrefByJumpId.get("search-jump:renewals"));
    expect(hrefV9SevenNotificationClass("evidence_request")).toBe(hrefByJumpId.get("search-jump:evidence"));
    expect(hrefV9SevenNotificationClass("exception_assignment")).toBe(hrefByJumpId.get("search-jump:exceptions"));
  });

  it("keeps explicit overdue-work and review-backlog links pinned to their stable queues", () => {
    expect(hrefV9SevenNotificationClass("overdue_work")).toBe("/work?lens=overdue");
    expect(hrefV9SevenNotificationClass("review_backlog")).toBe("/contracts/review");
  });

  it("resolves internal inbox rows to stable fallbacks when entity targets are unknown", () => {
    const empty = new Map<string, string>();
    expect(
      resolveCollaborationInternalNotificationHref({
        notification_type: "approval_requested",
        entity_type: "contract_approval",
        entity_id: null,
        contractIdByApprovalId: empty,
        contractIdByCommentId: empty,
      })
    ).toBe("/work#approvals");
    expect(
      resolveCollaborationInternalNotificationHref({
        notification_type: "mention",
        entity_type: "field_comment",
        entity_id: "00000000-0000-4000-8000-000000000001",
        contractIdByApprovalId: empty,
        contractIdByCommentId: empty,
      })
    ).toBe("/contracts/collaboration");
    expect(
      resolveCollaborationInternalNotificationHref({
        notification_type: "task_assigned",
        entity_type: null,
        entity_id: null,
        contractIdByApprovalId: empty,
        contractIdByCommentId: empty,
      })
    ).toBe("/work?lens=assigned");
  });

  it("links approvals and mentions to contracts when entity maps are provided", () => {
    const approvals = new Map([["a1", "c1"]]);
    const comments = new Map([["m1", "c2"]]);
    expect(
      resolveCollaborationInternalNotificationHref({
        notification_type: "approval_requested",
        entity_type: "contract_approval",
        entity_id: "a1",
        contractIdByApprovalId: approvals,
        contractIdByCommentId: comments,
      })
    ).toBe("/contracts/c1#renewal-approvals");
    expect(
      resolveCollaborationInternalNotificationHref({
        notification_type: "mention",
        entity_type: "field_comment",
        entity_id: "m1",
        contractIdByApprovalId: approvals,
        contractIdByCommentId: comments,
      })
    ).toBe("/contracts/c2#field-comments");
    expect(
      resolveCollaborationInternalNotificationHref({
        notification_type: "task_assigned",
        entity_type: null,
        entity_id: "m1",
        contractIdByApprovalId: approvals,
        contractIdByCommentId: comments,
      })
    ).toBe("/contracts/c2#field-comments");
  });
});
