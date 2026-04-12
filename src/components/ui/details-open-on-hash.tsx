"use client";

import { useEffect, useState, type ReactNode } from "react";

function normalizeHashIds(ids: string[]): string[] {
  return ids.map((id) => (id.startsWith("#") ? id.slice(1) : id));
}

/**
 * Wraps `<details>` so deep links like `#missing-critical` open the panel and scroll
 * to the target id when it lives inside this disclosure.
 */
export function DetailsOpenOnHash(props: {
  className?: string;
  summary: ReactNode;
  children: ReactNode;
  /** Element ids (with or without `#`) that should open this details when in location.hash */
  openForHashIds: string[];
}) {
  const { className, summary, children, openForHashIds } = props;
  const [open, setOpen] = useState(false);

  const hashIdKey = normalizeHashIds(openForHashIds).sort().join(",");

  useEffect(() => {
    const ids = hashIdKey.split(",").filter(Boolean);

    function syncFromHash() {
      const fragment = window.location.hash.slice(1);
      if (!fragment || !ids.includes(fragment)) return;
      setOpen(true);
      requestAnimationFrame(() => {
        document.getElementById(fragment)?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    }

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [hashIdKey]);

  return (
    <details
      className={className}
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      {summary}
      {children}
    </details>
  );
}
