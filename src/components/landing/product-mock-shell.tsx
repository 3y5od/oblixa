import type { ReactNode } from "react";

type ToneName = "cool" | "warm" | "amber" | "success" | "neutral";

const TONE_TOKEN: Record<ToneName, string> = {
  cool: "var(--accent-strong)",
  warm: "var(--accent-warm, var(--accent))",
  amber: "var(--warning-ink)",
  success: "var(--success-ink)",
  neutral: "var(--border-strong)",
};

function BrowserChrome({ path }: { path: string }) {
  return (
    <div className="product-browser-chrome">
      <span className="truncate font-mono text-[10px] text-[var(--text-tertiary)]">
        {path}
      </span>
    </div>
  );
}

export function MockShell({
  caption,
  tone,
  chromePath,
  children,
}: {
  caption: string;
  tone: ToneName;
  chromePath: string;
  children: ReactNode;
}) {
  return (
    <figure aria-label={`Product preview: ${caption}`} className="w-full">
      <div
        className="relative overflow-hidden rounded-2xl border shadow-[var(--shadow-1)]"
        style={{
          borderColor: `color-mix(in oklab, ${TONE_TOKEN[tone]} 18%, var(--border-subtle))`,
          background: "var(--surface-raised)",
        }}
      >
        <BrowserChrome path={chromePath} />
        <div className="relative w-full p-4 sm:p-5">{children}</div>
      </div>
      <figcaption className="mt-2 text-center text-[12px] text-[var(--text-tertiary)]">
        <span className="text-[var(--text-secondary)]">{caption}</span> preview
      </figcaption>
    </figure>
  );
}
