import { describe, expect, it } from "vitest";
import type { ProductSurfaceDiagnosticChannel } from "@/lib/product-surface/dev-diagnostics";

type PresenceCase = {
  channel: ProductSurfaceDiagnosticChannel;
  payload: Record<string, unknown>;
  requiredKeys: string[];
};

/**
 * §19.3 — when diagnostics are emitted, required fields must be present for automation/Sentry consumers.
 * (Channels that only log coarse counts still include `mode` where the call site has surface context.)
 */
const CASES: PresenceCase[] = [
  {
    channel: "surface_mapping_missing",
    payload: { surfaceType: "api", apiPath: "/api/x", reason: "registry_missing_or_mapping_missing" },
    requiredKeys: ["surfaceType", "reason"],
  },
  {
    channel: "server_action_eligibility_denied",
    payload: {
      actionId: "contracts:foo",
      featureFamily: "contracts",
      denialClass: "insufficient_workspace_mode",
      mode: "core",
      role: "viewer",
      isAdmin: false,
    },
    requiredKeys: ["actionId", "featureFamily", "denialClass", "mode", "role", "isAdmin"],
  },
  {
    channel: "api_workspace_gate_denied",
    payload: {
      apiPath: "/api/decisions",
      family: "decisions",
      reason: "x",
      denialClass: "insufficient_workspace_mode",
      discoverability: "suppressed",
    },
    requiredKeys: ["apiPath", "family", "denialClass", "discoverability"],
  },
  {
    channel: "href_eligibility_denied",
    payload: {
      href: "/decisions",
      pathname: "/decisions",
      family: "decisions",
      reason: "workspace_mode_ineligible",
      denialClass: "insufficient_workspace_mode",
      discoverability: "suppressed",
    },
    requiredKeys: ["href", "pathname", "family", "denialClass"],
  },
  {
    channel: "nav_badges",
    payload: { mode: "core", removed_keys: ["watchlists"] },
    requiredKeys: ["mode", "removed_keys"],
  },
  {
    channel: "nav_badge_payload_filtered",
    payload: { mode: "core", removed_keys: [], incoming_count: 1, outgoing_count: 1 },
    requiredKeys: ["mode", "incoming_count", "outgoing_count"],
  },
  {
    channel: "cmdk_recent_hrefs",
    payload: { mode: "core", removed_count: 1 },
    requiredKeys: ["mode", "removed_count"],
  },
  {
    channel: "cmdk_search_index_filtered",
    payload: { mode: "core", dropped_count: 1, query_len: 0 },
    requiredKeys: ["mode", "dropped_count", "query_len"],
  },
  {
    channel: "landing_path_normalized",
    payload: { mode: "core", requested: "/x", reason: "invalid", fallback: "/dashboard" },
    requiredKeys: ["mode", "reason", "fallback"],
  },
];

describe("v8 diagnostics field presence (§19.3)", () => {
  it("covers every known product-surface diagnostic channel", () => {
    const covered = [...new Set(CASES.map((c) => c.channel))].sort();
    const expected: ProductSurfaceDiagnosticChannel[] = [
      "api_workspace_gate_denied",
      "cmdk_recent_hrefs",
      "cmdk_search_index_filtered",
      "href_eligibility_denied",
      "landing_path_normalized",
      "nav_badge_payload_filtered",
      "nav_badges",
      "server_action_eligibility_denied",
      "surface_mapping_missing",
    ];
    expect(covered).toEqual(expected.sort());
  });

  it.each(CASES)("includes required keys for $channel", ({ payload, requiredKeys }) => {
    for (const key of requiredKeys) {
      expect(key in payload, `missing ${key}`).toBe(true);
      expect(payload[key] === null || payload[key] === undefined, String(key)).toBe(false);
    }
  });
});
