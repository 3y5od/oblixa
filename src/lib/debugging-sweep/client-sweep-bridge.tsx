"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** Optional client-side sweep breadcrumb (enable with NEXT_PUBLIC_OBLIXA_CLIENT_SWEEP_BREADCRUMB=1). */
export function DebuggingSweepClientBridge() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_OBLIXA_CLIENT_SWEEP_BREADCRUMB !== "1") return;
    Sentry.addBreadcrumb({
      category: "sweep_client",
      message: "client-bridge-mounted",
      level: "info",
    });
  }, []);
  return null;
}
