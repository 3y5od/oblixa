import { createHash } from "node:crypto";

export const AUDIT_HASH_CHAIN_ENABLED_ENV = "OBLIXA_ENABLE_AUDIT_HASH_CHAIN";
export const AUDIT_HASH_CHAIN_SCHEMA_VERSION = 1;
export const AUDIT_HASH_CHAIN_DISABLED_BY_DEFAULT = true;

export type AuditHashChainEvent = {
  id: string;
  organizationId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  actorUserId: string | null;
  outcome: string;
  occurredAt: string;
  safeMetadataHash?: string | null;
};

export type AuditHashChainLink = {
  schemaVersion: typeof AUDIT_HASH_CHAIN_SCHEMA_VERSION;
  index: number;
  eventId: string;
  previousHash: string;
  eventHash: string;
  chainHash: string;
};

export function isAuditHashChainEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env[AUDIT_HASH_CHAIN_ENABLED_ENV] === "1";
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableJson(entry)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableJson(entryValue)}`).join(",")}}`;
}

export function canonicalAuditChainPayload(event: AuditHashChainEvent): string {
  return stableJson({
    action: event.action,
    actorUserId: event.actorUserId,
    id: event.id,
    occurredAt: event.occurredAt,
    organizationId: event.organizationId,
    outcome: event.outcome,
    safeMetadataHash: event.safeMetadataHash ?? null,
    targetId: event.targetId,
    targetType: event.targetType,
  });
}

export function auditHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function computeAuditEventHash(event: AuditHashChainEvent): string {
  return auditHash(canonicalAuditChainPayload(event));
}

export function computeAuditChainHash(input: {
  previousHash: string;
  eventHash: string;
  organizationId: string;
  eventId: string;
}): string {
  return auditHash(
    stableJson({
      eventHash: input.eventHash,
      eventId: input.eventId,
      organizationId: input.organizationId,
      previousHash: input.previousHash,
      schemaVersion: AUDIT_HASH_CHAIN_SCHEMA_VERSION,
    })
  );
}

export function buildAuditHashChain(
  events: readonly AuditHashChainEvent[],
  options: { initialHash?: string } = {}
): AuditHashChainLink[] {
  let previousHash = options.initialHash ?? "0".repeat(64);
  return events.map((event, index) => {
    const eventHash = computeAuditEventHash(event);
    const chainHash = computeAuditChainHash({
      previousHash,
      eventHash,
      organizationId: event.organizationId,
      eventId: event.id,
    });
    const link: AuditHashChainLink = {
      schemaVersion: AUDIT_HASH_CHAIN_SCHEMA_VERSION,
      index,
      eventId: event.id,
      previousHash,
      eventHash,
      chainHash,
    };
    previousHash = chainHash;
    return link;
  });
}

export function auditHashChainScaffoldStatus(env: Record<string, string | undefined> = process.env) {
  return {
    schemaVersion: AUDIT_HASH_CHAIN_SCHEMA_VERSION,
    disabledByDefault: AUDIT_HASH_CHAIN_DISABLED_BY_DEFAULT,
    enabled: isAuditHashChainEnabled(env),
    envFlag: AUDIT_HASH_CHAIN_ENABLED_ENV,
    externalSideEffects: false,
  };
}
