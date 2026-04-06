import { getAuthContext } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { FieldReview } from "@/components/contracts/field-review";
import { AddFieldForm } from "@/components/contracts/add-field-form";
import { ExtractButton } from "@/components/contracts/extract-button";
import { DownloadButton } from "@/components/contracts/download-button";
import { UploadMoreFiles } from "@/components/contracts/upload-more-files";
import { OwnerAssignmentForm } from "@/components/contracts/owner-assignment-form";
import { DeleteContractButton } from "@/components/contracts/delete-contract-button";
import { FileText, ArrowLeft, User, Calendar, Bell } from "lucide-react";
import Link from "next/link";
import { STATUS_STYLES, STATUS_LABELS } from "@/lib/contracts";
import { formatFileSize } from "@/lib/format-file-size";
import { ContractStatusTransition } from "@/components/contracts/contract-status-transition";
import { ExtractionJobAlert } from "@/components/contracts/extraction-job-alert";
import { BatchApproveButton } from "@/components/contracts/batch-approve-button";
import { canEditContracts } from "@/lib/permissions";
import type { ContractExtractionJob, OrgRole } from "@/lib/types";

export default async function ContractDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const ctx = await getAuthContext();
  if (!ctx) return null;

  const { orgId, admin, role } = ctx;
  const canEdit = canEditContracts(role as OrgRole);

  const [
    { data: contractData },
    { data: auditEventsData },
    { data: remindersData },
    { data: membersData },
    { data: extractionJobData },
  ] = await Promise.all([
    admin
      .from("contracts")
      .select("*, contract_files(*), extracted_fields(*)")
      .eq("id", id)
      .eq("organization_id", orgId)
      .single(),
    admin
      .from("audit_events")
      .select("*")
      .eq("contract_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("reminders")
      .select("*")
      .eq("contract_id", id)
      .order("reminder_date", { ascending: true }),
    admin
      .from("organization_members")
      .select("user_id, profiles(full_name, email)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true }),
    admin
      .from("contract_extraction_jobs")
      .select("*")
      .eq("contract_id", id)
      .maybeSingle(),
  ]);

  if (!contractData) notFound();

  let ownerProfile: { full_name: string | null; email: string | null } | null = null;
  if (contractData.owner_id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", contractData.owner_id)
      .single();
    ownerProfile = profile;
  }

  const contract = { ...contractData, owner: ownerProfile };
  const auditEvents = auditEventsData ?? [];
  const reminders = remindersData ?? [];

  const ownerMembers = (membersData ?? []).map((m) => {
    const profile = m.profiles as unknown as {
      full_name: string | null;
      email: string | null;
    } | null;
    return {
      userId: m.user_id,
      label: profile?.full_name || profile?.email || "Member",
    };
  });

  const upcomingReminders = reminders.filter((r) => !r.sent_at);
  const reminderHistory = reminders.filter((r) => r.sent_at);

  const extractionJob = (extractionJobData ?? null) as ContractExtractionJob | null;
  const pendingFieldsCount = (contract.extracted_fields ?? []).filter(
    (f: { status: string }) => f.status === "pending"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/contracts"
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="ui-page-title">{contract.title}</h1>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                STATUS_STYLES[contract.status as keyof typeof STATUS_STYLES]
              }`}
            >
              {STATUS_LABELS[contract.status as keyof typeof STATUS_LABELS]}
            </span>
          </div>
          {contract.counterparty && (
            <p className="mt-1 text-sm text-zinc-500">
              {contract.counterparty}
              {contract.contract_type && ` · ${contract.contract_type}`}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div
            id="extracted-fields"
            className="scroll-mt-24 ui-card p-6 shadow-none"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="ui-section-title">Extracted fields</h2>
              <ExtractButton
                contractId={contract.id}
                hasFiles={!!contract.contract_files?.length}
                canEdit={canEdit}
              />
            </div>
            <ExtractionJobAlert job={extractionJob} />
            <BatchApproveButton
              contractId={contract.id}
              pendingCount={pendingFieldsCount}
              canEdit={canEdit}
            />
            <FieldReview
              fields={contract.extracted_fields || []}
              canEdit={canEdit}
            />
            <div className="mt-4">
              <AddFieldForm
                contractId={contract.id}
                existingFieldNames={(contract.extracted_fields || []).map(
                  (f: { field_name: string }) => f.field_name
                )}
                canEdit={canEdit}
              />
            </div>
          </div>

          <div className="ui-card p-6 shadow-none">
            <h2 className="ui-section-title mb-4">Documents</h2>
            {!contract.contract_files?.length ? (
              <p className="text-sm text-zinc-500">No files uploaded.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {contract.contract_files.map(
                  (file: {
                    id: string;
                    file_name: string;
                    file_type: string;
                    file_size: number;
                    storage_path: string;
                    created_at: string;
                  }) => (
                    <li
                      key={file.id}
                      className="flex items-center justify-between py-3"
                    >
                      <div className="flex items-center gap-3">
                        <FileText size={20} className="text-zinc-400" />
                        <div>
                          <p className="text-sm font-medium text-zinc-900">
                            {file.file_name}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {formatFileSize(file.file_size)} ·
                            Uploaded{" "}
                            {format(
                              new Date(file.created_at),
                              "MMM d, yyyy"
                            )}
                            {" · "}
                            <span className="text-green-700">Stored</span>
                          </p>
                        </div>
                      </div>
                      <DownloadButton
                        storagePath={file.storage_path}
                        fileName={file.file_name}
                      />
                    </li>
                  )
                )}
              </ul>
            )}
            <UploadMoreFiles contractId={contract.id} canEdit={canEdit} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="ui-card p-6 shadow-none">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900">
              Status
            </h3>
            <ContractStatusTransition
              contractId={contract.id}
              currentStatus={contract.status}
              canEdit={canEdit}
            />
          </div>

          <div className="ui-card p-6 shadow-none">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-900">
              <Bell size={16} className="text-zinc-500" />
              Reminders
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium uppercase text-zinc-500">
                  Scheduled
                </p>
                {upcomingReminders.length === 0 ? (
                  <p className="mt-1 text-sm text-zinc-500">
                    None pending. Approve a date field to schedule reminders.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {upcomingReminders.map(
                      (r: {
                        id: string;
                        reminder_type: string;
                        reminder_date: string;
                      }) => (
                        <li
                          key={r.id}
                          className="rounded-lg border border-zinc-200/80 bg-zinc-50/80 px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-zinc-800">
                            {r.reminder_type.replace(/_/g, " ")}
                          </span>
                          <span className="text-zinc-500">
                            {" · "}
                            {format(
                              new Date(r.reminder_date + "T12:00:00"),
                              "MMM d, yyyy"
                            )}
                          </span>
                        </li>
                      )
                    )}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-zinc-500">
                  Sent (history)
                </p>
                {reminderHistory.length === 0 ? (
                  <p className="mt-1 text-sm text-zinc-500">
                    No reminder emails sent yet for this contract.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {reminderHistory.map(
                      (r: {
                        id: string;
                        reminder_type: string;
                        reminder_date: string;
                        sent_at: string;
                      }) => (
                        <li
                          key={r.id}
                          className="text-sm text-zinc-600"
                        >
                          <span className="text-zinc-800">
                            {r.reminder_type.replace(/_/g, " ")}
                          </span>
                          {" · scheduled "}
                          {format(
                            new Date(r.reminder_date + "T12:00:00"),
                            "MMM d, yyyy"
                          )}
                          {r.sent_at && (
                            <>
                              {" · sent "}
                              {format(
                                new Date(r.sent_at),
                                "MMM d, yyyy h:mm a"
                              )}
                            </>
                          )}
                        </li>
                      )
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="ui-card p-6 shadow-none">
            <h3 className="mb-4 text-sm font-semibold text-zinc-900">
              Details
            </h3>
            <dl className="space-y-3">
              <div className="flex items-center gap-2">
                <User size={14} className="text-zinc-400" />
                <dt className="text-sm text-zinc-500">Owner</dt>
                <dd className="ml-auto text-sm font-medium text-zinc-900">
                  {contract.owner?.full_name || contract.owner?.email || "—"}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-zinc-400" />
                <dt className="text-sm text-zinc-500">Created</dt>
                <dd className="ml-auto text-sm text-zinc-900">
                  {format(new Date(contract.created_at), "MMM d, yyyy")}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-zinc-400" />
                <dt className="text-sm text-zinc-500">Updated</dt>
                <dd className="ml-auto text-sm text-zinc-900">
                  {format(new Date(contract.updated_at), "MMM d, yyyy")}
                </dd>
              </div>
            </dl>
            {canEdit && ownerMembers.length > 0 && (
              <OwnerAssignmentForm
                contractId={contract.id}
                currentOwnerId={contract.owner_id}
                members={ownerMembers}
              />
            )}
            <DeleteContractButton
              contractId={contract.id}
              contractTitle={contract.title}
              canEdit={canEdit}
            />
          </div>

          <div className="ui-card p-6 shadow-none">
            <h3 className="mb-4 text-sm font-semibold text-zinc-900">
              Activity
            </h3>
            {auditEvents.length === 0 ? (
              <p className="text-sm text-zinc-500">No activity recorded.</p>
            ) : (
              <ul className="space-y-3">
                {auditEvents.map(
                  (event: {
                    id: string;
                    action: string;
                    created_at: string;
                  }) => (
                    <li key={event.id} className="flex items-start gap-2">
                      <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300" />
                      <div>
                        <p className="text-sm text-zinc-700">
                          {event.action.replace(/\./g, " ")}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {format(
                            new Date(event.created_at),
                            "MMM d, yyyy h:mm a"
                          )}
                        </p>
                      </div>
                    </li>
                  )
                )}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
