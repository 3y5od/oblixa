import Link from "next/link";
import { Copy, FileQuestion, Timer, UserRoundX, Users } from "lucide-react";
import { ApiJsonLink } from "@/components/ui/api-json-link";
import { UiSelect } from "@/components/ui/ui-select";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import { CampaignRollbackButton } from "@/components/campaign-maintenance-actions";
import { reassignOwnerForm } from "@/actions/maintenance";
import { createCampaignAction, runCampaignAction } from "./maintenance-campaign-actions";

type CampaignRow = {
  id: string;
  name: string;
  campaign_type: string;
  status: string;
  rolled_back_at: string | null;
  last_preview_at: string | null;
};

type StaleContractRow = {
  id: string;
  title: string;
  updated_at: string;
};

type OwnerlessContractRow = {
  id: string;
  title: string;
};

type MemberOption = {
  id: string;
  label: string;
};

export function MaintenanceHygieneBacklog({
  staleContractsCount,
  staleContractDays,
  missingOwnerCount,
  staleOwnershipCount,
  staleOwnershipDays,
  duplicateGroupCount,
  orphanedCount,
}: {
  staleContractsCount: number;
  staleContractDays: number;
  missingOwnerCount: number;
  staleOwnershipCount: number;
  staleOwnershipDays: number;
  duplicateGroupCount: number;
  orphanedCount: number;
}) {
  return (
    <section className="space-y-3">
      <div>
        <p className="ui-eyebrow">Signals</p>
        <h2 className="ui-page-title mt-2 text-[1.8rem]">Hygiene backlog</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <OperationalSummaryCard
          eyebrow="Freshness"
          headline="Stale records"
          tone={staleContractsCount > 0 ? "attention" : "healthy"}
          icon={Timer}
          primaryValue={staleContractsCount}
          primaryUnit={`>${staleContractDays}d idle`}
          action={{ href: "/contracts/maintenance", label: "Review list" }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Ownership"
          headline="Ownerless"
          tone={missingOwnerCount > 0 ? "risk" : "healthy"}
          icon={UserRoundX}
          primaryValue={missingOwnerCount}
          primaryUnit="no owner_id"
          action={{ href: "/contracts/maintenance", label: "Assign owners" }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Ownership"
          headline="Stale assignment"
          tone={staleOwnershipCount > 0 ? "attention" : "healthy"}
          icon={Users}
          primaryValue={staleOwnershipCount}
          primaryUnit={`>${staleOwnershipDays}d on owner`}
          action={{ href: "/contracts/maintenance", label: "Refresh owners" }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Deduping"
          headline="Duplicate groups"
          tone={duplicateGroupCount > 0 ? "attention" : "healthy"}
          icon={Copy}
          primaryValue={duplicateGroupCount}
          primaryUnit="title + counterparty"
          action={{ href: "/contracts/maintenance", label: "Resolve duplicates" }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Files"
          headline="Orphaned files"
          tone={orphanedCount > 0 ? "attention" : "healthy"}
          icon={FileQuestion}
          primaryValue={orphanedCount}
          primaryUnit="missing valid link"
          action={{ href: "/contracts/maintenance", label: "Clean files" }}
          variant="compact"
        />
      </div>
    </section>
  );
}

export function MaintenanceCampaignsSection({ campaigns }: { campaigns: CampaignRow[] }) {
  return (
    <section className="ui-page-shell overflow-hidden">
      <div className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--canvas))] px-6 py-4">
        <h2 className="ui-section-title text-base">Maintenance campaigns</h2>
        <p className="ui-support-copy mt-1">Create and run remediation batches from the same surface used to inspect stale records and correction demand.</p>
      </div>
      <div className="grid gap-4 p-6 md:grid-cols-2">
        <form action={createCampaignAction} className="ui-card-quiet space-y-2 p-4">
          <p className="ui-label-caps">Create campaign</p>
          <input aria-label="Q2 owner backfill" name="name" className="ui-input w-full" placeholder="Q2 owner backfill" required />
          <UiSelect
            name="campaignType"
            defaultValue="data_remediation"
            ariaLabel="Campaign type"
            options={[
              { value: "data_remediation", label: "data remediation" },
              { value: "owner_reassignment", label: "owner reassignment" },
              { value: "policy_backfill", label: "policy backfill" },
            ]}
            variant="compact"
            portal
            className="w-full"
            buttonClassName="w-full !min-h-11"
          />
          <textarea aria-label="Seed contract IDs" name="seedContractIds" className="ui-input min-h-[72px] w-full" placeholder="Optional contract IDs (comma/newline separated)" />
          <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
            Create draft campaign
          </button>
        </form>
        <div className="ui-card-quiet p-4">
          <p className="ui-label-caps">Campaign history</p>
          <ul className="mt-2 space-y-2">
            {campaigns.length === 0 ? (
              <li className="text-sm text-[var(--text-tertiary)]">No campaigns created yet.</li>
            ) : (
              campaigns.map((campaign) => (
                <li key={campaign.id} className="rounded border border-[var(--border-subtle)] px-3 py-2 text-sm">
                  <p className="font-medium text-[var(--text-primary)]">{campaign.name}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {campaign.campaign_type} - {campaign.status}
                    {campaign.rolled_back_at ? " - rolled back" : ""}
                  </p>
                  {campaign.last_preview_at ? (
                    <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                      Last preview: {new Date(campaign.last_preview_at).toLocaleString()}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <ApiJsonLink
                      href={`/api/maintenance/campaigns/${campaign.id}/preview`}
                      className="ui-btn-secondary inline-block px-3 py-1.5 text-xs"
                    >
                      Preview row counts
                    </ApiJsonLink>
                    <CampaignRollbackButton campaignId={campaign.id} />
                  </div>
                  {campaign.status !== "completed" ? (
                    <form action={runCampaignAction} className="mt-2">
                      <input type="hidden" name="campaignId" value={campaign.id} />
                      <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
                        Run campaign
                      </button>
                    </form>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function StaleContractsSection({ rows }: { rows: StaleContractRow[] }) {
  return (
    <section className="ui-card overflow-hidden">
      <div className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--canvas))] px-6 py-4">
        <h2 className="ui-section-title text-base">Stale active/review records</h2>
      </div>
      <ul className="divide-y divide-[var(--border-subtle)]">
        {rows.length === 0 ? (
          <li className="px-6 py-4 text-sm text-[var(--text-tertiary)]">No stale records.</li>
        ) : (
          rows.map((row) => (
            <li key={row.id} className="px-6 py-3">
              <Link href={`/contracts/${row.id}`} className="ui-link text-sm">
                {row.title}
              </Link>
              <p className="text-xs text-[var(--text-tertiary)]">{new Date(row.updated_at).toISOString().slice(0, 10)}</p>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

export function OwnerlessContractsSection({
  rows,
  members,
}: {
  rows: OwnerlessContractRow[];
  members: MemberOption[];
}) {
  return (
    <section className="ui-card overflow-hidden">
      <div className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--canvas))] px-6 py-4">
        <h2 className="ui-section-title text-base">Ownerless contracts (reassign)</h2>
      </div>
      <ul className="divide-y divide-[var(--border-subtle)]">
        {rows.length === 0 ? (
          <li className="px-6 py-4 text-sm text-[var(--text-tertiary)]">No ownerless records.</li>
        ) : (
          rows.slice(0, 20).map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 px-6 py-3">
              <Link href={`/contracts/${row.id}`} className="ui-link text-sm">
                {row.title}
              </Link>
              <form action={reassignOwnerForm} className="flex items-center gap-2">
                <input type="hidden" name="contractId" value={row.id} />
                <UiSelect
                  name="ownerId"
                  defaultValue={members[0]?.id ?? ""}
                  ariaLabel={`Owner for ${row.title}`}
                  options={members.map((m) => ({ value: m.id, label: m.label }))}
                  variant="compact"
                  portal
                  searchThreshold={8}
                  className="min-w-[12rem]"
                  buttonClassName="w-full !min-h-11 text-xs"
                />
                <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
                  Assign
                </button>
              </form>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
