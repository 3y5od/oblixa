import { afterEach, describe, expect, it, vi } from "vitest";
import { inboundOrgNotAllowedResponse } from "@/lib/security/inbound-org-allowlist";

describe("inboundOrgNotAllowedResponse", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when allowlist env is unset", () => {
    vi.stubEnv("INBOUND_AUTOMATION_ORG_ALLOWLIST", "");
    expect(inboundOrgNotAllowedResponse("550e8400-e29b-41d4-a716-446655440000")).toBeNull();
  });

  it("returns null when org is in allowlist", () => {
    const org = "550e8400-e29b-41d4-a716-446655440000";
    vi.stubEnv("INBOUND_AUTOMATION_ORG_ALLOWLIST", `${org}, other-uuid`);
    expect(inboundOrgNotAllowedResponse(org)).toBeNull();
  });

  it("returns 403 when org is not in allowlist", async () => {
    vi.stubEnv("INBOUND_AUTOMATION_ORG_ALLOWLIST", "11111111-1111-1111-1111-111111111111");
    const res = inboundOrgNotAllowedResponse("550e8400-e29b-41d4-a716-446655440000");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it("matches UUID case-insensitively", () => {
    vi.stubEnv("INBOUND_AUTOMATION_ORG_ALLOWLIST", "AAAA1111-1111-1111-1111-111111111111");
    expect(inboundOrgNotAllowedResponse("aaaa1111-1111-1111-1111-111111111111")).toBeNull();
  });
});
