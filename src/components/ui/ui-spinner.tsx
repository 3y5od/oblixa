import { Loader2 } from "lucide-react";

export interface UiSpinnerProps {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  ariaLabel?: string;
}

const SIZE_PX: Record<NonNullable<UiSpinnerProps["size"]>, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
};

export function UiSpinner({ size = "sm", className, ariaLabel = "Loading" }: UiSpinnerProps) {
  const px = SIZE_PX[size];
  return (
    <Loader2
      role="status"
      aria-label={ariaLabel}
      className={`shrink-0 animate-spin ${className ?? ""}`}
      style={{ width: px, height: px }}
      strokeWidth={1.85}
    />
  );
}
