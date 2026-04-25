import type { ReactNode } from "react";

export function SegmentLoading({
  label,
  shellClassName = "",
  bodyClassName = "",
  children,
}: {
  label: string;
  shellClassName?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        {label}
      </div>
      <div className={`ui-route-state-shell ${shellClassName}`.trim()} aria-hidden aria-busy="true">
        <div className={`w-full ${bodyClassName}`.trim()}>{children}</div>
      </div>
    </>
  );
}

export function LoadingCard({ className = "", children }: { className?: string; children?: ReactNode }) {
  return <div className={`ui-loading-panel ${className}`.trim()}>{children}</div>;
}
