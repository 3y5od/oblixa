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
      className="absolute left-[-10000px] top-0 z-[200] h-px w-px overflow-hidden whitespace-nowrap focus:left-4 focus:top-4 focus:h-auto focus:w-auto focus:overflow-visible focus:whitespace-normal focus:rounded-lg focus:bg-zinc-900 focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2"
    >
      Skip to main content
    </a>
  );
}
