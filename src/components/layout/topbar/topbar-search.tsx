"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchField } from "@/components/search/search-field";
import { shellTestIds } from "@/lib/qa/test-ids";

/** Below this committed-search width the descriptive placeholder clips and the
 *  ⌘K hint crowds the value, so we fall back to a short placeholder and drop the
 *  hint rather than let either get truncated. */
const TIGHT_SEARCH_WIDTH = 360;

/** Chrome (committed) search. Enter navigates to the dedicated `/search` page;
 *  ⌘K still opens the quick-jump command palette overlay (bound in
 *  command-palette-loader.tsx). Clicking the input focuses it — it does NOT open
 *  the overlay. */
export function TopbarSearch() {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tight, setTight] = useState(false);

  // Width-driven (not viewport-driven) so the placeholder/hint respond to the
  // actual room the search has after the breadcrumb + account cluster take theirs.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setTight(width > 0 && width < TIGHT_SEARCH_WIDTH);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="min-w-0 flex-1 sm:max-w-[22rem] md:max-w-[26rem]">
      <SearchField
        variant="chrome"
        name="q"
        testId={shellTestIds.headerSearch}
        ariaLabel="Search workspace"
        placeholder="Search workspace"
        // Drop the ⌘K badge when the field is tight so it never clips against the
        // value/placeholder; ⌘K still works (bound globally) and is announced via
        // aria-keyshortcuts.
        kbdHint={tight ? undefined : { meta: "⌘", key: "K" }}
        ariaKeyShortcuts="Meta+K Control+K"
        // Surface the clear-X + Esc-to-clear affordance once text is typed,
        // matching the overlay/page variants. The chrome input is uncontrolled,
        // so the field clears itself; nothing else to reset.
        onClear={() => undefined}
        onSubmit={(q) => {
          const trimmed = q.trim().slice(0, 200);
          router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
        }}
      />
    </div>
  );
}
