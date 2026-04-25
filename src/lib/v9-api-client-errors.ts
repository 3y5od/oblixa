import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";

export type V9CapacityErrorKind = "rate_limited" | "payload_too_large" | "unknown";

export function interpretHttpMutationFailure(input: {
  status: number;
  message?: string | null;
}): { kind: V9CapacityErrorKind; userMessage: string; retryAppropriate: boolean } {
  if (input.status === 429) {
    return {
      kind: "rate_limited",
      userMessage:
        "This action is temporarily rate limited. Wait a minute, narrow the scope, or try again later instead of rapid retries.",
      retryAppropriate: true,
    };
  }
  if (input.status === 413) {
    return {
      kind: "payload_too_large",
      userMessage: "The request or export scope is too large. Reduce files, rows, or columns and try again.",
      retryAppropriate: false,
    };
  }
  const base = describeRecoverableMutationError(input.message?.trim() || "Request failed");
  return {
    kind: "unknown",
    userMessage: base,
    retryAppropriate: input.status >= 500,
  };
}
