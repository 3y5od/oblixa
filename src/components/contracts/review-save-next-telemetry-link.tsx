"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { emitReviewSaveNextUsedTelemetry } from "@/actions/product-telemetry";

type Props = {
  href: string;
  className?: string;
  children: ReactNode;
};

/** Review queue continuity — server telemetry mirrors CmdK 30s client throttle. */
export function ReviewSaveNextTelemetryLink({ href, className, children }: Props) {
  const lastAt = useRef(0);

  function maybeEmit() {
    const now = Date.now();
    if (now - lastAt.current < 30_000) return;
    lastAt.current = now;
    void emitReviewSaveNextUsedTelemetry();
  }

  return (
    <Link href={href} className={className} onClick={() => maybeEmit()}>
      {children}
    </Link>
  );
}
