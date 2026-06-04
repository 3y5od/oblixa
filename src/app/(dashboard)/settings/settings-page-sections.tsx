import { format } from "date-fns";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { ProfileForm } from "@/components/settings/profile-form";
import { OrgForm } from "@/components/settings/org-form";
import { InviteMemberForm } from "@/components/settings/invite-member-form";
import { PendingInvitesList, type PendingInviteRow } from "@/components/settings/pending-invites";
import { ExternalLink } from "@/components/ui/external-link";
import { KeyValueChip } from "@/components/ui/key-value-chip";
import type { OrganizationMember } from "@/lib/types";
import { SETTINGS_PAGE_STRINGS } from "@/lib/settings/spec-strings";
import type { SettingsDestination, SettingsDestinationGroup, SettingsStatusSummary } from "@/lib/workspace-settings-model";
import { SettingsAnchorLink } from "./settings-anchor-link";

// §2.6 structured action chip — accent-tinted but QUIET at rest (no filled
// accent bg) so the row's title stays the dominant element (§10.7). The parent
// row (`.group`) brightens the border + nudges the arrow on hover so the whole
// row reads as one affordance.
const ACTION_CHIP_CLASS =
  "ui-chip-focus inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--accent)_18%,var(--border-subtle))] bg-[var(--surface-raised)] px-2.5 py-1 text-[12px] font-semibold text-[var(--accent-strong)] transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_40%,var(--border-subtle))] hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,var(--surface-raised))] group-hover:border-[color:color-mix(in_oklab,var(--accent)_32%,var(--border-subtle))]";

// Same chip, but its `::before` stretches over the whole `.relative` row so the
// entire row is one click target (the chip stays the visible affordance). Only
// applied to navigable rows — read-only rows render a quiet, non-clickable state.
const ROW_ACTION_CLASS = `${ACTION_CHIP_CLASS} before:absolute before:inset-0 before:rounded-xl before:content-['']`;

const QUIET_STATE_CLASS = "ui-caps-2 shrink-0 text-[10.5px] text-[var(--text-tertiary)]";

const CARD_HEADER_BORDER =
  "border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)]";
const HAIRLINE = "border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]";
const ROW_HOVER = "hover:bg-[color:color-mix(in_oklab,var(--surface-raised)_55%,transparent)]";

function ActionArrow() {
  return (
    <ArrowRight
      className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
      strokeWidth={2}
      aria-hidden
    />
  );
}

function DestinationAction({ destination }: { destination: SettingsDestination }) {
  if (destination.state === "read_only") {
    return <span className={QUIET_STATE_CLASS}>Read-only</span>;
  }
  if (destination.state === "unavailable") {
    const label = destination.fallbackActionLabel ?? destination.actionLabel;
    const href = destination.fallbackHref ?? destination.href;
    if (!destination.fallbackHref && !href.startsWith("#")) {
      return <span className={QUIET_STATE_CLASS}>{label}</span>;
    }
    if (href.startsWith("#")) {
      return (
        <SettingsAnchorLink href={href as `#${string}`} className={ROW_ACTION_CLASS}>
          {label}
          <ActionArrow />
        </SettingsAnchorLink>
      );
    }
    return (
      <Link href={href} className={ROW_ACTION_CLASS}>
        {label}
        <ActionArrow />
      </Link>
    );
  }
  if (destination.href.startsWith("/api/")) {
    return (
      <ExternalLink href={destination.href} className={ROW_ACTION_CLASS}>
        {destination.actionLabel}
      </ExternalLink>
    );
  }
  if (destination.href.startsWith("#")) {
    return (
      <SettingsAnchorLink href={destination.href as `#${string}`} className={ROW_ACTION_CLASS}>
        {destination.actionLabel}
        <ActionArrow />
      </SettingsAnchorLink>
    );
  }
  return (
    <Link href={destination.href} className={ROW_ACTION_CLASS}>
      {destination.actionLabel}
      <ActionArrow />
    </Link>
  );
}

function SettingsActionLink({ href, children, className }: { href: string; children: ReactNode; className: string }) {
  if (href.startsWith("#")) {
    return <SettingsAnchorLink href={href as `#${string}`} className={className}>{children}</SettingsAnchorLink>;
  }
  return <Link href={href} className={className}>{children}</Link>;
}

// Normalized directory row tag (§2.6). Neutral tags recede to a quiet,
// fill-less pill so they stay visually secondary to the row title; only
// real attention/healthy state earns a tint.
function DirectoryTag({ label, tone }: { label: string; tone?: SettingsDestination["statusTone"] }) {
  const toneClass =
    tone === "attention"
      ? "border-[color:color-mix(in_oklab,var(--warning)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_24%,var(--surface-raised))] text-[var(--warning-ink)]"
      : tone === "healthy"
        ? "border-[color:color-mix(in_oklab,var(--success)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-soft)_24%,var(--surface-raised))] text-[var(--success-ink)]"
        : "border-[var(--border-subtle)] bg-transparent text-[var(--text-tertiary)]";
  return (
    <span
      className={`ui-caps-3 inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[10px] ${toneClass}`}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}

export function SettingsDirectory({ groups }: { groups: SettingsDestinationGroup[] }) {
  const totalCount = groups.reduce((total, group) => total + group.destinations.length, 0);
  return (
    <section aria-labelledby="settings-directory-title">
      {/* §2.6 — count chips sit immediately beside the heading so they read as
          attached metadata, not free-floating counters on the far right. */}
      {/* §2.6 — count chips baseline-align to the heading so they read as
          attached metadata, not free-floating counters. */}
      <header className="mb-4 flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5">
          <h2
            id="settings-directory-title"
            className="text-[1.25rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.4rem]"
          >
            {SETTINGS_PAGE_STRINGS.directoryTitle}
          </h2>
          <span className="inline-flex items-center gap-1.5">
            <KeyValueChip label="Settings" value={totalCount} />
            <KeyValueChip label="Groups" value={groups.length} />
          </span>
        </div>
        <p className="text-[12.5px] leading-snug text-[var(--text-secondary)]">
          Open a dedicated area for each setting.
        </p>
      </header>
      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group.key} aria-labelledby={`settings-group-${group.key}`}>
            <header className={`mb-1 border-b ${HAIRLINE} pb-2`}>
              <h3
                id={`settings-group-${group.key}`}
                className="ui-caps-1 text-[11px] text-[var(--text-tertiary)]"
              >
                {group.title}
              </h3>
            </header>
            <ul className="flex flex-col">
              {group.destinations.map((destination) => (
                <li
                  key={destination.key}
                  className={`group relative flex items-center gap-4 border-b ${HAIRLINE} py-2.5 transition-colors last:border-b-0 sm:min-h-[3rem] ${ROW_HOVER} focus-within:bg-[color:color-mix(in_oklab,var(--surface-raised)_55%,transparent)]`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
                        {destination.title}
                      </p>
                      {destination.currentStateLabel ? (
                        <DirectoryTag label={destination.currentStateLabel} tone={destination.statusTone} />
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[12px] leading-snug text-[var(--text-secondary)]">
                      {destination.noteLabel ?? destination.unavailableReason ?? destination.description}
                    </p>
                  </div>
                  {/* No `relative` here — the chip's stretched ::before must
                      anchor to the `.relative` <li> to cover the whole row. */}
                  <div className="shrink-0">
                    <DestinationAction destination={destination} />
                  </div>
                </li>
              ))}
            </ul>
            {group.description ? (
              <p className="mt-2 text-[11.5px] leading-snug text-[var(--text-tertiary)]">
                {group.description}
              </p>
            ) : null}
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

// Shared card-header eyebrow + title + lead for the inline editor cards. Keeps
// the three editors (Workspace / Profile / Team) on an identical header recipe
// (§10.16). `meta` renders an optional top-right metadata chip (§11.3 items-start).
function EditorCardHeader({
  eyebrow,
  title,
  lead,
  meta,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  meta?: ReactNode;
}) {
  return (
    <header className={`flex flex-col gap-2 border-b ${CARD_HEADER_BORDER} px-5 py-4 sm:flex-row sm:items-start sm:justify-between`}>
      <div className="min-w-0">
        <p className="ui-caps-1 text-[11px] text-[var(--accent-strong)]">{eyebrow}</p>
        <h2 className="mt-1 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">{lead}</p>
      </div>
      {meta ? <div className="shrink-0 self-start sm:self-auto">{meta}</div> : null}
    </header>
  );
}

export function WorkspaceIdentitySection(props: { organizationId: string; orgName: string; isAdmin: boolean }) {
  return (
    <section id="workspace-identity" tabIndex={-1} className="ui-card-raised flex scroll-mt-6 flex-col overflow-hidden p-0 outline-none">
      {/* §10.4 — role badge dropped; the page-header Role chip already states
          the viewer's role, so repeating it here is redundant. */}
      <EditorCardHeader
        eyebrow="Workspace"
        title="Workspace identity"
        lead="Used in navigation, invites, exports, and billing."
      />
      <div className="flex-1 p-5">
        <OrgForm organizationId={props.organizationId} name={props.orgName} isAdmin={props.isAdmin} />
      </div>
    </section>
  );
}

export function ProfileSettingsSection({ fullName, email, joinedAt }: { fullName: string | null; email: string; joinedAt?: string | null }) {
  const joinedDate = joinedAt ? new Date(joinedAt) : null;
  const joinedValid = joinedDate && Number.isFinite(joinedDate.getTime());
  return (
    <section id="profile" tabIndex={-1} className="ui-card-raised flex scroll-mt-6 flex-col overflow-hidden p-0 outline-none">
      <EditorCardHeader
        eyebrow="Account"
        title="Your profile"
        lead="Update how your name appears across workspace activity."
        meta={
          joinedValid ? (
            <KeyValueChip label="Joined" value={format(joinedDate as Date, "MMM d, yyyy")} />
          ) : undefined
        }
      />
      <div className="flex-1 p-5">
        <ProfileForm fullName={fullName} email={email} />
      </div>
    </section>
  );
}

// Consistent role pill — fixed height + tone, width tracks the label but never
// wraps. Shared by every member row so the Role column reads as one vocabulary.
function RoleBadge({ label }: { label: string }) {
  return (
    <span className="ui-caps-2 inline-flex items-center whitespace-nowrap rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
      {label}
    </span>
  );
}

function YouChip() {
  return (
    <span className="ui-caps-3 inline-flex shrink-0 items-center rounded-full border border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,var(--surface-raised))] px-1.5 py-0.5 text-[9.5px] text-[var(--accent-strong)]">
      You
    </span>
  );
}

export function AccessManagementSection(props: {
  members: OrganizationMember[];
  organizationId: string;
  roleLabels: Record<string, string>;
  canInvite: boolean;
  pendingInvites: PendingInviteRow[];
  currentUserId?: string;
}) {
  const memberWord = props.members.length === 1 ? "member" : "members";
  return (
    <section id="team-access" tabIndex={-1} className="ui-card-raised scroll-mt-6 overflow-hidden p-0 outline-none">
      <EditorCardHeader
        eyebrow="Access"
        title="Team access"
        lead={`Review ${props.members.length} team ${memberWord}, roles, invitations, and pending access.`}
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            {props.members.length} {memberWord}
          </span>
        }
      />
      <div className="p-5">
        {/* §10.5 — flat hairline ledger, not a nested card. A reflowing grid
            renders as a 3-column table on sm+ (Name / Email / Role) and as a
            compact 2-line member card on narrow screens (§11.* responsive). */}
        <div>
          {/* Fixed name + role columns keep the email column left-aligned and
              close to the names (a 1fr name column let it float centered), and
              keep the header aligned with the rows across the separate grids. */}
          <div className="hidden border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] pb-2 sm:grid sm:grid-cols-[10rem_minmax(0,1fr)_9rem] sm:gap-x-5">
            <span className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">Name</span>
            <span className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">Email</span>
            <span className="ui-caps-2 justify-self-end text-[10px] text-[var(--text-tertiary)]">Role</span>
          </div>
          <ul role="list" className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]">
            {props.members.map((m) => {
              const isCurrent = props.currentUserId != null && m.user_id === props.currentUserId;
              return (
                <li
                  key={m.id}
                  className={`group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2.5 transition-colors ${ROW_HOVER} sm:min-h-[2.75rem] sm:grid-cols-[10rem_minmax(0,1fr)_9rem] sm:gap-x-5 sm:py-2`}
                >
                  <div className="order-1 flex min-w-0 items-center gap-2">
                    {m.profiles?.full_name ? (
                      <span className="truncate text-[13.5px] font-medium text-[var(--text-primary)]">
                        {m.profiles.full_name}
                      </span>
                    ) : (
                      // Joined member who hasn't set a name — name the state
                      // explicitly rather than a bare em-dash in an identity row.
                      <span className="truncate text-[13px] text-[var(--text-tertiary)]">No name yet</span>
                    )}
                    {isCurrent ? <YouChip /> : null}
                  </div>
                  <div className="order-2 justify-self-end sm:order-3">
                    <RoleBadge label={props.roleLabels[m.role] || m.role} />
                  </div>
                  <p
                    title={m.profiles?.email || undefined}
                    className="order-3 col-span-2 min-w-0 truncate font-mono text-[12.5px] text-[var(--text-secondary)] sm:order-2 sm:col-span-1 sm:justify-self-start"
                  >
                    {m.profiles?.email || "—"}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
        {props.canInvite ? (
          <div className="mt-5 space-y-5">
            <InviteMemberForm organizationId={props.organizationId} />
            {props.pendingInvites.length > 0 ? <PendingInvitesList invites={props.pendingInvites} /> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
