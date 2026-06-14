import type { DropdownOptionIcon, DropdownStatusTone } from "@/components/ui/dropdown/types";

export interface UiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
  count?: number | string;
  statusDot?: DropdownStatusTone;
  icon?: DropdownOptionIcon;
}
