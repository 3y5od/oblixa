import { describe, expect, it } from "vitest";
import {
  normalizeMembershipEntityTypes,
  type SegmentCriteriaJson,
} from "@/lib/assurance/segments";

describe("normalizeMembershipEntityTypes", () => {
  it("defaults to contract when missing or empty", () => {
    expect(normalizeMembershipEntityTypes({})).toEqual(["contract"]);
    expect(normalizeMembershipEntityTypes({ membership_entity_types: [] })).toEqual(["contract"]);
  });

  it("lowercases allowed entity types and drops unknown", () => {
    const c: SegmentCriteriaJson = {
      membership_entity_types: ["Contract", "ACCOUNT", "bogus", "counterparty"],
    };
    expect(normalizeMembershipEntityTypes(c)).toEqual(["contract", "account", "counterparty"]);
  });

  it("falls back to contract when every value is unknown", () => {
    expect(
      normalizeMembershipEntityTypes({ membership_entity_types: ["nope", "invalid"] })
    ).toEqual(["contract"]);
  });

  it("accepts all supported entity type keys", () => {
    const c: SegmentCriteriaJson = {
      membership_entity_types: [
        "contract",
        "account",
        "counterparty",
        "program",
        "owner",
        "team",
      ],
    };
    expect(normalizeMembershipEntityTypes(c)).toEqual([
      "contract",
      "account",
      "counterparty",
      "program",
      "owner",
      "team",
    ]);
  });
});
