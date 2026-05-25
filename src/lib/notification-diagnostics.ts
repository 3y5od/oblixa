/** Deep link for reminder delivery / suppression diagnostics (V9 notification matrix). */
export const V9_REMINDER_DELIVERY_HEALTH_HREF = "/settings/health";

export function reminderSuppressionDiagnosticsHint(): string {
  return `For suppression, dedupe, and failure detail, open Health (${V9_REMINDER_DELIVERY_HEALTH_HREF}) and cross-check reminder eligibility on the contract dates tab.`;
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { V9_REMINDER_DELIVERY_HEALTH_HREF as REMINDER_DELIVERY_HEALTH_HREF };
// End version-name compatibility aliases.
