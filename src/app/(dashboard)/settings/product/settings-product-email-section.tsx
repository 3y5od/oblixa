import Link from "next/link";
import { updateProductEmailNotificationCategoriesForm } from "@/actions/product-surface-settings";
import { NOTIFICATION_TAXONOMY } from "@/lib/notification-taxonomy";
import { displayLabelForFeature } from "@/lib/product-surface/feature-registry";
import { humanizeOperationalToken } from "@/lib/ui/operational-copy";

function notificationPreferenceLabel(notificationType: string): string {
  return humanizeOperationalToken(notificationType, notificationType);
}

export function SettingsProductEmailSection({ blockedTypes }: { blockedTypes: string[] }) {
  const emailBlocked = new Set(blockedTypes);
  const visibleBlockedTypes = NOTIFICATION_TAXONOMY.filter((entry) => emailBlocked.has(entry.notificationType)).map(
    (entry) => entry.notificationType
  );

  return (
    <section className="ui-card p-6 md:p-8">
      <p className="ui-label-caps">Email notification categories</p>
      <p className="ui-muted-tight mt-2 max-w-2xl text-[12.5px]">
        Email delivery preferences accept only canonical workspace notification types. Check to <strong>mute</strong>
        a category (adds it to <code className="text-xs">notification_policy_json.email.blocked_types</code>).
      </p>
      <p className="ui-muted-tight mt-3 max-w-2xl text-[12.5px]">
        Review and mute categories by tier so operators only receive delivery types that match the current workspace
        posture and team workflow.
      </p>
      <p className="ui-muted-tight mt-3 max-w-2xl text-[12.5px]">
        Currently muted:{" "}
        <span className="font-medium text-[var(--text-primary)]">
          {visibleBlockedTypes.length === 0
            ? "none"
            : visibleBlockedTypes.map((notificationType) => notificationPreferenceLabel(notificationType)).join(", ")}
        </span>
        . Check{" "}
        <Link href="/settings/health" className="ui-link">
          Health
        </Link>{" "}
        if deliveries look delayed or suppressed after changing these categories.
      </p>
      <form action={updateProductEmailNotificationCategoriesForm as never} className="mt-4 space-y-3">
        {(["core", "advanced", "assurance"] as const).map((tier) => (
          <div key={tier} className="rounded-xl border border-[var(--border-subtle)]/80 p-4">
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {tier[0].toUpperCase()}
              {tier.slice(1)} delivery types
            </p>
            <ul className="mt-3 space-y-3">
              {NOTIFICATION_TAXONOMY.filter((entry) => entry.tier === tier).map((entry) => (
                <li key={entry.notificationType} className="flex items-start gap-2">
                  <input
                    id={`mute_email_${entry.notificationType}`}
                    name={`mute_email_${entry.notificationType}`}
                    type="checkbox"
                    defaultChecked={emailBlocked.has(entry.notificationType)}
                    className="ui-checkbox mt-1"
                  />
                  <label htmlFor={`mute_email_${entry.notificationType}`} className="text-sm text-[var(--text-primary)]">
                    <span className="block">Mute {notificationPreferenceLabel(entry.notificationType)}</span>
                    <span className="ui-muted-tight mt-1 block text-[12.5px]">
                      {displayLabelForFeature(entry.featureFamily)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <button type="submit" className="ui-btn-secondary px-4 py-2 text-[12.5px]">
          Save email categories
        </button>
      </form>
    </section>
  );
}