import { SETTINGS_BILLING_STRINGS } from "@/lib/settings/spec-strings";

// SPEC: docs/billing-page-refinement-pass.md §1.12 + §11.6 — map
// Stripe `decline_code` to a user-actionable remediation hint.

export function declineRemediation(declineCode: string | null | undefined): string {
  if (!declineCode) return SETTINGS_BILLING_STRINGS.declineRemediation.default;
  const map = SETTINGS_BILLING_STRINGS.declineRemediation as Record<string, string>;
  return map[declineCode] ?? map.default;
}
