/**
 * Partial typing surface for an instrumented fetch wrapper (catalog-only unless product adopts it).
 * Implementations must not leak secrets into URLs or headers.
 */
export type InstrumentedFetchInit = RequestInit & {
  /** Logical operation name for tracing (no PII). */
  operationName?: string;
};

export type InstrumentedFetch = (input: RequestInfo | URL, init?: InstrumentedFetchInit) => Promise<Response>;
