"use client";

import { useId, useState, type ReactNode } from "react";

export interface UiTooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  delayMs?: number;
}

export function UiTooltip({ content, children, side = "top", delayMs = 200 }: UiTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  const show = () => {
    if (timer) clearTimeout(timer);
    setTimer(setTimeout(() => setVisible(true), delayMs));
  };
  const hide = () => {
    if (timer) clearTimeout(timer);
    setTimer(null);
    setVisible(false);
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <span aria-describedby={visible ? id : undefined}>{children}</span>
      {visible ? (
        <span
          role="tooltip"
          id={id}
          className={`pointer-events-none absolute left-1/2 z-[var(--z-popover,30)] -translate-x-1/2 whitespace-nowrap rounded-md border border-[var(--border-strong)] bg-[var(--surface-contrast)] px-2 py-1 text-[11px] font-medium text-[var(--text-primary)] shadow-[var(--shadow-2)] ${
            side === "top" ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]"
          }`}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
