import { describe, expect, it, vi } from "vitest";
import {
  getPortfolioByCounterpartyRows,
  getPortfolioByProgramRows,
} from "./decision-intelligence/portfolio-analytics";

function createChainable<T>(terminal: () => Promise<T>) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    range: vi.fn(() => terminal()),
    maybeSingle: vi.fn(() => terminal()),
  };
  return chain;
}

function wireEqReturns(chain: { eq: ReturnType<typeof vi.fn> }) {
  chain.eq.mockImplementation(() => chain);
}

function mockExceptionsQuery(result: { data: unknown; error: unknown }) {
  const c = {
    select: vi.fn(() => c),
    eq: vi.fn(() => c),
    in: vi.fn(() => c),
    limit: vi.fn(() => Promise.resolve(result)),
  };
  return c;
}

function mockContractsInQuery(result: { data: unknown; error: unknown }) {
  const c = {
    select: vi.fn(() => c),
    eq: vi.fn(() => c),
    in: vi.fn(() => Promise.resolve(result)),
  };
  return c;
}

describe("portfolio-analytics", () => {
  it("getPortfolioByProgramRows aggregates active assignments by program", async () => {
    let rangeCalls = 0;
    const assignmentsChain = createChainable(async () => {
      rangeCalls += 1;
      if (rangeCalls === 1) {
        return {
          data: [
            { program_id: "p1" },
            { program_id: "p2" },
            { program_id: "p1" },
          ],
          error: null,
        };
      }
      return { data: [], error: null };
    });
    wireEqReturns(assignmentsChain);

    const admin = {
      from: vi.fn((table: string) => {
        expect(table).toBe("contract_program_assignments");
        return assignmentsChain;
      }),
    } as never;

    const { programs, error } = await getPortfolioByProgramRows(admin, "org-1");
    expect(error).toBeNull();
    expect(programs).toEqual([
      {
        program_id: "p1",
        active_assignments: 2,
        reason: "Count of active contract_program_assignments rows for this program_id.",
      },
      {
        program_id: "p2",
        active_assignments: 1,
        reason: "Count of active contract_program_assignments rows for this program_id.",
      },
    ]);
  });

  it("getPortfolioByProgramRows surfaces pagination errors", async () => {
    const err = { message: "range failed" } as const;
    const chain = createChainable(async () => ({ data: null, error: err }));
    wireEqReturns(chain);
    const admin = { from: vi.fn(() => chain) } as never;
    const { programs, error } = await getPortfolioByProgramRows(admin, "org-1");
    expect(programs).toEqual([]);
    expect(error).toBe("range failed");
  });

  it("getPortfolioByCounterpartyRows returns empty when no open exceptions", async () => {
    const exceptionsChain = mockExceptionsQuery({ data: [], error: null });
    const admin = { from: vi.fn(() => exceptionsChain) } as never;
    const { counterparties, error } = await getPortfolioByCounterpartyRows(admin, "org-1");
    expect(error).toBeNull();
    expect(counterparties).toEqual([]);
  });

  it("getPortfolioByCounterpartyRows groups exceptions by counterparty_key", async () => {
    const exceptionsChain = mockExceptionsQuery({
      data: [
        { contract_id: "c1" },
        { contract_id: "c2" },
        { contract_id: "c1" },
      ],
      error: null,
    });

    const contractsChain = mockContractsInQuery({
      data: [
        { id: "c1", counterparty_key: "cp-a" },
        { id: "c2", counterparty_key: "cp-b" },
      ],
      error: null,
    });

    const admin = {
      from: vi.fn((table: string) => {
        if (table === "exceptions") return exceptionsChain;
        if (table === "contracts") return contractsChain;
        throw new Error(`unexpected ${table}`);
      }),
    } as never;

    const { counterparties, error } = await getPortfolioByCounterpartyRows(admin, "org-1");
    expect(error).toBeNull();
    expect(counterparties).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ counterparty_key: "cp-a", open_exceptions: 2 }),
        expect.objectContaining({ counterparty_key: "cp-b", open_exceptions: 1 }),
      ])
    );
  });

  it("getPortfolioByCounterpartyRows surfaces exceptions query errors", async () => {
    const chain = mockExceptionsQuery({
      data: null,
      error: { message: "boom" },
    });
    const admin = { from: vi.fn(() => chain) } as never;
    const { counterparties, error } = await getPortfolioByCounterpartyRows(admin, "org-1");
    expect(counterparties).toEqual([]);
    expect(error).toBe("boom");
  });
});
