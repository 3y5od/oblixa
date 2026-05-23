"use client";

import type { MouseEvent, ReactNode } from "react";
import { MAIN_CONTENT_ID } from "@/lib/qa/test-ids";

type SettingsAnchorLinkProps = {
  href: `#${string}`;
  className?: string;
  children: ReactNode;
};

export function SettingsAnchorLink({ href, className, children }: SettingsAnchorLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const targetId = decodeURIComponent(href.slice(1));
    const target = document.getElementById(targetId);
    const main = document.getElementById(MAIN_CONTENT_ID);
    if (!target || !(main instanceof HTMLElement)) return;

    event.preventDefault();
    const mainRect = main.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const top = targetRect.top - mainRect.top + main.scrollTop - 24;
    main.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${href}`);
    window.requestAnimationFrame(() => target.focus({ preventScroll: true }));
  }

  return (
    <a href={href} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
