"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  readDashboardCollapsedSection,
  writeDashboardCollapsedSection,
} from "@/lib/security/client-storage";

interface CollapsibleSectionProps {
  storageKey: string;
  header: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Server-friendly collapsible wrapper. Renders fully expanded on the server,
 * then on hydration applies the stored open/closed state per storageKey.
 *
 * Uses native <details> so keyboard nav and accessibility come for free; we
 * intercept the toggle event to persist state to localStorage.
 */
export function CollapsibleSection({
  storageKey,
  header,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    const stored = readDashboardCollapsedSection(storageKey);
    if (stored === "closed" && detailsRef.current) {
      detailsRef.current.open = false;
    } else if (stored === "open" && detailsRef.current) {
      detailsRef.current.open = true;
    }
    hydratedRef.current = true;
    return () => {
      hydratedRef.current = false;
    };
  }, [storageKey]);

  function onToggle(): void {
    if (!detailsRef.current || !hydratedRef.current) return;
    writeDashboardCollapsedSection(storageKey, detailsRef.current.open ? "open" : "closed");
  }

  return (
    <details
      ref={detailsRef}
      open={defaultOpen}
      onToggle={onToggle}
      className="group/collapsible space-y-3 [&[open]>summary>svg]:rotate-0 [&:not([open])>summary>svg]:-rotate-90"
    >
      <summary className="ui-collapsible-summary flex cursor-pointer list-none items-center gap-2 select-none">
        <ChevronDown
          className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform duration-150"
          strokeWidth={1.85}
          aria-hidden
        />
        {header}
      </summary>
      {children}
    </details>
  );
}
