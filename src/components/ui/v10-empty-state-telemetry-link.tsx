"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { emitV10EmptyStateCtaClickedTelemetry } from "@/actions/product-telemetry";

export function V10EmptyStateTelemetryLink(props: {
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
        void emitV10EmptyStateCtaClickedTelemetry({
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
