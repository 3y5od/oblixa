import type { ReactNode } from "react";

export function SectionEyebrow({ index, children }: { index?: string; children: ReactNode }) {
  return (
    <p className="lp-eyebrow">
      {index ? <span className="lp-eyebrow-index">{index}</span> : null}
      {children}
    </p>
  );
}

export function SectionHeading({
  children,
  id,
  major = false,
  className = "",
}: {
  children: ReactNode;
  id?: string;
  major?: boolean;
  className?: string;
}) {
  const size = major
    ? "text-[2.1rem] sm:text-[2.7rem] md:text-[3.05rem]"
    : "text-[1.95rem] sm:text-[2.35rem] md:text-[2.65rem]";
  return (
    <h2 id={id} className={`lp-serif mt-5 text-balance leading-[1.08] text-[var(--text-primary)] ${size} ${className}`.trim()}>
      {children}
    </h2>
  );
}
