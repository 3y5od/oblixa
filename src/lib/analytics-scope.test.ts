import { describe, expect, it } from "vitest";
import { normalizeAnalyticsScope } from "@/lib/analytics-scope";

describe("normalizeAnalyticsScope", () => {
  const ownerOptions = ["all", "alice", "bob"];
  const regionOptions = ["all", "na", "emea"];
  const typeOptions = ["all", "msa", "sow"];

  it("keeps supported values", () => {
    const scope = normalizeAnalyticsScope({
      ownerRaw: "alice",
      regionRaw: "emea",
      typeRaw: "msa",
      ownerOptions,
      regionOptions,
      typeOptions,
    });
    expect(scope).toEqual({
      ownerFilter: "alice",
      regionFilter: "emea",
      typeFilter: "msa",
    });
  });

  it("falls back to all for unsupported values", () => {
    const scope = normalizeAnalyticsScope({
      ownerRaw: "malicious",
      regionRaw: "unknown",
      typeRaw: "not-a-type",
      ownerOptions,
      regionOptions,
      typeOptions,
    });
    expect(scope).toEqual({
      ownerFilter: "all",
      regionFilter: "all",
      typeFilter: "all",
    });
  });

  it("treats empty/whitespace values as all", () => {
    const scope = normalizeAnalyticsScope({
      ownerRaw: "   ",
      regionRaw: "",
      typeRaw: undefined,
      ownerOptions,
      regionOptions,
      typeOptions,
    });
    expect(scope).toEqual({
      ownerFilter: "all",
      regionFilter: "all",
      typeFilter: "all",
    });
  });
});
