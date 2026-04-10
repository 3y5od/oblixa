import { NextResponse } from "next/server";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";

export async function requireV6Context(capability?: Parameters<typeof canManageCapability>[1]) {
  const ctx = await getApiAuthContext();
  if (!ctx) {
    return { errorResponse: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  if (capability && !(await canManageCapability(ctx, capability))) {
    return { errorResponse: NextResponse.json({ error: "Access denied" }, { status: 403 }) };
  }
  return { ctx };
}
