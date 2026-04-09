import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/security/cron-auth";

export function ensureCronAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET missing" }, { status: 500 });
  }
  if (!authorizeCronRequest(request, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
