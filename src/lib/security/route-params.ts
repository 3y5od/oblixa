import { NextResponse } from "next/server";
import { jsonBadRequest } from "@/lib/http/problem";
import { isSafeRouteParam } from "@/lib/security/validation";

export function rejectUnsafeRouteParams(
  params: Record<string, string | null | undefined>,
  names: readonly string[],
  route?: string
): NextResponse | null {
  for (const name of names) {
    if (!isSafeRouteParam(params[name])) {
      return jsonBadRequest(route, { reason: "invalid_route_param", param: name });
    }
  }
  return null;
}

export function rejectInvalidRouteParamEnums(
  params: Record<string, string | null | undefined>,
  allowedValuesByName: Record<string, readonly string[]>,
  route?: string
): NextResponse | null {
  for (const [name, allowedValues] of Object.entries(allowedValuesByName)) {
    const value = params[name];
    if (typeof value !== "string" || !allowedValues.includes(value)) {
      return jsonBadRequest(route, { reason: "invalid_route_param_enum", param: name });
    }
  }
  return null;
}
