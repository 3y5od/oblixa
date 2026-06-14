import { parsePositiveIntParam, validateBoundedString } from "@/lib/security/validation";

export function contractTextError(
  label: string,
  validation: { error: "invalid_string" | "string_too_long" | "unsafe_characters" },
  options: { requiredMessage?: string } = {}
): string {
  if (validation.error === "string_too_long") return `${label} is too long`;
  if (validation.error === "unsafe_characters") return `${label} contains unsupported characters`;
  return options.requiredMessage ?? `${label} contains unsupported characters`;
}

export function optionalContractText(
  value: unknown,
  label: string,
  maxLength: number,
  options: { allowTextWhitespaceControls?: boolean } = {}
): { ok: true; value: string | null } | { ok: false; error: string } {
  const validation = validateBoundedString(value ?? "", {
    maxLength,
    allowEmpty: true,
    allowTextWhitespaceControls: options.allowTextWhitespaceControls,
  });
  if (!validation.ok) return { ok: false, error: contractTextError(label, validation) };
  return { ok: true, value: validation.value || null };
}

export function optionalPercentFormValue(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  return parsePositiveIntParam(raw, { defaultValue: 0, min: 0, max: 100 });
}
