import { FieldChip } from "@/components/ui/field-chip";
import type { StatTone } from "@/components/ui/stat-cell";

export interface EntityChipProps {
  /** Proper-noun entity name (contract, counterparty, owner). */
  name: string;
  tone?: StatTone;
  size?: "xs" | "sm" | "md";
  title?: string;
  className?: string;
}

/**
 * Natural-case chip for a proper-noun entity so names never render as shouting
 * caps (§11.9). A thin semantic wrapper over FieldChip's `preserve` transform so
 * entity references across the dashboard share one primitive.
 */
export function EntityChip({ name, tone, size = "sm", title, className }: EntityChipProps) {
  return (
    <FieldChip
      label={name}
      transform="preserve"
      tone={tone}
      size={size}
      title={title ?? name}
      className={className}
    />
  );
}
