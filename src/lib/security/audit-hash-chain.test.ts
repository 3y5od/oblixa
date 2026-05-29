import { describe, expect, it } from "vitest";
import {
  AUDIT_HASH_CHAIN_ENABLED_ENV,
  auditHashChainScaffoldStatus,
  buildAuditHashChain,
  computeAuditEventHash,
  isAuditHashChainEnabled,
  type AuditHashChainEvent,
} from "@/lib/security/audit-hash-chain";

const event: AuditHashChainEvent = {
  id: "audit_1",
  organizationId: "org_1",
  action: "security.dsr_self_export_downloaded",
  targetType: "user",
  targetId: "user_1",
  actorUserId: "user_1",
  outcome: "success",
  occurredAt: "2026-01-01T00:00:00.000Z",
  safeMetadataHash: "meta_hash_1",
};

describe("audit hash-chain scaffold", () => {
  it("is disabled unless explicitly adopted", () => {
    expect(isAuditHashChainEnabled({})).toBe(false);
    expect(isAuditHashChainEnabled({ [AUDIT_HASH_CHAIN_ENABLED_ENV]: "1" })).toBe(true);
    expect(auditHashChainScaffoldStatus({})).toMatchObject({
      disabledByDefault: true,
      enabled: false,
      externalSideEffects: false,
    });
  });

  it("builds deterministic local-only hash-chain links", () => {
    const first = buildAuditHashChain([event, { ...event, id: "audit_2", action: "security.dsr_account_delete_requested" }]);
    const second = buildAuditHashChain([event, { ...event, id: "audit_2", action: "security.dsr_account_delete_requested" }]);

    expect(first).toEqual(second);
    expect(first[0]?.previousHash).toBe("0".repeat(64));
    expect(first[1]?.previousHash).toBe(first[0]?.chainHash);
    expect(first[0]?.eventHash).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("changes event hashes when event content is tampered", () => {
    expect(computeAuditEventHash(event)).not.toBe(
      computeAuditEventHash({ ...event, outcome: "forbidden" })
    );
  });
});
