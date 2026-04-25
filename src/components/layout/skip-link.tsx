"use client";

import { MAIN_CONTENT_ID } from "@/lib/qa/test-ids";

export function SkipLink() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      onClick={(e) => {
        e.preventDefault();
        const el = document.getElementById(MAIN_CONTENT_ID);
        const reduceMotion =
          typeof window !== "undefined" &&
          window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        el?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        window.setTimeout(() => {
          el?.focus({ preventScroll: true });
        }, 0);
      }}
      className="ui-skip-link"
    >
      Skip to main content
    </a>
  );
}
