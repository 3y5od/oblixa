"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleSectionProps {
  storageKey: string;
  header: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

const KEY_PREFIX = "oblixa.dashboard.collapsed.";

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
    try {
      const stored = window.localStorage.getItem(KEY_PREFIX + storageKey);
      if (stored === "closed" && detailsRef.current) {
        detailsRef.current.open = false;
      } else if (stored === "open" && detailsRef.current) {
        detailsRef.current.open = true;
      }
    } catch {
      /* localStorage may throw in private mode; ignore */
    }
    hydratedRef.current = true;
    return () => {
      hydratedRef.current = false;
    };
  }, [storageKey]);

  function onToggle(): void {
    if (!detailsRef.current || !hydratedRef.current) return;
    try {
      window.localStorage.setItem(
        KEY_PREFIX + storageKey,
        detailsRef.current.open ? "open" : "closed"
      );
    } catch {
      /* ignore */
    }
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
