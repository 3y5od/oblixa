"use client";

import type { ReactNode } from "react";

export function RouteStatePanel({
  eyebrow,
  title,
  copy,
  digest,
  digestLabel = "Error ID",
  icon,
  iconCompact = false,
  actions,
  shellClassName = "",
  cardClassName = "",
}: {
  eyebrow?: string;
  title: string;
  copy: string;
  digest?: string;
  digestLabel?: string;
  icon?: ReactNode;
  iconCompact?: boolean;
  actions?: ReactNode;
  shellClassName?: string;
  cardClassName?: string;
}) {
  return (
    <div className={`ui-route-state-shell ${shellClassName}`.trim()}>
      <div className={`ui-route-state-card ${cardClassName}`.trim()}>
        {icon ? (
          <div className={iconCompact ? "ui-icon-badge-danger-compact mx-auto" : "ui-icon-badge-danger mx-auto"} aria-hidden>
            {icon}
          </div>
        ) : null}
        {eyebrow ? <p className={`ui-eyebrow ${icon ? "mt-5" : ""}`.trim()}>{eyebrow}</p> : null}
        <h2 className={`ui-page-title text-balance ${icon || eyebrow ? "mt-2.5" : ""} text-[1.55rem] sm:text-[1.75rem]`.trim()}>
          {title}
        </h2>
        <p className="ui-route-state-copy mx-auto" role="alert" aria-live="assertive">
          {copy}
        </p>
        {digest ? (
          <p className="ui-meta mt-3">
            {digestLabel}: {digest}
          </p>
        ) : null}
        {actions ? <div className="ui-route-state-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
