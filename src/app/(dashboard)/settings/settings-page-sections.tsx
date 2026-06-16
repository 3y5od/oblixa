import {
  Building2,
  UserRound,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { ProfileForm } from "@/components/settings/profile-form";
import { OrgForm } from "@/components/settings/org-form";
import { InviteMemberForm } from "@/components/settings/invite-member-form";
import { MemberRoleControl } from "@/components/settings/member-role-control";
import { PendingInvitesList, type PendingInviteRow } from "@/components/settings/pending-invites";
import { UiAvatar } from "@/components/ui/ui-avatar";
import type { OrganizationMember } from "@/lib/types";
import { CARD_HEADER_BORDER, IconTile, ROW_HOVER } from "./settings-directory-sections";

export { SettingsAttentionSummary, SettingsDirectory } from "./settings-directory-sections";
export { SettingsSnapshot } from "./settings-snapshot";

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
          {/* Eyebrow is a quiet ink-tertiary category label — blue is reserved
              for primary actions and focus (§10/§32). */}
          <p className="ui-caps-1 text-[11px] text-[var(--text-tertiary)]">{eyebrow}</p>
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
  // §51/§52 — absolute date in account context. A bare "JUN 13" omits the year
  // and reads as ambiguous; "Joined June 13, 2026" cannot be misread.
  const joinedLong = joinedValid
    ? joinedDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;
  return (
    <section id="profile" tabIndex={-1} className="ui-card flex scroll-mt-24 flex-col overflow-hidden p-0 outline-none">
      <EditorCardHeader
        icon={<UserRound className={EDITOR_ICON_CLASS} strokeWidth={1.85} />}
        eyebrow="Account"
        title="Your profile"
        lead="Update how your name appears across workspace activity."
        meta={
          joinedLong ? (
            <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">Joined</span>
              <span className="text-[12px] font-medium tabular-nums text-[var(--text-secondary)]">{joinedLong}</span>
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

// Canonical role badge (§24) — Owner / Admin / Member / Viewer. Sentence case,
// not caps (§31); the emphatic weight on the privileged roles (Owner/Admin)
// reads through ink + border, never a status color (those stay reserved for
// real state).
function RoleBadge({ label }: { label: string }) {
  const emphatic = label === "Owner" || label === "Admin";
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none ${
        emphatic
          ? "border-[var(--border-strong)] bg-[var(--surface-raised)] text-[var(--text-primary)]"
          : "border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-secondary)]"
      }`}
    >
      {label}
    </span>
  );
}

// Quiet current-user marker — sentence case, neutral outline (§23); blue stays
// reserved for actions and focus.
function CurrentUserChip() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-[var(--border-strong)] px-1.5 py-0.5 text-[10.5px] font-medium leading-none text-[var(--text-secondary)]">
      Current user
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
  /** The workspace owner's user id (from organizations.owner_user_id). The
   *  matching member renders the "Owner" role regardless of stored membership
   *  role, so the roster never contradicts the owner-preservation invariant. */
  ownerUserId?: string | null;
  /** When true (Owner/Admin viewer), non-owner member rows expose an inline
   *  role control instead of a read-only badge. */
  canManageMembers?: boolean;
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
      />
      <div className="p-5">
        {/* §10.5 / §16 — flat hairline ledger, not a nested card. An avatar-led
            grid reflows from a 5-column table on sm+ (avatar / member / email /
            workspace role / access state) to a stacked 2-line member card on
            narrow screens. No per-member Actions column: member role changes and
            removal are not yet inline mutations, and invite management lives in
            its own record below. */}
        <div>
          {/* Leading spacer column matches the avatar so the headers line up
              with the row content across the separate grids. */}
          <div className="hidden border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] pb-2 sm:grid sm:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1.3fr)_auto_auto] sm:gap-x-4">
            <span aria-hidden />
            <span className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">Member</span>
            <span className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">Email</span>
            <span className="ui-caps-2 justify-self-end text-[10px] text-[var(--text-tertiary)]">Workspace role</span>
            <span className="ui-caps-2 justify-self-end text-[10px] text-[var(--text-tertiary)]">Access state</span>
          </div>
          <ul role="list" className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]">
            {props.members.map((m) => {
              const isCurrent = props.currentUserId != null && m.user_id === props.currentUserId;
              const isOwner = props.ownerUserId != null && m.user_id === props.ownerUserId;
              const roleLabel = isOwner ? "Owner" : props.roleLabels[m.role] || m.role;
              const name = m.profiles?.full_name?.trim() || null;
              const email = m.profiles?.email || "";
              return (
                <li
                  key={m.id}
                  className={`group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2.5 transition-colors ${ROW_HOVER} sm:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1.3fr)_auto_auto] sm:gap-x-4 sm:gap-y-0`}
                >
                  {/* Reserved avatar slot on every row keeps names + emails aligned. */}
                  <span className="col-start-1 row-start-1 row-span-2 self-center sm:row-span-1">
                    <UiAvatar name={name} email={email || null} size="sm" />
                  </span>
                  <div className="col-start-2 row-start-1 flex min-w-0 items-center gap-2">
                    {name ? (
                      <span className="truncate text-[13.5px] font-medium text-[var(--text-primary)]">{name}</span>
                    ) : (
                      // Joined member who hasn't set a profile name yet — a
                      // recoverable missing-value label, not a pejorative (§22).
                      <span className="truncate text-[13px] text-[var(--text-tertiary)]">No display name</span>
                    )}
                    {isCurrent ? <CurrentUserChip /> : null}
                  </div>
                  <div className="col-start-3 row-start-1 justify-self-end sm:col-start-4">
                    {props.canManageMembers && !isOwner ? (
                      <MemberRoleControl
                        organizationId={props.organizationId}
                        targetUserId={m.user_id}
                        role={m.role}
                        memberLabel={name || email || "this member"}
                        canRemove={!isOwner && !isCurrent}
                      />
                    ) : (
                      <RoleBadge label={roleLabel} />
                    )}
                  </div>
                  <p
                    title={email || undefined}
                    className="col-start-2 row-start-2 min-w-0 truncate font-mono text-[12px] text-[var(--text-secondary)] sm:col-start-3 sm:row-start-1 sm:justify-self-start"
                  >
                    {email || "—"}
                  </p>
                  {/* Active = currently has workspace access, distinct from the
                      pending invites below. Meaning is in the text; the dot only
                      reinforces it (§4). */}
                  <span className="col-start-3 row-start-2 inline-flex items-center gap-1.5 justify-self-end text-[12px] text-[var(--text-secondary)] sm:col-start-5 sm:row-start-1">
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: "var(--success-ink)" }}
                    />
                    Active
                  </span>
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
            {/* §25 — owner-preservation policy stated where team access is
                managed. Roles and removals are owner/admin actions; a workspace
                always keeps at least one Owner. */}
            <p className="mt-4 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] pt-3 text-[11.5px] leading-snug text-[var(--text-tertiary)]">
              Owners and admins manage roles and access. A workspace always keeps at least one Owner.
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}
