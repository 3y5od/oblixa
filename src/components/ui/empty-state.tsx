import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState(props: {
  title: string;
  copy: string;
  icon?: ReactNode;
  action?: ReactNode;
  eyebrow?: string;
  className?: string;
  size?: "default" | "compact";
}) {
  const compact = props.size === "compact";
  return (
    <div
      className={`ui-empty-state ${compact ? "ui-empty-state-compact" : ""} flex flex-col items-center justify-center ${props.className ?? ""}`.trim()}
    >
      <div className={compact ? "ui-icon-tile-compact" : "ui-icon-tile"}>
        {props.icon ?? (
          <Inbox className={`${compact ? "h-5 w-5" : "h-7 w-7"} text-[var(--text-tertiary)]`.trim()} strokeWidth={1.65} aria-hidden />
        )}
      </div>
      {props.eyebrow ? <p className={`ui-eyebrow ${compact ? "mt-4" : "mt-5"}`.trim()}>{props.eyebrow}</p> : null}
      <h3 className={`ui-empty-state-title text-balance ${compact ? "mt-4 text-[14px]" : ""}`.trim()}>{props.title}</h3>
      {props.copy ? (
        <p className={`ui-empty-state-copy text-balance ${compact ? "mt-1.5 text-[12.5px]" : ""}`.trim()}>{props.copy}</p>
      ) : null}
      {props.action ? (
        <div className={`${compact ? "mt-5" : "mt-6"} flex max-w-full flex-wrap items-center justify-center gap-2.5`.trim()}>{props.action}</div>
      ) : null}
    </div>
  );
}
