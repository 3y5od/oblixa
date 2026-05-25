import { jsonForbidden, jsonUnauthorized } from "@/lib/http/problem";
import { canManageCapability, getApiAuthContext } from "@/lib/contract-operations/api-auth";

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

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { requireV6Context as requireContext };
// End version-name compatibility aliases.
