"use client";

export function SkipLink() {
  return (
    <a
      href="#main-content"
      onClick={(e) => {
        e.preventDefault();
        const el = document.getElementById("main-content");
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
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
