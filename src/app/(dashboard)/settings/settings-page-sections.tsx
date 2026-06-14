import {
  Building2,
  UserRound,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { ProfileForm } from "@/components/settings/profile-form";
import { OrgForm } from "@/components/settings/org-form";
import { InviteMemberForm } from "@/components/settings/invite-member-form";
import { PendingInvitesList, type PendingInviteRow } from "@/components/settings/pending-invites";
import { TimeChip } from "@/components/ui/time-chip";
import { UiAvatar } from "@/components/ui/ui-avatar";
import type { OrganizationMember } from "@/lib/types";
import { CARD_HEADER_BORDER, IconTile, ROW_HOVER } from "./settings-directory-sections";

export { SettingsAttentionSummary, SettingsDirectory } from "./settings-directory-sections";

// Shared card-header eyebrow + icon tile + title + lead for the inline editor
// cards. Keeps the three editors (Workspace / Profile / Team) on one header
// recipe (§10.16). `meta` renders an optional top-right metadata chip
// (§11.3 items-start so it top-aligns with the title block, never diagonally).
function EditorCardHeader({
  icon,
  eyebrow,
  title,
  lead,
  meta,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  lead: string;
  meta?: ReactNode;
}) {
  return (
    <header className={`flex items-start gap-3 border-b ${CARD_HEADER_BORDER} px-5 py-3.5 sm:gap-3.5`}>
      <IconTile>{icon}</IconTile>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="ui-caps-1 text-[11px] text-[var(--accent-strong)]">{eyebrow}</p>
          <h2 className="mt-0.5 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
          <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--text-secondary)]">{lead}</p>
        </div>
        {meta ? <div className="shrink-0 self-start sm:self-auto">{meta}</div> : null}
      </div>
    </header>
  );
}

const EDITOR_ICON_CLASS = "h-[1.05rem] w-[1.05rem]";

export function WorkspaceIdentitySection(props: { organizationId: string; orgName: string; isAdmin: boolean }) {
  // §10.6 — editors use the lighter `.ui-card`, leaving Team access as the one
  // raised focal surface on the page.
  return (
    <section id="workspace-identity" tabIndex={-1} className="ui-card flex scroll-mt-24 flex-col overflow-hidden p-0 outline-none">
      <EditorCardHeader
        icon={<Building2 className={EDITOR_ICON_CLASS} strokeWidth={1.85} />}
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
    <section id="profile" tabIndex={-1} className="ui-card flex scroll-mt-24 flex-col overflow-hidden p-0 outline-none">
      <EditorCardHeader
        icon={<UserRound className={EDITOR_ICON_CLASS} strokeWidth={1.85} />}
        eyebrow="Account"
        title="Your profile"
        lead="Update how your name appears across workspace activity."
        meta={
          joinedValid ? (
            // §10.12-adjacent — a compact "Joined MAY 30" chip, not a large
            // all-caps key-value pill competing with the title.
            <span className="inline-flex items-center gap-1.5">
              <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">Joined</span>
              <TimeChip date={joinedAt} format="calendar" bordered />
            </span>
          ) : undefined
        }
      />
      <div className="flex-1 p-5">
        <ProfileForm fullName={fullName} email={email} />
      </div>
    </section>
  );
}

// Consistent role pill — fixed height, neutral tones. Owner/Admin carry a faint
// accent tint so the privileged roles read as distinct from Member/Viewer
// WITHOUT borrowing status colors (those stay reserved for real state).
function RoleBadge({ label }: { label: string }) {
  const emphatic = label === "Owner" || label === "Admin";
  return (
    <span
      className={`ui-caps-2 inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] ${
        emphatic
          ? "border-[color:color-mix(in_oklab,var(--accent)_18%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_10%,var(--surface-raised))] text-[var(--text-primary)]"
          : "border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-secondary)]"
      }`}
    >
      {label}
    </span>
  );
}

// Quieter current-user marker — sentence case, accent outline, no caps shouting.
function YouChip() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-subtle))] px-1.5 py-0.5 text-[10px] font-medium leading-none text-[var(--accent-strong)]">
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
    // §10.6 — the single raised focal surface on the page.
    <section id="team-access" tabIndex={-1} className="ui-card-raised scroll-mt-24 overflow-hidden p-0 outline-none">
      <EditorCardHeader
        icon={<Users className={EDITOR_ICON_CLASS} strokeWidth={1.85} />}
        eyebrow="Access"
        title="Team access"
        lead={`Review ${props.members.length} team ${memberWord}, roles, invitations, and pending access.`}
        meta={
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            <span className="tabular-nums">{props.members.length}</span> {memberWord}
          </span>
        }
      />
      <div className="p-5">
        {/* §10.5 — flat hairline ledger, not a nested card. An avatar-led grid
            reflows from a 4-column table on sm+ (avatar / name / email / role)
            to a stacked 2-line member card on narrow screens. */}
        <div>
          {/* Leading spacer column matches the avatar so the headers line up
              with the row content across the separate grids. */}
          <div className="hidden border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] pb-2 sm:grid sm:grid-cols-[2rem_10rem_minmax(0,1fr)_9rem] sm:gap-x-4">
            <span aria-hidden />
            <span className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">Name</span>
            <span className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">Email</span>
            <span className="ui-caps-2 justify-self-end text-[10px] text-[var(--text-tertiary)]">Role</span>
          </div>
          <ul role="list" className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]">
            {props.members.map((m) => {
              const isCurrent = props.currentUserId != null && m.user_id === props.currentUserId;
              const name = m.profiles?.full_name?.trim() || null;
              const email = m.profiles?.email || "";
              return (
                <li
                  key={m.id}
                  className={`group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 py-2.5 transition-colors ${ROW_HOVER} sm:grid-cols-[2rem_10rem_minmax(0,1fr)_9rem] sm:gap-x-4`}
                >
                  {/* Reserved avatar slot on every row keeps names + emails aligned. */}
                  <span className="col-start-1 row-start-1 row-span-2 self-center sm:row-span-1">
                    <UiAvatar name={name} email={email || null} size="sm" />
                  </span>
                  <div className="col-start-2 row-start-1 flex min-w-0 items-center gap-2">
                    {name ? (
                      <span className="truncate text-[13.5px] font-medium text-[var(--text-primary)]">{name}</span>
                    ) : (
                      // Joined member who hasn't set a name yet.
                      <span className="truncate text-[13px] text-[var(--text-tertiary)]">Unnamed member</span>
                    )}
                    {isCurrent ? <YouChip /> : null}
                  </div>
                  <div className="col-start-3 row-start-1 justify-self-end sm:col-start-4">
                    <RoleBadge label={props.roleLabels[m.role] || m.role} />
                  </div>
                  <p
                    title={email || undefined}
                    className="col-start-2 col-span-2 row-start-2 min-w-0 truncate font-mono text-[12px] text-[var(--text-secondary)] sm:col-start-3 sm:col-span-1 sm:row-start-1 sm:justify-self-start"
                  >
                    {email || "—"}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
        {/* InviteMemberForm + PendingInvitesList each own their `border-t pt-5`
            divider, so no extra top margin is needed here (kept the gap tight). */}
        {props.canInvite ? (
          <>
            <InviteMemberForm organizationId={props.organizationId} />
            {props.pendingInvites.length > 0 ? <PendingInvitesList invites={props.pendingInvites} /> : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
