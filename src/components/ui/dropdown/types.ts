/**
 * Shared type vocabulary for the dropdown subsystem (filter-pill, form-field,
 * and action-menu variants all resolve to these shapes). Pure types — no React
 * imports — so both client primitives and the public `UiSelect`/`FilterSelect`/
 * `FormSelect` surfaces can depend on it without a cycle.
 */

export type DropdownRole = "listbox" | "menu" | "dialog";
export type DropdownPlacement = "down" | "up";

/**
 * How the popover surface anchors horizontally to its trigger:
 * - `stretch` — surface width === trigger width (UiSelect `menuWidth="trigger"`).
 * - `start`   — surface left edge anchored to the trigger's left, never narrower
 *               than the trigger (UiSelect `menuWidth="fit"`).
 * - `end`     — surface right edge anchored to the trigger's right (right-aligned
 *               row/account menus).
 */
export type DropdownAlign = "start" | "end" | "stretch";

/** Status-dot tone for an option row (mirrors the §2.5 status-dot palette). */
export type DropdownStatusTone = "success" | "warning" | "danger" | "neutral";

/** Leading kind-icon token for an option row (rendered before the label).
 *  Tokenized — not a ReactNode — so this module stays React-free, mirroring
 *  `statusDot`. `paperclip` = attachment present, `file-x` = attachment absent. */
export type DropdownOptionIcon = "paperclip" | "file-x";

/**
 * Computed fixed-position geometry for a portaled popover. `offset` is the gap
 * from the relevant viewport edge: from the top when `placement === "down"`,
 * from the bottom when `placement === "up"`.
 */
export interface DropdownPosition {
  left?: number;
  right?: number;
  width?: number;
  minWidth?: number;
  placement: DropdownPlacement;
  offset: number;
  maxHeight: number;
}

/**
 * Canonical option shape for listbox-style dropdowns. `value`/`label` are the
 * only required fields, so every existing caller keeps working; the rest are
 * additive, opt-in slots rendered by `DropdownOptionRow`.
 */
export interface UiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  /** Secondary line under the label (e.g. role descriptions). */
  description?: string;
  /** Trailing tabular count (e.g. "12"), right-aligned. */
  count?: number | string;
  /** Leading status dot conveying real state — omit for neutral rows. */
  statusDot?: DropdownStatusTone;
  /** Leading kind-icon (e.g. a paperclip for a "has file" option). */
  icon?: DropdownOptionIcon;
  /** Section key; options sharing a key render under one caps header. */
  group?: string;
}
