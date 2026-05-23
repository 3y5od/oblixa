import type { CSSProperties } from "react";

export type CornerAnchorPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface CornerAnchorProps {
  position?: CornerAnchorPosition;
  size?: "card" | "section";
  className?: string;
}

const POSITION_OFFSETS: Record<CornerAnchorPosition, CSSProperties> = {
  "top-right": { top: "-2rem", right: "-2rem" },
  "top-left": { top: "-2rem", left: "-2rem" },
  "bottom-right": { bottom: "-2rem", right: "-2rem" },
  "bottom-left": { bottom: "-2rem", left: "-2rem" },
};

const SECTION_POSITION_OFFSETS: Record<CornerAnchorPosition, CSSProperties> = {
  "top-right": { top: "-4rem", right: "-4rem" },
  "top-left": { top: "-4rem", left: "-4rem" },
  "bottom-right": { bottom: "-4rem", right: "-4rem" },
  "bottom-left": { bottom: "-4rem", left: "-4rem" },
};

export function CornerAnchor({
  position = "top-right",
  size = "card",
  className,
}: CornerAnchorProps) {
  const offsets = size === "section" ? SECTION_POSITION_OFFSETS[position] : POSITION_OFFSETS[position];
  const sizeStyles =
    size === "section"
      ? { width: "16rem", height: "16rem" }
      : { width: "8rem", height: "8rem" };

  return (
    <span
      aria-hidden
      className={size === "section" ? `section-corner-anchor ${className ?? ""}` : `landing-corner-ring ${className ?? ""}`}
      style={{ ...sizeStyles, ...offsets }}
    />
  );
}
