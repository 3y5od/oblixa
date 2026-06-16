import Link from "next/link";
import { Check, Inbox, Mail, TriangleAlert } from "lucide-react";
import { ActionChip } from "@/components/ui/action-chip";
import { StatusBadge } from "@/components/ui/status-badge";
import { SETTINGS_SECURITY_STRINGS } from "@/lib/settings/spec-strings";
import { formatDate, timeAttrs } from "@/lib/format/date";

function roleLabel(role: string): string {
  if (!role) return "Member";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function AccountContext({
  ctxRole,
  providerLabel,
  emailVerified,
  emailConfirmedAt,
  memberSince,
  memberSinceIso,
  lastSignInIso,
}: {
  ctxRole: string;
  providerLabel: string;
  emailVerified: boolean;
  emailConfirmedAt: string | null;
  memberSince: string | null;
  memberSinceIso: string | null;
  lastSignInIso: string | null;
}) {
  const S = SETTINGS_SECURITY_STRINGS;
  const verifiedLabel = emailConfirmedAt ? formatDate(emailConfirmedAt, "date") : null;
  const onlyEmailProvider = providerLabel.trim().toLowerCase() === "email";
  const rowClass =
    "flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-2.5";
  const labelClass = "ui-caps-3 text-[var(--text-tertiary)]";
  return (
    <section aria-labelledby="security-context-title">
      <h2
        id="security-context-title"
        className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]"
      >
        {S.sections.resources}
      </h2>
      <dl className="mt-3 divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]">
        <div className="py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
            <dt className={labelClass}>{S.sections.teamRoles}</dt>
            <dd className="inline-flex flex-wrap items-center justify-end gap-2 text-[13px]">
              <span className="font-medium text-[var(--text-primary)]">
                {roleLabel(ctxRole)}
              </span>
              <ActionChip verb={S.manageTeamRolesCta} href="/settings#team-access" />
            </dd>
          </div>
          <p className="mt-1 text-[11.5px] leading-snug text-[var(--text-tertiary)]">
            {S.teamRolesVisibilityNote}
          </p>
        </div>

        {!onlyEmailProvider ? (
          <div className={rowClass}>
            <dt className={labelClass}>{S.resources.signInMethod}</dt>
            <dd className="inline-flex flex-wrap items-center justify-end gap-1.5 text-[13px]">
              {providerLabel.split(" - ").map((p) => (
                <span
                  key={p}
                  className="ui-caps-3 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-0.5 text-[var(--text-secondary)]"
                >
                  {p.toUpperCase()}
                </span>
              ))}
            </dd>
          </div>
        ) : null}

        <div className={rowClass}>
          <dt className={labelClass}>{S.resources.emailStatus}</dt>
          <dd className="inline-flex flex-wrap items-center justify-end gap-2 text-[13px]">
            {emailVerified ? (
              <StatusBadge status="healthy" className="gap-1">
                <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                {S.emailVerifiedLabel}
              </StatusBadge>
            ) : (
              <StatusBadge status="warning" className="gap-1">
                <TriangleAlert className="h-3 w-3" strokeWidth={2} aria-hidden />
                {S.emailUnverifiedLabel}
              </StatusBadge>
            )}
            {verifiedLabel ? (
              <time
                className="tabular-nums text-[12px] text-[var(--text-tertiary)]"
                {...timeAttrs(emailConfirmedAt)}
              >
                {verifiedLabel}
              </time>
            ) : null}
            {!emailVerified ? (
              <Link
                href="/auth/resend-verification"
                className="ui-link text-[12.5px]"
              >
                {S.resendVerificationCta}
              </Link>
            ) : null}
          </dd>
        </div>

        {memberSince ? (
          <div className={rowClass}>
            <dt className={labelClass}>{S.resources.memberSince}</dt>
            <dd className="text-[13px] text-[var(--text-primary)]">
              <time className="tabular-nums" {...timeAttrs(memberSinceIso)}>
                {memberSince}
              </time>
            </dd>
          </div>
        ) : null}

        {lastSignInIso ? (
          <div className={rowClass}>
            <dt className={labelClass}>{S.lastSignInLabel}</dt>
            <dd className="text-[13px] text-[var(--text-primary)]">
              <time className="tabular-nums" {...timeAttrs(lastSignInIso)}>
                {formatDate(lastSignInIso, "dateTime")}
              </time>
            </dd>
          </div>
        ) : null}

        <div className={rowClass}>
          <dt className={labelClass}>{S.resources.auditHistory}</dt>
          <dd className="inline-flex justify-end text-[13px]">
            <ActionChip verb={S.auditHistoryCta} href="/settings/security?filter=billing" />
          </dd>
        </div>

        <div className={rowClass}>
          <dt className={labelClass}>{S.resources.dpaContact}</dt>
          <dd className="inline-flex justify-end text-[13px]">
            <ActionChip
              verb={S.contactCta}
              href={`mailto:${S.contactEmail}`}
              icon={Mail}
            />
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function ActivityStrip() {
  const S = SETTINGS_SECURITY_STRINGS;
  return (
    <section aria-labelledby="security-activity-title">
      <h2
        id="security-activity-title"
        title="Events retained for 90 days"
        className="ui-caps-2 text-[var(--accent-strong)]"
      >
        {S.activityEyebrow}
      </h2>
      <div className="mt-3 flex items-start gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3.5">
        <span
          aria-hidden
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-tertiary)]"
        >
          <Inbox className="h-4 w-4" strokeWidth={1.85} />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-medium tabular-nums text-[var(--text-primary)]">
            {S.activityEmptyLabel}
          </p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--text-secondary)]">
            {S.activityEmptyBody}
          </p>
        </div>
      </div>
    </section>
  );
}

export function LegalNote() {
  const S = SETTINGS_SECURITY_STRINGS;
  return (
    <section
      aria-label="Legal"
      className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-3"
    >
      <p className="max-w-2xl text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
        <span className="font-semibold text-[var(--text-primary)]">
          {S.legalBoundaryLabel}:
        </span>{" "}
        {S.legalNote}
      </p>
    </section>
  );
}
