"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { emitEmptyStateCtaClickedTelemetry } from "@/actions/product-telemetry";

export function EmptyStateTelemetryLink(props: {
  href: string;
  className?: string;
  surface: string;
  section: string;
  sourceObject: string;
  actionLabel: string;
  prefetch?: boolean;
  children?: ReactNode;
}) {
  return (
    <Link
      href={props.href}
      prefetch={props.prefetch}
      className={props.className}
      onClick={() => {
        void emitEmptyStateCtaClickedTelemetry({
          surface: props.surface,
          section: props.section,
          sourceObject: props.sourceObject,
          actionLabel: props.actionLabel,
          href: props.href,
        });
      }}
    >
      {props.children ?? props.actionLabel}
    </Link>
  );
}

/** @deprecated Compatibility alias while callers migrate to EmptyStateTelemetryLink. */
export const V10EmptyStateTelemetryLink = EmptyStateTelemetryLink;
