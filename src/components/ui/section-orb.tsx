import type { CSSProperties } from "react";

export type OrbTone = "cool" | "warm" | "amber" | "success" | "neutral";

const ORB_TINT: Record<OrbTone, string> = {
  cool: "color-mix(in oklab, var(--accent) 14%, transparent)",
  warm: "color-mix(in oklab, var(--accent-warm, var(--accent)) 12%, transparent)",
  amber: "color-mix(in oklab, var(--warning-ink) 12%, transparent)",
  success: "color-mix(in oklab, var(--success-ink) 12%, transparent)",
  neutral: "color-mix(in oklab, var(--text-tertiary) 10%, transparent)",
};

export interface SectionOrbProps {
  tone?: OrbTone;
  size?: string;
  position?: CSSProperties;
  className?: string;
}

export function SectionOrb({
  tone = "cool",
  size = "32rem",
  position,
  className,
}: SectionOrbProps) {
  return (
    <span
      aria-hidden
      className={`section-orb ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, ${ORB_TINT[tone]}, transparent 70%)`,
        ...position,
      }}
    />
  );
}
