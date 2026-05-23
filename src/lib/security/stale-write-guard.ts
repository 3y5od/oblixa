import { jsonProblem } from "@/lib/http/problem";
import { getV10ExpectedVersionFromRequest } from "@/lib/v10-server-contracts";

type ExpectedVersionGuardInput = {
  route: string;
  diagnosticPrefix: string;
};

type ExpectedVersionGuardResult =
  | { ok: true; expectedVersion: string }
  | { ok: false; response: ReturnType<typeof jsonProblem> };

export function requireExpectedVersionForMutation(
  request: Request,
  input: ExpectedVersionGuardInput
): ExpectedVersionGuardResult {
  const expectedVersion = getV10ExpectedVersionFromRequest(request);
  if (!expectedVersion) {
    return {
      ok: false,
      response: jsonProblem(409, {
        error: "Expected version is required. Refresh the record and retry with x-v10-expected-version or If-Match.",
        code: "expected_version_required",
        diagnostic_id: `${input.diagnosticPrefix}_expected_version_required`,
        route: input.route,
      }),
    };
  }

  return { ok: true, expectedVersion: String(expectedVersion) };
}

export function staleExpectedVersionResponse(input: ExpectedVersionGuardInput) {
  return jsonProblem(409, {
    error: "This record changed before the update could be applied. Refresh and retry.",
    code: "stale_version",
    diagnostic_id: `${input.diagnosticPrefix}_stale_version`,
    route: input.route,
  });
}
