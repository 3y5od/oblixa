import { format } from "date-fns";
import Link from "next/link";
import type { ReactNode } from "react";
import { ProfileForm } from "@/components/settings/profile-form";
import { OrgForm } from "@/components/settings/org-form";
import { InviteMemberForm } from "@/components/settings/invite-member-form";
import { PendingInvitesList, type PendingInviteRow } from "@/components/settings/pending-invites";
import { ExternalLink } from "@/components/ui/external-link";
import type { OrganizationMember } from "@/lib/types";
import { SETTINGS_PAGE_STRINGS } from "@/lib/settings/spec-strings";
import type { SettingsDestination, SettingsDestinationGroup, SettingsStatusSummary } from "@/lib/workspace-settings-model";
import { SettingsAnchorLink } from "./settings-anchor-link";

function DestinationAction({ destination, className = "ui-link" }: { destination: SettingsDestination; className?: string }) {
  if (destination.state === "read_only") {
    return <span className="shrink-0 text-xs font-semibold text-[var(--text-secondary)]">Read-only</span>;
  }
  if (destination.state === "unavailable") {
    const label = destination.fallbackActionLabel ?? destination.actionLabel;
    const href = destination.fallbackHref ?? destination.href;
    if (!destination.fallbackHref && !href.startsWith("#")) {
      return <span className="shrink-0 text-xs font-semibold text-[var(--text-secondary)]">{label}</span>;
    }
    if (href.startsWith("#")) {
      return <SettingsAnchorLink href={href as `#${string}`} className={className}>{label}</SettingsAnchorLink>;
    }
    return <Link href={href} className={className}>{label}</Link>;
  }
  if (destination.href.startsWith("/api/")) {
    return <ExternalLink href={destination.href} className={className}>{destination.actionLabel}</ExternalLink>;
  }
  if (destination.href.startsWith("#")) {
    return <SettingsAnchorLink href={destination.href as `#${string}`} className={className}>{destination.actionLabel}</SettingsAnchorLink>;
  }
  return <Link href={destination.href} className={className}>{destination.actionLabel}</Link>;
}

function SettingsActionLink({ href, children, className }: { href: string; children: ReactNode; className: string }) {
  if (href.startsWith("#")) {
    return <SettingsAnchorLink href={href as `#${string}`} className={className}>{children}</SettingsAnchorLink>;
  }
  return <Link href={href} className={className}>{children}</Link>;
}

function statusClass(tone: SettingsDestination["statusTone"]) {
  if (tone === "attention") {
    return "border-[color:color-mix(in_oklab,var(--warning)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_28%,var(--surface-raised))] text-[var(--warning-ink)]";
  }
  if (tone === "healthy") {
    return "border-[color:color-mix(in_oklab,var(--success)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-soft)_28%,var(--surface-raised))] text-[var(--success-ink)]";
  }
  return "border-[color:color-mix(in_oklab,var(--accent)_10%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_8%,var(--surface-raised))] text-[var(--text-secondary)]";
}

export function SettingsDirectory({ groups }: { groups: SettingsDestinationGroup[] }) {
  return (
    <section aria-labelledby="settings-directory-title">
      <header className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          id="settings-directory-title"
          className="text-[1.25rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.4rem]"
        >
          {SETTINGS_PAGE_STRINGS.directoryTitle}
        </h2>
        <p className="font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">
          {groups.reduce((total, group) => total + group.destinations.length, 0)} settings ·{" "}
          {groups.length} {groups.length === 1 ? "group" : "groups"}
        </p>
      </header>
      <div className="space-y-7">
        {groups.map((group) => (
          <section key={group.key} aria-labelledby={`settings-group-${group.key}`}>
            <header className="mb-2 flex items-baseline gap-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_75%,transparent)] pb-2.5">
              <h3
                id={`settings-group-${group.key}`}
                className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]"
              >
                {group.title}
              </h3>
              <span className="ml-auto font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">
                {group.destinations.length}
              </span>
            </header>
            <ul className="flex flex-col">
              {group.destinations.map((destination) => (
                <li
                  key={destination.key}
                  className="group flex items-start gap-4 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_50%,transparent)] py-2.5 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <p className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
                        {destination.title}
                      </p>
                      {destination.currentStateLabel ? (
                        <span
                          className={`inline-flex max-w-full rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(destination.statusTone)}`}
                        >
                          <span className="truncate">{destination.currentStateLabel}</span>
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-tertiary)]">
                      {destination.noteLabel ?? destination.unavailableReason ?? destination.description}
                    </p>
                  </div>
                  <div className="shrink-0 pt-0.5">
                    <DestinationAction
                      destination={destination}
                      className="ui-link inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}

export function SettingsAttentionSummary({ summary }: { summary: SettingsStatusSummary }) {
  if (summary.items.length === 0) return null;
  return (
    <section aria-label="Workspace settings attention" className="rounded-xl border border-[color:color-mix(in_oklab,var(--warning-soft)_72%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_58%,var(--canvas))] px-4 py-3">
      <ul className="divide-y divide-[color:color-mix(in_oklab,var(--warning-soft)_72%,transparent)]">
        {summary.items.map((item) => (
          <li key={item.key} className="flex flex-col gap-2 py-2 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--warning-ink)]">{item.label}: {item.value}</p>
              <p className="text-xs text-[var(--warning-ink)]">{item.impact}</p>
            </div>
            <SettingsActionLink href={item.href} className="shrink-0 text-xs font-semibold text-[var(--warning-ink)] underline underline-offset-2">
              {item.actionLabel}
            </SettingsActionLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function WorkspaceIdentitySection(props: { organizationId: string; orgName: string; roleLabel: string; isAdmin: boolean }) {
  return (
    <section id="workspace-identity" tabIndex={-1} className="ui-card scroll-mt-6 overflow-hidden p-0 outline-none">
      <header className="flex flex-col gap-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Workspace
          </p>
          <h2 className="mt-1 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]">
            Workspace identity
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
            Used in navigation, invites, exports, and billing.
          </p>
        </div>
        <span className="inline-flex shrink-0 self-start items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)] sm:self-auto">
          {props.roleLabel}
        </span>
      </header>
      <div className="p-5">
        <OrgForm organizationId={props.organizationId} name={props.orgName} isAdmin={props.isAdmin} />
      </div>
    </section>
  );
}

export function AccessManagementSection(props: { members: OrganizationMember[]; organizationId: string; roleLabels: Record<string, string>; canInvite: boolean; pendingInvites: PendingInviteRow[] }) {
  return (
    <section id="team-access" tabIndex={-1} className="ui-card scroll-mt-6 overflow-hidden p-0 outline-none">
      <header className="flex flex-col gap-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Access
          </p>
          <h2 className="mt-1 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]">
            Team access
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
            Review {props.members.length} team member{props.members.length === 1 ? "" : "s"}, roles, invitations, and pending access.
          </p>
        </div>
        <span className="inline-flex shrink-0 self-start items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)] sm:self-auto">
          {props.members.length} {props.members.length === 1 ? "member" : "members"}
        </span>
      </header>
      <div className="space-y-4 p-5">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_34%,transparent)]">
          <div className="grid grid-cols-1 gap-2 border-b border-[var(--border-subtle)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)] sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.35fr)_auto]">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]/70">
            {props.members.map((m) => (
              <div
                key={m.id}
                className="grid grid-cols-1 gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.35fr)_auto] sm:items-center"
              >
                <div>
                  <p className="sm:hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                    Name
                  </p>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {m.profiles?.full_name || m.profiles?.email || "Member"}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="sm:hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                    Email
                  </p>
                  <p className="break-words font-mono text-[12.5px] text-[var(--text-secondary)]">
                    {m.profiles?.email || "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="sm:hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                    Role
                  </p>
                  <span className="inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                    {props.roleLabels[m.role] || m.role}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        {props.canInvite ? (
          <div className="space-y-4">
            <InviteMemberForm organizationId={props.organizationId} />
            {props.pendingInvites.length > 0 ? <PendingInvitesList invites={props.pendingInvites} /> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function ProfileSettingsSection({ fullName, email, joinedAt }: { fullName: string | null; email: string; joinedAt?: string | null }) {
  return (
    <section id="profile" tabIndex={-1} className="ui-card scroll-mt-6 overflow-hidden p-0 outline-none">
      <header className="flex flex-col gap-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Account
          </p>
          <h2 className="mt-1 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]">
            Your profile
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
            Update how your name appears across workspace activity.
          </p>
        </div>
        {joinedAt ? (
          <span className="inline-flex shrink-0 self-start items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)] sm:self-auto">
            Joined
            <span className="font-mono normal-case tracking-normal text-[var(--text-tertiary)]">
              {format(new Date(joinedAt), "MMM d, yyyy")}
            </span>
          </span>
        ) : null}
      </header>
      <div className="p-5">
        <ProfileForm fullName={fullName} email={email} />
      </div>
    </section>
  );
}
