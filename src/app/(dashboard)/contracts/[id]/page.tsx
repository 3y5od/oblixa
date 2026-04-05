import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { FieldReview } from "@/components/contracts/field-review";
import { AddFieldForm } from "@/components/contracts/add-field-form";
import { ExtractButton } from "@/components/contracts/extract-button";
import { DownloadButton } from "@/components/contracts/download-button";
import { UploadMoreFiles } from "@/components/contracts/upload-more-files";
import { FileText, ArrowLeft, User, Calendar } from "lucide-react";
import Link from "next/link";
import { STATUS_STYLES, STATUS_LABELS } from "@/lib/contracts";
import { ContractStatusTransition } from "@/components/contracts/contract-status-transition";

export default async function ContractDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const supabase = await createClient();

  const { data: contract } = await supabase
    .from("contracts")
    .select(
      "*, owner:profiles!contracts_owner_id_fkey(full_name, email), contract_files(*), extracted_fields(*)"
    )
    .eq("id", id)
    .single();

  if (!contract) notFound();

  const { data: auditEventsData } = await supabase
    .from("audit_events")
    .select("*")
    .eq("contract_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  const auditEvents = auditEventsData ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/contracts"
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {contract.title}
            </h1>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                STATUS_STYLES[contract.status as keyof typeof STATUS_STYLES]
              }`}
            >
              {STATUS_LABELS[contract.status as keyof typeof STATUS_LABELS]}
            </span>
          </div>
          {contract.counterparty && (
            <p className="mt-1 text-sm text-gray-500">
              {contract.counterparty}
              {contract.contract_type && ` · ${contract.contract_type}`}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Extracted fields */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Extracted Fields
              </h2>
              <ExtractButton
                contractId={contract.id}
                hasFiles={!!contract.contract_files?.length}
              />
            </div>
            <FieldReview fields={contract.extracted_fields || []} />
            <div className="mt-4">
              <AddFieldForm
                contractId={contract.id}
                existingFieldNames={(contract.extracted_fields || []).map(
                  (f: { field_name: string }) => f.field_name
                )}
              />
            </div>
          </div>

          {/* Files */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Documents
            </h2>
            {!contract.contract_files?.length ? (
              <p className="text-sm text-gray-500">No files uploaded.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
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
                        <FileText size={20} className="text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {file.file_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {(file.file_size / 1024 / 1024).toFixed(1)} MB ·
                            Uploaded{" "}
                            {format(
                              new Date(file.created_at),
                              "MMM d, yyyy"
                            )}
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
            <UploadMoreFiles contractId={contract.id} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status transition */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Status
            </h3>
            <ContractStatusTransition
              contractId={contract.id}
              currentStatus={contract.status}
            />
          </div>

          {/* Metadata */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              Details
            </h3>
            <dl className="space-y-3">
              <div className="flex items-center gap-2">
                <User size={14} className="text-gray-400" />
                <dt className="text-sm text-gray-500">Owner</dt>
                <dd className="ml-auto text-sm font-medium text-gray-900">
                  {contract.owner?.full_name || contract.owner?.email || "—"}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-gray-400" />
                <dt className="text-sm text-gray-500">Created</dt>
                <dd className="ml-auto text-sm text-gray-900">
                  {format(new Date(contract.created_at), "MMM d, yyyy")}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-gray-400" />
                <dt className="text-sm text-gray-500">Updated</dt>
                <dd className="ml-auto text-sm text-gray-900">
                  {format(new Date(contract.updated_at), "MMM d, yyyy")}
                </dd>
              </div>
            </dl>
          </div>

          {/* Audit trail */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              Activity
            </h3>
            {auditEvents.length === 0 ? (
              <p className="text-sm text-gray-500">No activity recorded.</p>
            ) : (
              <ul className="space-y-3">
                {auditEvents.map(
                  (event: {
                    id: string;
                    action: string;
                    created_at: string;
                  }) => (
                    <li key={event.id} className="flex items-start gap-2">
                      <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
                      <div>
                        <p className="text-sm text-gray-700">
                          {event.action.replace(/\./g, " ")}
                        </p>
                        <p className="text-xs text-gray-400">
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
