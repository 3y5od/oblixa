import type { StatTone } from "@/components/ui/stat-cell";
import { statToneDot } from "@/components/ui/stat-cell";

export interface UiToneDotProps {
  tone: StatTone;
  size?: number;
  className?: string;
}

export function UiToneDot({ tone, size = 6, className }: UiToneDotProps) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 rounded-full ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background: statToneDot(tone),
      }}
    />
  );
}
