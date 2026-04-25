import Link from "next/link";
import { AlertTriangle, FileStack, Library, ShieldCheck } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { createEvidenceTemplateAction } from "@/actions/v4";
import {
  getEvidenceRequirementStatusLabel,
  getEvidenceRequirementTypeLabel,
} from "@/lib/evidence-display";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { EmptyState } from "@/components/ui/empty-state";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";

export const metadata = { title: "Evidence studio" };

export default async function EvidenceStudioPage() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return (
      <WorkspaceRequiredState
        title="Workspace required for evidence"
        message="Evidence queues and template libraries are workspace-scoped. Refresh this page, then ask a workspace admin to restore access if this studio still does not load."
      />
    );
  }

  const templatesResult = await ctx.admin
    .from("evidence_requirement_templates")
    .select("id, name, requirement_type, created_at")
    .eq("organization_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(50);
  const templates = templatesResult.error ? [] : templatesResult.data ?? [];
  const queueResult = await ctx.admin
    .from("evidence_requirements")
    .select(
      "id, title, requirement_type, status, due_at, review_due_at, contract_id, contracts!inner(id, title)"
    )
    .eq("organization_id", ctx.orgId)
    .in("status", ["required", "submitted", "rejected"])
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(20);
  const liveQueue = queueResult.error ? [] : queueResult.data ?? [];
  const queueLoadFailed = Boolean(queueResult.error);
  const templateLoadFailed = Boolean(templatesResult.error);
  const studioLoadFailed = queueLoadFailed || templateLoadFailed;
  const requiredCount = liveQueue.filter((row) => String(row.status) === "required").length;
  const submittedCount = liveQueue.filter((row) => String(row.status) === "submitted").length;

  async function createTemplateAction(formData: FormData) {
    "use server";
    await createEvidenceTemplateAction(formData);
  }

  return (
    <div className="space-y-8">
      <header className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Evidence</p>
          <h1 className="ui-display-title mt-2">Evidence studio</h1>
          <p className="ui-page-lead mt-3">
            Active evidence requests first, reusable templates second, and contract-level exports when you need the full pack.
          </p>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OperationalSummaryCard
          eyebrow="Queue"
          headline="Active requests"
          tone={liveQueue.length > 0 ? "attention" : "healthy"}
          icon={FileStack}
          primaryValue={liveQueue.length}
          primaryUnit="in studio"
          action={{ href: "/contracts?evidence=outstanding", label: "Open evidence gaps" }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Waiting"
          headline="Required"
          tone={requiredCount > 0 ? "attention" : "healthy"}
          icon={AlertTriangle}
          primaryValue={requiredCount}
          primaryUnit="still requested"
          action={{ href: "/contracts?evidence=outstanding", label: "Review required" }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Review"
          headline="Submitted"
          tone={submittedCount > 0 ? "neutral" : "healthy"}
          icon={ShieldCheck}
          primaryValue={submittedCount}
          primaryUnit="awaiting review"
          action={{ href: "/contracts/evidence-studio", label: "Review submissions" }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Library"
          headline="Templates"
          tone="neutral"
          icon={Library}
          primaryValue={templates.length}
          primaryUnit="saved templates"
          action={{ href: "/contracts/evidence-studio#template-library", label: "Open templates" }}
          variant="compact"
        />
      </section>

      <section id="live-request-queue" className="ui-page-shell">
        <div className="mb-3 space-y-1">
          <p className="ui-eyebrow">Live request queue</p>
          <h2 className="ui-section-title">Evidence requests</h2>
          <p className="ui-support-copy">Use the studio as the top-level queue for required, submitted, and rejected evidence work before dropping into individual contracts.</p>
        </div>
        {studioLoadFailed ? (
          <div className="mt-3">
            <EmptyState
              eyebrow="Recovery"
              title="Evidence data could not fully load"
              copy="Some evidence requests or templates are temporarily unavailable. Open the contracts workspace or outstanding evidence slice while this studio data recovers."
              action={
                <>
                  <Link href="/contracts?evidence=outstanding" className="ui-btn-primary px-4 py-2 text-[13px]">
                    Open outstanding evidence gaps
                  </Link>
                  <Link href="/contracts" className="ui-btn-secondary px-4 py-2 text-[13px]">
                    Browse contracts
                  </Link>
                </>
              }
            />
          </div>
        ) : null}
        <ul className="mt-3 space-y-2 text-sm">
          {liveQueue.length === 0 ? (
            <li>
              <EmptyState
                eyebrow="Live queue"
                title="No active evidence requests"
                copy="When evidence is requested, submitted, or rejected, the live queue appears here with due dates and direct links back to the contract."
                action={
                  <Link href="/contracts?evidence=outstanding" className="ui-btn-secondary px-4 py-2 text-[13px]">
                    Open outstanding evidence gaps
                  </Link>
                }
              />
            </li>
          ) : (
            liveQueue.map((row) => {
              const contractRel = row.contracts as { id: string; title: string } | { id: string; title: string }[];
              const contract = Array.isArray(contractRel) ? contractRel[0] : contractRel;
              const statusLabel = getEvidenceRequirementStatusLabel(String(row.status));
              const requirementTypeLabel = getEvidenceRequirementTypeLabel(String(row.requirement_type));
              return (
                <li key={row.id} className="rounded border border-[var(--border-subtle)] px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[var(--text-primary)]">{row.title}</span>
                    <span className="rounded-full border border-[var(--border-strong)] px-2 py-0.5 text-[11px]">
                      {statusLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                    {requirementTypeLabel}
                    {row.due_at ? ` · due ${String(row.due_at).slice(0, 10)}` : ""}
                    {row.review_due_at ? ` · review by ${String(row.review_due_at).slice(0, 10)}` : ""}
                    {contract?.id ? (
                      <>
                        {" · "}
                        <Link href={`/contracts/${contract.id}?tab=overview#contract-evidence`} className="ui-link">
                          {contract.title}
                        </Link>
                      </>
                    ) : null}
                  </p>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section className="ui-page-shell">
        <div className="mb-3 space-y-1">
          <p className="ui-eyebrow">Create</p>
          <p className="ui-support-copy">Create reusable request templates so evidence collection starts with consistent structure, explanation, and submission expectations.</p>
        </div>
        <p className="ui-label-caps">Create template</p>
        <form action={createTemplateAction} className="mt-3 space-y-2">
          <input name="name" required placeholder="Quarterly attestation pack" className="ui-input w-full max-w-md" />
          <select name="requirementType" className="ui-input w-full max-w-md">
            <option value="document">document</option>
            <option value="structured_form">structured_form</option>
            <option value="comment">comment</option>
            <option value="external_reference">external_reference</option>
            <option value="manager_approval">manager_approval</option>
            <option value="attestation">attestation</option>
          </select>
          <textarea
            name="templateJson"
            rows={4}
            defaultValue='{"description": "Attach signed confirmation", "fields": []}'
            className="ui-input w-full max-w-2xl font-mono text-xs"
          />
          <button type="submit" className="ui-btn-primary px-4 py-2 text-xs">
            Save template
          </button>
        </form>
      </section>

      <section id="template-library" className="ui-page-shell">
        <div className="mb-3 space-y-1">
          <p className="ui-eyebrow">Library</p>
          <p className="ui-support-copy">Templates keep recurring evidence asks consistent across contracts, reviews, and downstream exports.</p>
        </div>
        <p className="ui-label-caps">Templates</p>
        <ul className="mt-3 space-y-2 text-sm">
          {templates.length === 0 ? (
            <li>
              <EmptyState
                eyebrow="Templates"
                title="No evidence templates yet"
                copy="Save a reusable evidence request template here so contract-level requests can start with the right explanation, owner path, and due-state structure."
              />
            </li>
          ) : (
            templates.map((t) => (
              <li key={t.id} className="rounded border border-[var(--border-subtle)] px-3 py-2">
                <span className="font-medium text-[var(--text-primary)]">{t.name}</span>
                <span className="text-xs text-[var(--text-tertiary)]"> · {t.requirement_type}</span>
              </li>
            ))
          )}
        </ul>
        <p className="mt-4 text-xs text-[var(--text-tertiary)]">
          On any contract, use{" "}
          <span className="font-mono text-[var(--text-secondary)]">Download evidence pack (JSON)</span> in the overview workflow card
          to export requirements and submissions.
        </p>
        <Link href="/contracts?evidence=outstanding" className="ui-link mt-2 inline-block text-xs">
          Open outstanding evidence gaps
        </Link>
      </section>
    </div>
  );
}
