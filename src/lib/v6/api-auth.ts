import { jsonForbidden, jsonUnauthorized } from "@/lib/http/problem";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";

export async function requireV6Context(capability?: Parameters<typeof canManageCapability>[1]) {
  const ctx = await getApiAuthContext();
  if (!ctx) {
    return { errorResponse: jsonUnauthorized() };
  }
  if (capability && !(await canManageCapability(ctx, capability))) {
    return { errorResponse: jsonForbidden() };
  }
  return { ctx };
}
