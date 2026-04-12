import { describe, expect, it } from "vitest";
import { buildExceptionFingerprint } from "@/lib/v4/exceptions";

describe("buildExceptionFingerprint", () => {
  it("normalizes segments and joins with colon", () => {
    const fp = buildExceptionFingerprint({
      organizationId: "ORG-1",
      contractId: "cid",
      linkedEntityType: null,
      linkedEntityId: null,
      exceptionType: "SLA Miss",
    });
    expect(fp).toContain("org-1");
    expect(fp).toContain("slamiss");
    expect(fp.split(":")).toHaveLength(4);
  });

  it("uses linked entity when present", () => {
    const a = buildExceptionFingerprint({
      organizationId: "o",
      contractId: "c",
      linkedEntityType: "task",
      linkedEntityId: "t1",
      exceptionType: "x",
    });
    expect(a).toContain("task");
    expect(a).toContain("t1");
  });
});
