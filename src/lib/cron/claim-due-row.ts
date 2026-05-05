type ClaimFilter =
  | { type: "eq"; column: string; value: string | number | boolean | null }
  | { type: "in"; column: string; values: Array<string | number | boolean> }
  | { type: "lte"; column: string; value: string | number }
  | { type: "or"; expression: string };

type ClaimableAdmin = {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => ClaimableQueryChain<unknown>;
  };
};

type ClaimableQueryChain<T> = {
  eq: (column: string, value: string | number | boolean | null) => ClaimableQueryChain<T>;
  in: (column: string, values: Array<string | number | boolean>) => ClaimableQueryChain<T>;
  lte: (column: string, value: string | number) => ClaimableQueryChain<T>;
  or: (expression: string) => ClaimableQueryChain<T>;
  select: (columns: string) => {
    maybeSingle: () => PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>;
  };
};

export async function claimDueRow<T>(input: {
  admin: ClaimableAdmin;
  table: string;
  rowId: string;
  select: string;
  claimPatch: Record<string, unknown>;
  filters?: ClaimFilter[];
  rowIdColumn?: string;
}): Promise<{ data: T | null; error: { message: string; code?: string } | null }> {
  let query = input.admin.from(input.table).update(input.claimPatch).eq(input.rowIdColumn ?? "id", input.rowId);

  for (const filter of input.filters ?? []) {
    if (filter.type === "eq") {
      query = query.eq(filter.column, filter.value);
      continue;
    }
    if (filter.type === "in") {
      query = query.in(filter.column, filter.values);
      continue;
    }
    if (filter.type === "lte") {
      query = query.lte(filter.column, filter.value);
      continue;
    }
    query = query.or(filter.expression);
  }

  const result = await query.select(input.select).maybeSingle();
  return {
    data: (result?.data ?? null) as T | null,
    error: (result?.error ?? null) as { message: string; code?: string } | null,
  };
}