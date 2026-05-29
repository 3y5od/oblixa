"use server";

import { revalidatePath } from "next/cache";
import {
  emitProductTelemetryEvent,
  emitProductTelemetryIfFirstInOrganization,
  emitProductTelemetryIfFirstForOrgUser,
  emitV10ObjectiveTelemetryEvent,
  emitVisibleMutationErrorTelemetry,
} from "@/lib/product-telemetry";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { FIELD_NAMES } from "@/lib/types";
import {
  requireContractWriteAccess as requireWriteAccess,
  verifyOrgMembership,
} from "@/lib/actions/contracts-access";
import { resolveAppBaseUrl } from "@/lib/app-url";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { readApiJson } from "@/lib/parse-api-response";
import { safeFetch } from "@/lib/security/safe-fetch";
import {
  buildContractStoragePath,
  isContractStoragePathSafe,
  isUuid,
  parseContractStoragePath,
  parseFixedEnumParam,
  parsePositiveIntParam,
  validateBoundedString,
} from "@/lib/security/validation";
import { dedupeValidatedUploadedFiles } from "@/lib/security/upload-batch";
import { sanitizeUploadedFileName, validateUploadedFileName } from "@/lib/security/upload-filename";
import { scanUploadedFileForMalware, sniffUploadedFileMime } from "@/lib/security/upload-scan";
import { enqueueOutboundEvent } from "@/lib/integrations/events";
import { recomputeContractSignals } from "@/lib/workflow-signals";
import { autoTransitionTasksForField } from "@/actions/tasks";
import { autoAttachProgramsForContract } from "@/lib/contract-operations/program-auto-attach";
import { executeV10IdempotentMutation, recordV10AuditEvent } from "@/lib/server-contracts";
import { refreshV10ReadModelsForOrganization } from "@/lib/read-model-refresh";
import { buildV10MutationResponse } from "@/lib/mutation-envelope";
import type { AuditAction } from "@/lib/security/audit-actions";
import {
  updateContractStatus as updateContractStatusImpl,
  updateContractOperationalState as updateContractOperationalStateImpl,
  upsertContractIntakeRequest as upsertContractIntakeRequestImpl,
  updateContractExternalLink as updateContractExternalLinkImpl,
  deleteContract as deleteContractImpl,
  applyContractTemplatePack as applyContractTemplatePackImpl,
} from "@/actions/contracts-lifecycle";

const DATE_FIELDS = new Set([
  "end_date",
  "renewal_date",
  "notice_window",
  "effective_date",
  "start_date",
]);

const REMINDER_OFFSETS_DAYS = [30, 14, 7, 1];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_CONTRACT_UPLOAD_FILES = 12;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const ALLOWED_EXTENSIONS_BY_TYPE = new Map([
  ["application/pdf", new Set([".pdf"])],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", new Set([".docx"])],
]);

const ALLOWED_MANUAL_FIELD_NAMES = new Set<string>(FIELD_NAMES);

const MAX_CONTRACT_TITLE = 500;
const MAX_COUNTERPARTY_LEN = 500;
const MAX_CONTRACT_TYPE_LEN = 120;
const MAX_MANUAL_FIELD_VALUE_LEN = 4000;
const MAX_SOURCE_SYSTEM_LEN = 80;
const MAX_EXTERNAL_REF_LEN = 160;
const MAX_REGION_LEN = 40;
const MAX_ANNUAL_VALUE = 999999999999.99;
const MAX_ANNUAL_VALUE_INPUT_LEN = 40;
const MAX_HANDOFF_NOTE_LEN = 4000;
const MAX_SUPERSEDE_REASON_LEN = 1000;
const MAX_REQUIRED_NEXT_STEP_LEN = 240;
const MAX_INTAKE_SOURCE_LABEL_LEN = 160;
const MAX_REJECTION_REASON_LEN = 1000;
const CONTRACT_FILE_SIGNED_URL_TTL_SECONDS = 5 * 60;

const CONTRACT_INTAKE_STATUSES = [
  "awaiting_review",
  "in_clarification",
  "active",
  "at_risk",
  "renewal_prep",
  "notice_decision",
  "archived",
] as const;
const CONTRACT_HEALTH_STATUSES = ["healthy", "watch", "at_risk", "unknown"] as const;
const INTAKE_REQUEST_STATUSES = ["new", "triage", "review", "ready", "rejected"] as const;

type Admin = Awaited<ReturnType<typeof createAdminClient>>;
type ContractAuditAction = Extract<
  AuditAction,
  | `contract.${string}`
  | `contract_field.${string}`
  | `contract_file.${string}`
  | `extraction.${string}`
  | `field.${string}`
  | `files.${string}`
  | `import.${string}`
>;

function contractTextError(
  label: string,
  validation: { error: "invalid_string" | "string_too_long" | "unsafe_characters" },
  options: { requiredMessage?: string } = {}
): string {
  if (validation.error === "string_too_long") return `${label} is too long`;
  if (validation.error === "unsafe_characters") return `${label} contains unsupported characters`;
  return options.requiredMessage ?? `${label} contains unsupported characters`;
}

function optionalContractText(
  value: unknown,
  label: string,
  maxLength: number,
  options: { allowTextWhitespaceControls?: boolean } = {}
): { ok: true; value: string | null } | { ok: false; error: string } {
  const validation = validateBoundedString(value ?? "", {
    maxLength,
    allowEmpty: true,
    allowTextWhitespaceControls: options.allowTextWhitespaceControls,
  });
  if (!validation.ok) return { ok: false, error: contractTextError(label, validation) };
  return { ok: true, value: validation.value || null };
}

function optionalPercentFormValue(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  return parsePositiveIntParam(raw, { defaultValue: 0, min: 0, max: 100 });
}

function hasAllowedUploadedContractSignature(fileType: string, signature: Uint8Array): boolean {
  const sniffed = sniffUploadedFileMime(signature);
  return sniffed.ok && sniffed.mimeType === fileType;
}

async function getUploadedContractFileSignature(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, 8).arrayBuffer());
}

async function getSafeUploadedContractFile(file: File): Promise<
  | { ok: true; safeName: string }
  | { ok: false; safeName: string; reason: "empty" | "size" | "type" | "extension" | "signature" | "filename" | "malware" }
> {
  const safeName = sanitizeUploadedFileName(file.name);
  const nameValidation = validateUploadedFileName(file.name);
  if (!nameValidation.ok) return { ok: false, safeName, reason: "filename" };
  if (!file.size) return { ok: false, safeName, reason: "empty" };
  if (file.size > MAX_FILE_SIZE) return { ok: false, safeName, reason: "size" };
  if (!ALLOWED_TYPES.has(file.type)) return { ok: false, safeName, reason: "type" };
  const extension = safeName.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
  if (!ALLOWED_EXTENSIONS_BY_TYPE.get(file.type)?.has(extension)) {
    return { ok: false, safeName, reason: "extension" };
  }
  const signature = await getUploadedContractFileSignature(file);
  if (!hasAllowedUploadedContractSignature(file.type, signature)) {
    return { ok: false, safeName, reason: "signature" };
  }
  const scan = await scanUploadedFileForMalware(file);
  if (!scan.ok) {
    return { ok: false, safeName, reason: "malware" };
  }
  return { ok: true, safeName };
}

function uploadedContractValidationError(validation: {
  ok: false;
  safeName: string;
  reason: "empty" | "size" | "type" | "extension" | "signature" | "filename" | "malware";
}): string {
  if (validation.reason === "size") return `${validation.safeName}: exceeds 20 MB limit`;
  if (validation.reason === "filename") return `${validation.safeName}: unsafe file name`;
  return `${validation.safeName}: unsupported file type`;
}

async function recordV10ContractMutation(
  admin: Admin,
  input: {
    organizationId: string;
    actorUserId: string;
    action: ContractAuditAction;
    targetType: string;
    targetId: string;
    contractId?: string | null;
    beforeStateHash?: string | null;
    afterStateHash?: string | null;
    safeMetadata?: Record<string, string | number | boolean | null>;
  }
) {
  const auditEventId = await recordV10AuditEvent(admin, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    contractId: input.contractId ?? null,
    outcome: "success",
    beforeStateHash: input.beforeStateHash,
    afterStateHash: input.afterStateHash,
    safeMetadata: input.safeMetadata,
  });
  await refreshV10ReadModelsForOrganization(admin, input.organizationId, {
    reason: input.action,
    refreshScope: "incremental",
  });
  return auditEventId;
}

type CreateContractResult =
  | { error: string }
  | {
      ok: true;
      contractId: string;
      redirectTo: string;
      uploadSummary: {
        attemptedFiles: number;
        uploadedFiles: number;
        skippedInvalidFiles: number;
        failedUploadFiles: number;
      };
      extractionStatus: "queued" | "not_available" | "skipped_no_files";
    };

export async function createContract(formData: FormData): Promise<CreateContractResult> {
  const titleValidation = validateBoundedString(formData.get("title") ?? "", {
    maxLength: MAX_CONTRACT_TITLE,
  });
  const counterpartyValidation = validateBoundedString(formData.get("counterparty") ?? "", {
    maxLength: MAX_COUNTERPARTY_LEN,
    allowEmpty: true,
  });
  const contractTypeValidation = validateBoundedString(formData.get("contractType") ?? "", {
    maxLength: MAX_CONTRACT_TYPE_LEN,
    allowEmpty: true,
  });
  const sourceSystemValidation = validateBoundedString(formData.get("sourceSystem") ?? "", {
    maxLength: MAX_SOURCE_SYSTEM_LEN,
    allowEmpty: true,
  });
  const regionValidation = validateBoundedString(formData.get("region") ?? "", {
    maxLength: MAX_REGION_LEN,
    allowEmpty: true,
  });
  const annualValueValidation = validateBoundedString(formData.get("annualValue") ?? "", {
    maxLength: MAX_ANNUAL_VALUE_INPUT_LEN,
    allowEmpty: true,
  });
  const externalReferenceValidation = validateBoundedString(formData.get("externalReferenceId") ?? "", {
    maxLength: MAX_EXTERNAL_REF_LEN,
    allowEmpty: true,
  });
  const organizationIdEntry = formData.get("organizationId");
  const organizationId = typeof organizationIdEntry === "string" ? organizationIdEntry.trim() : "";

  if (!titleValidation.ok) {
    return { error: contractTextError("Title", titleValidation, { requiredMessage: "Title is required" }) };
  }
  if (!organizationId) return { error: "Organization is required" };
  if (!isUuid(organizationId)) return { error: "Invalid organization" };
  if (!counterpartyValidation.ok) return { error: contractTextError("Counterparty", counterpartyValidation) };
  if (!contractTypeValidation.ok) return { error: contractTextError("Contract type", contractTypeValidation) };
  if (!sourceSystemValidation.ok) return { error: contractTextError("Source system", sourceSystemValidation) };
  if (!regionValidation.ok) return { error: contractTextError("Region", regionValidation) };
  if (!externalReferenceValidation.ok) {
    return { error: contractTextError("External reference", externalReferenceValidation) };
  }
  if (!annualValueValidation.ok) return { error: "Annual value must be a valid positive number." };

  const title = titleValidation.value;
  const counterparty = counterpartyValidation.value || null;
  const contractType = contractTypeValidation.value || null;
  const sourceSystem = sourceSystemValidation.value || null;
  const region = regionValidation.value || null;
  const annualValueRaw = annualValueValidation.value;
  const externalReferenceId = externalReferenceValidation.value || null;
  const annualValue = annualValueRaw ? Number(annualValueRaw) : null;
  if (
    annualValueRaw &&
    (!Number.isFinite(annualValue) || annualValue == null || annualValue < 0 || annualValue > MAX_ANNUAL_VALUE)
  ) {
    return { error: "Annual value must be a valid positive number." };
  }

  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await verifyOrgMembership(admin, user.id, organizationId))) {
    return { error: "Access denied" };
  }

  const writeErr = await requireWriteAccess(admin, user.id, organizationId);
  if (writeErr) return writeErr;

  const { count: contractsBeforeCreate } = await admin
    .from("contracts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  const files = formData.getAll("files").filter((entry): entry is File => typeof File !== "undefined" && entry instanceof File);
  const attemptedFiles = files.filter((f) => f.size > 0);
  if (attemptedFiles.length > MAX_CONTRACT_UPLOAD_FILES) {
    return { error: `Upload at most ${MAX_CONTRACT_UPLOAD_FILES} files at a time.` };
  }
  const validatedFiles = await Promise.all(attemptedFiles.map(async (file) => ({ file, validation: await getSafeUploadedContractFile(file) })));
  const acceptedFiles = validatedFiles.filter((entry): entry is { file: File; validation: { ok: true; safeName: string } } => entry.validation.ok);
  const dedupedFiles = dedupeValidatedUploadedFiles(acceptedFiles);
  const validFiles = dedupedFiles.files;
  if (validFiles.length > MAX_CONTRACT_UPLOAD_FILES) {
    return { error: `Upload at most ${MAX_CONTRACT_UPLOAD_FILES} files at a time.` };
  }
  const skippedInvalidFiles = attemptedFiles.length - validFiles.length;
  if (attemptedFiles.length > 0 && validFiles.length === 0) {
    return {
      error:
        "None of the selected files could be uploaded. Use PDF or DOCX, each 20 MB or smaller.",
    };
  }

  const { data: contract, error } = await admin
    .from("contracts")
    .insert({
      title,
      counterparty: counterparty || null,
      contract_type: contractType || null,
      organization_id: organizationId,
      owner_id: user.id,
      owner_assigned_at: new Date().toISOString(),
      created_by: user.id,
      status: "pending_review",
      intake_status: "awaiting_review",
      intake_owner_id: user.id,
      intake_source: sourceSystem || "manual",
      intake_completeness_score: validFiles.length > 0 ? 35 : 15,
      intake_last_scored_at: new Date().toISOString(),
      health_status: "unknown",
      required_next_step:
        validFiles.length > 0
          ? "Confirm uploaded files, then review extraction results"
          : "Upload at least one signed source document",
      source_system: sourceSystem || null,
      region: region || null,
      annual_value: annualValue,
      external_reference_id: externalReferenceId || null,
    })
    .select()
    .single();

  if (error) return { error: mapDataSourceError(error.message) };

  const uploadResults = await Promise.all(
    validFiles.map(async ({ file, validation }) => {
      const safeName = validation.safeName;
      const storagePath = buildContractStoragePath(organizationId, contract.id, safeName);

      const { error: uploadError } = await admin.storage
        .from("contracts")
        .upload(storagePath, file);

      if (uploadError) {
        console.error("Upload error:", uploadError.message);
        return {
          ok: false as const,
          fileName: safeName,
          reason: uploadError.message,
        };
      }

      const { error: fileInsertError } = await admin.from("contract_files").insert({
        contract_id: contract.id,
        file_name: safeName,
        file_type: file.type,
        file_size: file.size,
        storage_path: storagePath,
        uploaded_by: user.id,
      });

      if (fileInsertError) {
        console.error("contract_files insert error:", fileInsertError.message);
        return {
          ok: false as const,
          fileName: safeName,
          reason: fileInsertError.message,
        };
      }

      return {
        ok: true as const,
        fileName: safeName,
      };
    })
  );

  const uploadedFiles = uploadResults.filter((result) => result.ok).length;
  const failedUploadFiles = uploadResults.length - uploadedFiles;

  if (uploadedFiles === 0) {
    await admin
      .from("contracts")
      .update({
        required_next_step: "Upload at least one signed source document",
        intake_completeness_score: 15,
      })
      .eq("id", contract.id);
  } else if (failedUploadFiles > 0 || skippedInvalidFiles > 0) {
    await admin
      .from("contracts")
      .update({
        required_next_step: "Review uploaded files and re-attach any missing source documents",
      })
      .eq("id", contract.id);
  }

  await admin.from("audit_events").insert({
    organization_id: organizationId,
    contract_id: contract.id,
    user_id: user.id,
    action: "contract.created",
    details: { title },
  });
  await admin.from("contract_notes").insert({
    contract_id: contract.id,
    organization_id: organizationId,
    author_id: user.id,
    note: "[Timeline] Contract created",
    pinned: false,
  });

  await enqueueOutboundEvent({
    organizationId: organizationId,
    eventType: "contract.created",
    entityType: "contract",
    entityId: contract.id,
    payload: { title, counterparty, contract_type: contractType },
  });
  await recomputeContractSignals(admin, contract.id);
  await applyContractTemplatePack(contract.id);
  await recordV10ContractMutation(admin, {
    organizationId,
    actorUserId: user.id,
    action: "contract.created",
    targetType: "contract",
    targetId: contract.id,
    contractId: contract.id,
    afterStateHash: String(contract.updated_at ?? contract.status ?? "created"),
    safeMetadata: {
      intake_source: sourceSystem || "manual",
      file_count: uploadedFiles,
      skipped_invalid_files: skippedInvalidFiles,
      duplicate_files_ignored: dedupedFiles.duplicateCount,
      failed_upload_files: failedUploadFiles,
    },
  });
  await emitV10ObjectiveTelemetryEvent(admin, {
    organizationId,
    userId: user.id,
    contractId: contract.id,
    objectiveKey: "activation_first_work_item",
    action: "product.v10.activation_completed",
    details: {
      organization_id: organizationId,
      contract_id: contract.id,
      job_id: null,
      duration_ms: null,
      state: uploadedFiles > 0 ? "contract_created_with_files" : "contract_created_metadata_only",
    },
  });

  await autoAttachProgramsForContract({
    admin,
    contract: {
      id: contract.id,
      organization_id: organizationId,
      contract_type: contract.contract_type ?? null,
      source_system: contract.source_system ?? null,
      counterparty: contract.counterparty ?? null,
      region: contract.region ?? null,
      intake_source: contract.intake_source ?? null,
    },
    actorUserId: user.id,
  }).catch((err) => console.error("[v4] autoAttachProgramsForContract", err));

  if ((contractsBeforeCreate ?? 0) === 0) {
    await emitProductTelemetryEvent(admin, {
      organizationId: organizationId,
      userId: user.id,
      contractId: contract.id,
      action: "product.v9.first_contract_created",
      details: { intake: validFiles.length > 0 ? "with_files" : "metadata_only" },
    });
  }

  let extractionStatus: "queued" | "not_available" | "skipped_no_files" = "skipped_no_files";
  if (uploadedFiles > 0 && process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes("placeholder")) {
    triggerExtraction(contract.id).catch(console.error);
    extractionStatus = "queued";
  } else if (uploadedFiles > 0) {
    extractionStatus = "not_available";
  }

  const params = new URLSearchParams({
    created: "1",
    uploaded: String(uploadedFiles),
    invalid: String(skippedInvalidFiles),
    failed: String(failedUploadFiles),
    extraction: extractionStatus,
  });

  return {
    ok: true,
    contractId: contract.id,
    redirectTo: `/contracts/${contract.id}?${params.toString()}`,
    uploadSummary: {
      attemptedFiles: attemptedFiles.length,
      uploadedFiles,
      skippedInvalidFiles,
      failedUploadFiles,
    },
    extractionStatus,
  };
}

export async function updateContractField(
  fieldId: string,
  action: "approved" | "rejected" | "edited",
  newValue?: string
) {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(fieldId)) return { error: "Invalid field" };

  const { data: field } = await admin
    .from("extracted_fields")
    .select(
      "field_name, field_value, source_snippet, source, updated_at, contracts!inner(id, organization_id, owner_id)"
    )
    .eq("id", fieldId)
    .single();

  if (!field) return { error: "Field not found" };

  const contractRel = field.contracts as unknown;
  const contract = (
    Array.isArray(contractRel) ? contractRel[0] : contractRel
  ) as { id: string; organization_id: string; owner_id: string | null };

  if (!(await verifyOrgMembership(admin, user.id, contract.organization_id))) {
    return { error: "Access denied" };
  }

  const writeErr = await requireWriteAccess(admin, user.id, contract.organization_id);
  if (writeErr) return writeErr;

  if (action === "approved") {
    const hasValue =
      field.field_value != null && String(field.field_value).trim().length > 0;
    const hasSnippet =
      field.source_snippet != null &&
      String(field.source_snippet).trim().length > 0;
    if (field.source === "ai" && hasValue && !hasSnippet) {
      return {
        error:
          "AI-extracted values need a source citation before approval. Edit the field to add the clause text, or reject.",
      };
    }
  }

  const updateData: Record<string, unknown> = {
    status: action,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
  };

  if (action === "edited" && newValue !== undefined) {
    if (newValue.length > MAX_MANUAL_FIELD_VALUE_LEN) {
      return { error: "Value is too long" };
    }
    updateData.field_value = newValue;
    updateData.source = "human";
  }

  const mutationName =
    action === "approved"
      ? "approve_field"
      : action === "rejected"
        ? "reject_field"
        : "edit_and_approve_field";
  const v10MutationStart = await executeV10IdempotentMutation(
    admin,
    {
      organizationId: contract.organization_id,
      actorUserId: user.id,
      mutationName,
      targetType: "field",
      targetId: fieldId,
      idempotencyKey: `v10-server-action:${crypto.randomUUID()}`,
      expectedVersion: String(field.updated_at ?? "unknown"),
      currentVersion: String(field.updated_at ?? "unknown"),
      payload: {
        fieldId,
        action,
        value_state: action === "edited" && newValue !== undefined ? "changed" : "unchanged",
      },
    },
    async () =>
      buildV10MutationResponse({
        outcome: "success",
        message: "Field review mutation reserved.",
        changedObjectType: "field",
        changedObjectId: fieldId,
        nextDestinationHref: `/contracts/${contract.id}`,
      })
  );
  if (v10MutationStart.response.outcome !== "success") {
    return { error: v10MutationStart.response.user_visible_message, v10: v10MutationStart.response };
  }

  const { error } = await admin
    .from("extracted_fields")
    .update(updateData)
    .eq("id", fieldId);

  if (error) {
    const code = mapDataSourceError(error.message);
    await emitVisibleMutationErrorTelemetry(admin, {
      organizationId: contract.organization_id,
      userId: user.id,
      contractId: contract.id,
      surface: "review",
      mutation: "updateContractField",
      code,
    });
    return { error: code };
  }

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: contract.id,
    user_id: user.id,
    action: `field.${action}`,
    details: {
      field_name: field.field_name,
      ...(action === "edited" ? { old_value: field.field_value, new_value: newValue } : {}),
    },
  });

  const resolvedValue = action === "edited" ? newValue : field.field_value;
  await autoTransitionTasksForField({
    admin,
    organizationId: contract.organization_id,
    contractId: contract.id,
    actorId: user.id,
    fieldId,
    fieldStatus: action,
    fieldDateValue: resolvedValue,
  });
  await recomputeContractSignals(admin, contract.id);
  if (
    (action === "approved" || action === "edited") &&
    DATE_FIELDS.has(field.field_name) &&
    resolvedValue
  ) {
    await scheduleReminders(
      admin,
      contract.id,
      fieldId,
      field.field_name,
      resolvedValue,
      contract.owner_id
    );
  }

  if (action === "rejected" && DATE_FIELDS.has(field.field_name)) {
    await admin
      .from("reminders")
      .delete()
      .eq("field_id", fieldId);
  }

  await emitProductTelemetryIfFirstForOrgUser(admin, {
    organizationId: contract.organization_id,
    userId: user.id,
    contractId: contract.id,
    action: "product.v9.review_started",
    details: { surface: "field_review" },
  });
  await emitProductTelemetryIfFirstForOrgUser(admin, {
    organizationId: contract.organization_id,
    userId: user.id,
    contractId: contract.id,
    action: "product.v10.field_review_completed",
    details: { field_name: field.field_name, decision: action },
  });
  if (action === "approved") {
    await emitProductTelemetryEvent(admin, {
      organizationId: contract.organization_id,
      userId: user.id,
      contractId: contract.id,
      action: "product.v9.review_item_approved",
      details: { fieldId },
    });
  } else if (action === "edited") {
    await emitProductTelemetryEvent(admin, {
      organizationId: contract.organization_id,
      userId: user.id,
      contractId: contract.id,
      action: "product.v9.review_item_edited",
      details: { fieldId },
    });
  }

  await recordV10ContractMutation(admin, {
    organizationId: contract.organization_id,
    actorUserId: user.id,
    action:
      action === "approved"
        ? "contract_field.approved"
        : action === "rejected"
          ? "contract_field.rejected"
          : "contract_field.edited_and_approved",
    targetType: "field",
    targetId: fieldId,
    contractId: contract.id,
    beforeStateHash: String(field.field_value ?? "missing"),
    afterStateHash: String(resolvedValue ?? action),
    safeMetadata: {
      field_name: field.field_name,
      decision: action,
      source_state: field.source ? "provided" : "missing",
    },
  });
  await emitProductTelemetryEvent(admin, {
    organizationId: contract.organization_id,
    userId: user.id,
    contractId: contract.id,
    action: "product.v10.field_review_completed",
    details: {
      field_state: action,
      source_state: field.source ? "provided" : "missing",
      required_field: DATE_FIELDS.has(field.field_name) || field.field_name === "title",
    },
  });
  const { count: remainingPendingFields } = await admin
    .from("extracted_fields")
    .select("id", { count: "exact", head: true })
    .eq("contract_id", contract.id)
    .eq("status", "pending");
  if ((remainingPendingFields ?? 0) === 0) {
    await emitProductTelemetryEvent(admin, {
      organizationId: contract.organization_id,
      userId: user.id,
      contractId: contract.id,
      action: "product.v10.review_queue_cleared",
      details: {
        queue_type: "contract_field_review",
        source_state: "read_model_refresh_requested",
      },
    });
  }

  return { success: true };
}

export async function updateContractSecondaryOwner(contractId: string, secondaryOwnerId: string | null) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(contractId)) return { error: "Invalid contract" };
  if (secondaryOwnerId && !isUuid(secondaryOwnerId)) return { error: "Invalid secondary owner" };

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id")
    .eq("id", contractId)
    .single();
  if (!contract) return { error: "Contract not found" };

  if (!(await verifyOrgMembership(admin, user.id, contract.organization_id))) {
    return { error: "Access denied" };
  }
  const writeErr = await requireWriteAccess(admin, user.id, contract.organization_id);
  if (writeErr) return writeErr;

  if (
    secondaryOwnerId &&
    !(await verifyOrgMembership(admin, secondaryOwnerId, contract.organization_id))
  ) {
    return { error: "Secondary owner must be a member of this organization." };
  }

  const { error } = await admin
    .from("contracts")
    .update({ secondary_owner_id: secondaryOwnerId })
    .eq("id", contractId);
  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: contractId,
    user_id: user.id,
    action: "contract.secondary_owner_changed",
    details: { secondary_owner_id: secondaryOwnerId },
  });
  await recomputeContractSignals(admin, contractId);
  await recordV10ContractMutation(admin, {
    organizationId: contract.organization_id,
    actorUserId: user.id,
    action: "contract.secondary_owner_changed",
    targetType: "contract",
    targetId: contractId,
    contractId,
    afterStateHash: secondaryOwnerId ?? "unassigned",
    safeMetadata: { secondary_owner_assigned: Boolean(secondaryOwnerId) },
  });

  return { success: true as const };
}

export async function upsertContractHandoffChecklist(input: {
  contractId: string;
  toOwnerId: string;
  checklistNote: string;
}) {
  if (!isUuid(input.contractId) || !isUuid(input.toOwnerId)) {
    return { error: "Invalid request" };
  }
  const noteValidation = validateBoundedString(input.checklistNote, {
    maxLength: MAX_HANDOFF_NOTE_LEN,
    allowTextWhitespaceControls: true,
  });
  if (!noteValidation.ok) {
    return {
      error: contractTextError("Checklist note", noteValidation, {
        requiredMessage: "Checklist note is required",
      }),
    };
  }
  const checklistNote = noteValidation.value;

  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id, owner_id")
    .eq("id", input.contractId)
    .single();
  if (!contract) return { error: "Contract not found" };

  if (!(await verifyOrgMembership(admin, user.id, contract.organization_id))) {
    return { error: "Access denied" };
  }
  const writeErr = await requireWriteAccess(admin, user.id, contract.organization_id);
  if (writeErr) return writeErr;

  const { error } = await admin.from("contract_handoff_checklists").insert({
    contract_id: input.contractId,
    organization_id: contract.organization_id,
    from_owner_id: contract.owner_id,
    to_owner_id: input.toOwnerId,
    checklist_note: checklistNote,
    status: "pending",
    created_by: user.id,
  });
  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("contract_notes").insert({
    contract_id: input.contractId,
    organization_id: contract.organization_id,
    author_id: user.id,
    note: `[Timeline] Ownership handoff checklist created`,
    pinned: true,
  });

  return { success: true as const };
}

export async function updateContractHandoffChecklistStatus(
  checklistId: string,
  status: "pending" | "completed"
) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isUuid(checklistId)) return { error: "Invalid request" };

  const { data: checklist } = await admin
    .from("contract_handoff_checklists")
    .select("id, contract_id, organization_id")
    .eq("id", checklistId)
    .maybeSingle();
  if (!checklist) return { error: "Checklist not found" };

  if (!(await verifyOrgMembership(admin, user.id, checklist.organization_id))) {
    return { error: "Access denied" };
  }
  const writeErr = await requireWriteAccess(admin, user.id, checklist.organization_id);
  if (writeErr) return writeErr;

  const { error } = await admin
    .from("contract_handoff_checklists")
    .update({
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", checklistId);
  if (error) return { error: mapDataSourceError(error.message) };

  return { success: true as const };
}

export async function updateContractHandoffChecklistStatusForm(
  checklistId: string,
  status: "pending" | "completed"
) {
  const res = await updateContractHandoffChecklistStatus(checklistId, status);
  if (res && "error" in res && res.error) {
    console.error("[contracts] updateContractHandoffChecklistStatusForm", res.error);
  }
}

export async function upsertContractHandoffChecklistForm(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const toOwnerId = String(formData.get("toOwnerId") ?? "").trim();
  const checklistNote = String(formData.get("checklistNote") ?? "");
  const res = await upsertContractHandoffChecklist({ contractId, toOwnerId, checklistNote });
  if (res && "error" in res && res.error) {
    console.error("[contracts] upsertContractHandoffChecklistForm", res.error);
  }
}

async function scheduleReminders(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  contractId: string,
  fieldId: string,
  fieldName: string,
  dateValue: string,
  ownerId: string | null
) {
  await supabase.from("reminders").delete().eq("field_id", fieldId);

  const targetDate = new Date(dateValue);
  if (isNaN(targetDate.getTime())) return;

  const now = new Date();
  const reminders = REMINDER_OFFSETS_DAYS
    .map((offset) => {
      const reminderDate = new Date(targetDate);
      reminderDate.setDate(reminderDate.getDate() - offset);
      return {
        contract_id: contractId,
        field_id: fieldId,
        reminder_type: `${fieldName}_${offset}d`,
        reminder_date: reminderDate.toISOString().split("T")[0],
        recipient_id: ownerId,
      };
    })
    .filter((r) => new Date(r.reminder_date) > now);

  if (reminders.length > 0) {
    await supabase.from("reminders").insert(reminders);
  }
}

export async function addManualField(
  contractId: string,
  fieldName: string,
  fieldValue: string
) {
  if (!isUuid(contractId)) return { error: "Invalid contract" };
  if (!ALLOWED_MANUAL_FIELD_NAMES.has(fieldName)) {
    return { error: "Invalid field name" };
  }
  const fieldValueValidation = validateBoundedString(fieldValue, {
    maxLength: MAX_MANUAL_FIELD_VALUE_LEN,
    allowEmpty: true,
    allowTextWhitespaceControls: true,
  });
  if (!fieldValueValidation.ok) {
    return { error: contractTextError("Value", fieldValueValidation) };
  }

  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id, owner_id")
    .eq("id", contractId)
    .single();

  if (!contract) return { error: "Contract not found" };

  if (!(await verifyOrgMembership(admin, user.id, contract.organization_id))) {
    return { error: "Access denied" };
  }

  const writeErr = await requireWriteAccess(admin, user.id, contract.organization_id);
  if (writeErr) return writeErr;

  const { data: inserted, error } = await admin
    .from("extracted_fields")
    .insert({
      contract_id: contractId,
      field_name: fieldName,
      field_value: fieldValueValidation.value,
      source: "human",
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: contractId,
    user_id: user.id,
    action: "field.added",
    details: { field_name: fieldName, field_value: fieldValueValidation.value },
  });
  await recomputeContractSignals(admin, contractId);

  if (DATE_FIELDS.has(fieldName) && fieldValueValidation.value) {
    await scheduleReminders(
      admin,
      contractId,
      inserted.id,
      fieldName,
      fieldValueValidation.value,
      contract.owner_id
    );
  }

  return { success: true };
}

export async function uploadAdditionalFiles(contractId: string, formData: FormData) {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(contractId)) return { error: "Invalid contract" };

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id")
    .eq("id", contractId)
    .single();

  if (!contract) return { error: "Contract not found" };

  if (!(await verifyOrgMembership(admin, user.id, contract.organization_id))) {
    return { error: "Access denied" };
  }

  const writeErr = await requireWriteAccess(admin, user.id, contract.organization_id);
  if (writeErr) return writeErr;

  const files = formData.getAll("files").filter((entry): entry is File => typeof File !== "undefined" && entry instanceof File).filter((file) => file.size > 0);
  if (files.length > MAX_CONTRACT_UPLOAD_FILES) {
    return { error: `Upload at most ${MAX_CONTRACT_UPLOAD_FILES} files at a time.` };
  }
  const validatedFiles = await Promise.all(files.map(async (file) => ({ file, validation: await getSafeUploadedContractFile(file) })));
  const acceptedFiles = validatedFiles.filter((entry): entry is { file: File; validation: { ok: true; safeName: string } } => entry.validation.ok);
  const invalidErrors = validatedFiles
    .filter((entry): entry is { file: File; validation: { ok: false; safeName: string; reason: "empty" | "size" | "type" | "extension" | "signature" | "filename" | "malware" } } => !entry.validation.ok)
    .map((entry) => uploadedContractValidationError(entry.validation));
  const dedupedFiles = dedupeValidatedUploadedFiles(acceptedFiles);
  const validFiles = dedupedFiles.files;
  const results = await Promise.allSettled(
    validFiles
      .map(async ({ file, validation }) => {
        const safeName = validation.safeName;
        const storagePath = buildContractStoragePath(contract.organization_id, contract.id, safeName);

        const { error: uploadError } = await admin.storage
          .from("contracts")
          .upload(storagePath, file);

        if (uploadError) {
          throw new Error(`${file.name}: ${uploadError.message}`);
        }

        await admin.from("contract_files").insert({
          contract_id: contract.id,
          file_name: safeName,
          file_type: file.type,
          file_size: file.size,
          storage_path: storagePath,
          uploaded_by: user.id,
        });
      })
  );

  const uploaded = results.filter((r) => r.status === "fulfilled").length;
  const errors = [
    ...invalidErrors,
    ...results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => r.reason?.message ?? "Unknown error"),
  ];

  if (uploaded > 0) {
    await admin.from("audit_events").insert({
      organization_id: contract.organization_id,
      contract_id: contract.id,
      user_id: user.id,
      action: "files.uploaded",
      details: { count: uploaded, duplicate_files_ignored: dedupedFiles.duplicateCount },
    });
  }

  if (errors.length > 0) {
    return { error: errors.join("; "), uploaded };
  }

  return { success: true, uploaded };
}

export async function supersedeContractFile(input: {
  contractId: string;
  fileId: string;
  reason?: string | null;
  replacementFileId?: string | null;
}) {
  if (!isUuid(input.contractId) || !isUuid(input.fileId)) return { error: "Invalid request" };
  if (input.replacementFileId && !isUuid(input.replacementFileId)) {
    return { error: "Invalid replacement file" };
  }
  const reasonValidation = validateBoundedString(input.reason ?? "", {
    maxLength: MAX_SUPERSEDE_REASON_LEN,
    allowEmpty: true,
    allowTextWhitespaceControls: true,
  });
  if (!reasonValidation.ok) {
    return { error: contractTextError("Reason", reasonValidation) };
  }
  const reason = reasonValidation.value || null;

  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id")
    .eq("id", input.contractId)
    .single();
  if (!contract) return { error: "Contract not found" };

  if (!(await verifyOrgMembership(admin, user.id, contract.organization_id))) {
    return { error: "Access denied" };
  }
  const writeErr = await requireWriteAccess(admin, user.id, contract.organization_id);
  if (writeErr) return writeErr;

  const { error } = await admin
    .from("contract_files")
    .update({
      superseded_at: new Date().toISOString(),
      superseded_by_id: input.replacementFileId ?? null,
      supersede_reason: reason,
    })
    .eq("id", input.fileId)
    .eq("contract_id", input.contractId);
  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: input.contractId,
    user_id: user.id,
    action: "contract.file_superseded",
    details: {
      file_id: input.fileId,
      replacement_file_id: input.replacementFileId ?? null,
      reason,
    },
  });
  await recomputeContractSignals(admin, input.contractId);

  await enqueueOutboundEvent({
    organizationId: contract.organization_id,
    eventType: "contract.file_superseded",
    entityType: "contract_file",
    entityId: input.fileId,
    payload: {
      contract_id: input.contractId,
      replacement_file_id: input.replacementFileId ?? null,
    },
  });

  // Trigger re-extraction after superseding to refresh approved fields.
  await triggerExtraction(input.contractId);
  return { success: true as const };
}

export async function supersedeContractFileForm(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const fileId = String(formData.get("fileId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const replacementFileId = String(formData.get("replacementFileId") ?? "").trim();
  const res = await supersedeContractFile({
    contractId,
    fileId,
    reason: reason || null,
    replacementFileId: replacementFileId || null,
  });
  if (res && "error" in res && res.error) {
    console.error("[contracts] supersedeContractFileForm", res.error);
  }
}

async function triggerExtraction(contractId: string) {
  const appUrl = await resolveAppBaseUrl();
  const cookieStore = await (await import("next/headers")).cookies();
  const allCookies = cookieStore.getAll();
  const cookieHeader = allCookies.map((c) => `${c.name}=${c.value}`).join("; ");

  let res: Response;
  try {
    res = await safeFetch(`${appUrl}/api/extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({ contractId }),
      allowLocalhostInDev: true,
    });
  } catch (err) {
    console.error("[triggerExtraction] network error:", err);
    return;
  }

  const { data, isJson } = await readApiJson<{ error?: string }>(res);
  if (!isJson) {
    console.error(
      "[triggerExtraction] non-JSON response",
      res.status,
      "— check NEXT_PUBLIC_APP_URL matches this deployment."
    );
    return;
  }
  if (!res.ok) {
    if (res.status === 409) {
      return;
    }
    console.error(
      "[triggerExtraction] failed:",
      res.status,
      data.error ?? "(no error message)"
    );
  }
}

export async function runExtraction(contractId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(contractId)) return { error: "Invalid contract" };

  const admin = await createAdminClient();
  const { data: contract } = await admin
    .from("contracts")
    .select("organization_id")
    .eq("id", contractId)
    .single();

  if (!contract) return { error: "Contract not found" };

  if (!(await verifyOrgMembership(admin, user.id, contract.organization_id))) {
    return { error: "Access denied" };
  }

  const writeErr = await requireWriteAccess(admin, user.id, contract.organization_id);
  if (writeErr) return writeErr;

  const appUrl = await resolveAppBaseUrl();

  const cookieStore = await (await import("next/headers")).cookies();
  const allCookies = cookieStore.getAll();
  const cookieHeader = allCookies.map((c) => `${c.name}=${c.value}`).join("; ");

  let res: Response;
  try {
    res = await safeFetch(`${appUrl}/api/extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({ contractId }),
      allowLocalhostInDev: true,
    });
  } catch {
    return {
      error:
        "Could not reach the extraction service. Check your connection and NEXT_PUBLIC_APP_URL.",
    };
  }

  const { data, isJson, rawPreview } = await readApiJson<{
    error?: string;
    extracted?: number;
    inserted?: number;
    textChars?: number;
    accepted?: boolean;
    async?: boolean;
  }>(res);

  if (!isJson) {
    return {
      error: `Unexpected response from server (${res.status}). If this persists, verify NEXT_PUBLIC_APP_URL points to this app. ${rawPreview.slice(0, 120)}`,
    };
  }

  if (res.status === 202 && data.accepted && data.async) {
    await recordV10ContractMutation(admin, {
      organizationId: contract.organization_id,
      actorUserId: user.id,
      action: "extraction.queued",
      targetType: "contract",
      targetId: contractId,
      contractId,
      safeMetadata: { async: true },
    });
    return {
      success: true,
      async: true as const,
      extracted: 0,
      inserted: 0,
    };
  }

  if (!res.ok) {
    // Legacy: duplicate requests used to get 409; API now returns 202 — keep fallback for older deploys.
    if (res.status === 409) {
      return {
        success: true,
        async: true as const,
        extracted: 0,
        inserted: 0,
      };
    }
    return { error: data.error || `Extraction failed (${res.status})` };
  }

  await recordV10ContractMutation(admin, {
    organizationId: contract.organization_id,
    actorUserId: user.id,
    action: "extraction.completed",
    targetType: "contract",
    targetId: contractId,
    contractId,
    safeMetadata: {
      async: false,
      extracted: data.extracted ?? 0,
      inserted: data.inserted ?? 0,
    },
  });

  return {
    success: true,
    async: false as const,
    extracted: data.extracted ?? 0,
    inserted: data.inserted ?? 0,
    textChars: data.textChars,
  };
}

export async function batchApproveReadyFields(contractId: string) {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(contractId)) return { error: "Invalid contract" };

  const { data: contract } = await admin
    .from("contracts")
    .select("organization_id")
    .eq("id", contractId)
    .single();

  if (!contract) return { error: "Contract not found" };

  if (!(await verifyOrgMembership(admin, user.id, contract.organization_id))) {
    return { error: "Access denied" };
  }

  const writeErr = await requireWriteAccess(admin, user.id, contract.organization_id);
  if (writeErr) return writeErr;

  const { data: pending } = await admin
    .from("extracted_fields")
    .select("id")
    .eq("contract_id", contractId)
    .eq("status", "pending");

  let approved = 0;
  for (const row of pending ?? []) {
    const res = await updateContractField(row.id, "approved");
    if (res && "error" in res && res.error) continue;
    approved++;
  }

  return {
    success: true,
    approved,
    pending_total: pending?.length ?? 0,
  };
}

function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^/.]+$/, "").trim();
  return base || fileName;
}

export async function bulkCreateContractsFromFiles(formData: FormData) {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const organizationId = (formData.get("organizationId") as string)?.trim() ?? "";
  if (!organizationId) return { error: "Organization is required" };
  if (!isUuid(organizationId)) return { error: "Invalid organization" };

  if (!(await verifyOrgMembership(admin, user.id, organizationId))) {
    return { error: "Access denied" };
  }

  const writeErr = await requireWriteAccess(admin, user.id, organizationId);
  if (writeErr) return writeErr;

  const files = (formData.getAll("files") as File[]).filter((file) => file.size > 0);
  if (files.length > MAX_CONTRACT_UPLOAD_FILES) {
    return { error: `Upload at most ${MAX_CONTRACT_UPLOAD_FILES} files at a time.` };
  }
  const validatedFiles = await Promise.all(files.map(async (file) => ({ file, validation: await getSafeUploadedContractFile(file) })));
  const acceptedFiles = validatedFiles.filter((entry): entry is { file: File; validation: { ok: true; safeName: string } } => entry.validation.ok);
  const validFiles = dedupeValidatedUploadedFiles(acceptedFiles).files;

  if (validFiles.length === 0) {
    return { error: "Add at least one PDF or DOCX under 20 MB." };
  }

  const { count: contractsBeforeCreate } = await admin
    .from("contracts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  const { data: job, error: jobError } = await admin
    .from("contract_import_jobs")
    .insert({
      organization_id: organizationId,
      created_by: user.id,
      source: "files",
      status: "processing",
      total_rows: validFiles.length,
    })
    .select("id")
    .single();

  if (jobError || !job) {
    const code = mapDataSourceError(jobError?.message ?? "Could not create import job");
    await emitVisibleMutationErrorTelemetry(admin, {
      organizationId,
      userId: user.id,
      contractId: null,
      surface: "contracts_bulk_import",
      mutation: "bulkCreateContractsFromFiles",
      code,
    });
    return { error: code };
  }

  await emitProductTelemetryEvent(admin, {
    organizationId,
    userId: user.id,
    action: "product.v9.import_started",
    details: {
      job_row_count: validFiles.length,
      source: "files",
      file_count: validFiles.length,
    },
  });

  const createdIds: string[] = [];
  const rowErrors: string[] = [];
  const rowResults: Array<{
    row_index: number;
    title: string;
    owner_email: string | null;
    status: "valid" | "inserted" | "error";
    error_message: string | null;
    contract_id: string | null;
  }> = [];

  for (let i = 0; i < validFiles.length; i++) {
    const { file, validation } = validFiles[i];
    const safeName = validation.safeName;
    const title = titleFromFileName(safeName).slice(0, MAX_CONTRACT_TITLE);
    const { data: contract, error: insertErr } = await admin
      .from("contracts")
      .insert({
        title,
        counterparty: null,
        contract_type: null,
        organization_id: organizationId,
        owner_id: user.id,
        created_by: user.id,
        status: "pending_review",
      })
      .select("id")
      .single();

    if (insertErr || !contract) {
      rowErrors.push(`${safeName}: ${insertErr?.message ?? "insert failed"}`);
      rowResults.push({
        row_index: i + 1,
        title: safeName,
        owner_email: null,
        status: "error",
        error_message: insertErr?.message ?? "insert failed",
        contract_id: null,
      });
      continue;
    }

    const storagePath = buildContractStoragePath(organizationId, contract.id, safeName);

    const { error: uploadError } = await admin.storage
      .from("contracts")
      .upload(storagePath, file);

    if (uploadError) {
      await admin.from("contracts").delete().eq("id", contract.id);
      rowErrors.push(`${safeName}: ${uploadError.message}`);
      rowResults.push({
        row_index: i + 1,
        title: safeName,
        owner_email: null,
        status: "error",
        error_message: uploadError.message,
        contract_id: null,
      });
      continue;
    }

    await admin.from("contract_files").insert({
      contract_id: contract.id,
      file_name: safeName,
      file_type: file.type,
      file_size: file.size,
      storage_path: storagePath,
      uploaded_by: user.id,
    });

    await admin.from("audit_events").insert({
      organization_id: organizationId,
      contract_id: contract.id,
      user_id: user.id,
      action: "contract.created",
      details: { title, bulk: true },
    });

    createdIds.push(contract.id);
    rowResults.push({
      row_index: i + 1,
      title: safeName,
      owner_email: null,
      status: "inserted",
      error_message: null,
      contract_id: contract.id,
    });

    if (
      process.env.OPENAI_API_KEY &&
      !process.env.OPENAI_API_KEY.includes("placeholder")
    ) {
      triggerExtraction(contract.id).catch(console.error);
    }
  }

  if (rowResults.length > 0) {
    await admin.from("contract_import_job_rows").insert(
      rowResults.map((row) => ({
        job_id: job.id,
        organization_id: organizationId,
        ...row,
      }))
    );
  }
  await admin
    .from("contract_import_jobs")
    .update({
      status: rowErrors.length === validFiles.length ? "failed" : "completed",
      valid_rows: validFiles.length - rowErrors.length,
      inserted_rows: createdIds.length,
      error_rows: rowErrors.length,
    })
    .eq("id", job.id);

  const importAction =
    rowErrors.length === validFiles.length
      ? "product.v9.import_failed"
      : rowErrors.length > 0
        ? "product.v9.import_partially_completed"
        : "product.v9.import_completed";
  await emitProductTelemetryEvent(admin, {
    organizationId,
    userId: user.id,
    contractId: createdIds[0] ?? null,
    action: importAction,
    details: {
      job_row_count: validFiles.length,
      valid_row_count: validFiles.length - rowErrors.length,
      inserted_row_count: createdIds.length,
      error_row_count: rowErrors.length,
      source: "files",
      file_count: validFiles.length,
    },
  });

  if ((contractsBeforeCreate ?? 0) === 0 && createdIds.length > 0) {
    await emitProductTelemetryIfFirstInOrganization(admin, {
      organizationId,
      userId: user.id,
      contractId: createdIds[0],
      action: "product.v9.first_contract_created",
      details: { intake: "bulk_files" },
    });
  }

  await recordV10ContractMutation(admin, {
    organizationId,
    actorUserId: user.id,
    action: "import.files_completed",
    targetType: "import_job",
    targetId: job.id,
    contractId: createdIds[0] ?? null,
    afterStateHash: rowErrors.length ? "partial" : "succeeded",
    safeMetadata: {
      file_count: validFiles.length,
      inserted_row_count: createdIds.length,
      error_row_count: rowErrors.length,
    },
  });

  return {
    success: createdIds.length > 0,
    created: createdIds.length,
    contract_ids: createdIds,
    job_id: job?.id ?? null,
    errors: rowErrors.length ? rowErrors : undefined,
  };
}

export async function updateContractOwner(contractId: string, newOwnerId: string) {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(contractId) || !isUuid(newOwnerId)) {
    return { error: "Invalid request" };
  }

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id, owner_id")
    .eq("id", contractId)
    .single();

  if (!contract) return { error: "Contract not found" };

  if (!(await verifyOrgMembership(admin, user.id, contract.organization_id))) {
    return { error: "Access denied" };
  }

  const writeErr = await requireWriteAccess(admin, user.id, contract.organization_id);
  if (writeErr) return writeErr;

  if (!(await verifyOrgMembership(admin, newOwnerId, contract.organization_id))) {
    return { error: "New owner must be a member of this organization." };
  }

  const { error } = await admin
    .from("contracts")
    .update({ owner_id: newOwnerId, owner_assigned_at: new Date().toISOString() })
    .eq("id", contractId);

  if (error) return { error: mapDataSourceError(error.message) };

  await admin
    .from("reminders")
    .update({ recipient_id: newOwnerId })
    .eq("contract_id", contractId)
    .is("sent_at", null);

  const { data: reassignedTasks } = await admin
    .from("contract_tasks")
    .select("id")
    .eq("contract_id", contractId)
    .in("status", ["open", "in_progress", "blocked"]);

  await admin
    .from("contract_tasks")
    .update({ assignee_id: newOwnerId })
    .eq("contract_id", contractId)
    .in("status", ["open", "in_progress", "blocked"]);

  if ((reassignedTasks?.length ?? 0) > 0) {
    await admin.from("contract_task_events").insert(
      reassignedTasks!.map((task) => ({
        organization_id: contract.organization_id,
        contract_id: contractId,
        task_id: task.id,
        actor_id: user.id,
        event_type: "reassigned",
        details: { assignee_id: newOwnerId, reason: "contract_owner_changed" },
      }))
    );
  }

  await admin
    .from("contract_approvals")
    .update({ approver_id: newOwnerId })
    .eq("contract_id", contractId)
    .eq("status", "pending");

  if (contract.owner_id && contract.owner_id !== newOwnerId) {
    const { data: oldWatch } = await admin
      .from("contract_watchlists")
      .select("team_key, note")
      .eq("contract_id", contractId)
      .eq("user_id", contract.owner_id)
      .maybeSingle();
    if (oldWatch) {
      await admin.from("contract_watchlists").upsert(
        {
          contract_id: contractId,
          organization_id: contract.organization_id,
          user_id: newOwnerId,
          team_key: oldWatch.team_key ?? "ops",
          note: oldWatch.note ?? "Auto-transferred due to ownership change",
        },
        { onConflict: "contract_id,user_id", ignoreDuplicates: false }
      );
      await admin
        .from("contract_watchlists")
        .delete()
        .eq("contract_id", contractId)
        .eq("user_id", contract.owner_id);
    }
  }

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: contractId,
    user_id: user.id,
    action: "contract.owner_changed",
    details: { new_owner_id: newOwnerId },
  });

  await enqueueOutboundEvent({
    organizationId: contract.organization_id,
    eventType: "contract.owner_changed",
    entityType: "contract",
    entityId: contractId,
    payload: { new_owner_id: newOwnerId },
  });
  await recordV10ContractMutation(admin, {
    organizationId: contract.organization_id,
    actorUserId: user.id,
    action: "contract.owner_changed",
    targetType: "contract",
    targetId: contractId,
    contractId,
    beforeStateHash: contract.owner_id ?? "unassigned",
    afterStateHash: newOwnerId,
    safeMetadata: {
      prior_owner_assigned: Boolean(contract.owner_id),
      reassigned_task_count: reassignedTasks?.length ?? 0,
    },
  });

  return { success: true };
}

const BULK_OWNER_ASSIGN_CAP = 60;

export async function bulkAssignContractOwners(
  formData: FormData
): Promise<{ error?: string; success?: true; updated?: number }> {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const rawIds = String(formData.get("contractIds") ?? "").trim();
  const newOwnerId = String(formData.get("newOwnerId") ?? "").trim();
  if (!newOwnerId || !isUuid(newOwnerId)) return { error: "Select a valid owner" };

  const contractIds = [
    ...new Set(
      rawIds
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter((s) => isUuid(s))
    ),
  ].slice(0, BULK_OWNER_ASSIGN_CAP);

  if (contractIds.length === 0) return { error: "No contracts selected" };

  let updated = 0;
  let orgIdForTelemetry: string | null = null;
  for (const contractId of contractIds) {
    const res = await updateContractOwner(contractId, newOwnerId);
    if ("error" in res && res.error) {
      if (!orgIdForTelemetry) {
        const { data: row } = await admin
          .from("contracts")
          .select("organization_id")
          .eq("id", contractId)
          .maybeSingle();
        orgIdForTelemetry = row?.organization_id ?? null;
      }
      if (orgIdForTelemetry) {
        await emitVisibleMutationErrorTelemetry(admin, {
          organizationId: orgIdForTelemetry,
          userId: user.id,
          contractId,
          surface: "contracts",
          mutation: "bulkAssignContractOwners",
          code: res.error,
        });
      }
      return { error: `${res.error} (stopped after ${updated} updates)` };
    }
    if (!orgIdForTelemetry) {
      const { data: row } = await admin
        .from("contracts")
        .select("organization_id")
        .eq("id", contractId)
        .maybeSingle();
      orgIdForTelemetry = row?.organization_id ?? null;
    }
    updated += 1;
  }

  if (orgIdForTelemetry) {
    await emitProductTelemetryEvent(admin, {
      organizationId: orgIdForTelemetry,
      userId: user.id,
      action: "product.v9.bulk_owner_assigned",
      details: { count: updated },
    });
  }

  revalidatePath("/contracts");
  return { success: true, updated };
}

export async function getFileDownloadUrl(storagePath: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const parsedPath = parseContractStoragePath(storagePath);
  if (!parsedPath || !isContractStoragePathSafe(storagePath)) {
    return { error: "Invalid file path" };
  }

  const admin = await createAdminClient();

  const { data: file } = await admin
    .from("contract_files")
    .select("id, contract_id, contracts!inner(organization_id)")
    .eq("storage_path", storagePath)
    .single();

  if (!file) return { error: "File not found" };

  const orgId = (file.contracts as unknown as { organization_id: string }).organization_id;
  const fileContractId = String(file.contract_id ?? "");
  if (parsedPath.organizationId !== orgId || parsedPath.contractId !== fileContractId) {
    return { error: "Invalid file path" };
  }

  if (!(await verifyOrgMembership(admin, user.id, orgId))) {
    return { error: "Access denied" };
  }

  const { data, error } = await admin.storage
    .from("contracts")
    .createSignedUrl(storagePath, CONTRACT_FILE_SIGNED_URL_TTL_SECONDS);

  if (error) return { error: mapDataSourceError(error.message) };
  await recordV10AuditEvent(admin, {
    organizationId: orgId,
    actorUserId: user.id,
    action: "contract_file.download_url_created",
    targetType: "contract_file",
    targetId: String(file.id ?? "unknown"),
    contractId: String(file.contract_id ?? ""),
    outcome: "success",
    safeMetadata: {
      expires_in_seconds: CONTRACT_FILE_SIGNED_URL_TTL_SECONDS,
      storage_bucket: "contracts",
    },
  });
  return { url: data.signedUrl, expiresIn: CONTRACT_FILE_SIGNED_URL_TTL_SECONDS };
}

export async function updateContractStatus(
  contractId: string,
  newStatus: string
) {
  return await updateContractStatusImpl(contractId, newStatus, applyContractTemplatePack);
}

export async function updateContractOperationalState(input: {
  contractId: string;
  intakeStatus:
    | "awaiting_review"
    | "in_clarification"
    | "active"
    | "at_risk"
    | "renewal_prep"
    | "notice_decision"
    | "archived";
  healthStatus: "healthy" | "watch" | "at_risk" | "unknown";
  requiredNextStep?: string | null;
  intakeOwnerId?: string | null;
  intakeSource?: string | null;
  intakeCompletenessScore?: number | null;
}) {
  return await updateContractOperationalStateImpl(input);
}

export async function updateContractOperationalStateForm(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const intakeStatus = String(formData.get("intakeStatus") ?? "").trim();
  const healthStatus = String(formData.get("healthStatus") ?? "").trim();
  const parsedIntakeStatus = parseFixedEnumParam(intakeStatus, CONTRACT_INTAKE_STATUSES, "awaiting_review");
  const parsedHealthStatus = parseFixedEnumParam(healthStatus, CONTRACT_HEALTH_STATUSES, "unknown");
  const requiredNextStep = optionalContractText(
    formData.get("requiredNextStep") ?? "",
    "Required next step",
    MAX_REQUIRED_NEXT_STEP_LEN,
    { allowTextWhitespaceControls: true }
  );
  const intakeSource = optionalContractText(formData.get("intakeSource") ?? "", "Intake source", MAX_SOURCE_SYSTEM_LEN);
  const intakeOwnerId = String(formData.get("intakeOwnerId") ?? "").trim();
  if (parsedIntakeStatus !== intakeStatus || parsedHealthStatus !== healthStatus) {
    console.error("[contracts] updateContractOperationalStateForm", "Invalid operational state");
    return;
  }
  if (!requiredNextStep.ok) {
    console.error("[contracts] updateContractOperationalStateForm", requiredNextStep.error);
    return;
  }
  if (!intakeSource.ok) {
    console.error("[contracts] updateContractOperationalStateForm", intakeSource.error);
    return;
  }
  if (intakeOwnerId && !isUuid(intakeOwnerId)) {
    console.error("[contracts] updateContractOperationalStateForm", "Invalid intake owner");
    return;
  }
  const res = await updateContractOperationalState({
    contractId,
    intakeStatus: parsedIntakeStatus,
    healthStatus: parsedHealthStatus,
    requiredNextStep: requiredNextStep.value,
    intakeOwnerId: intakeOwnerId || null,
    intakeSource: intakeSource.value,
    intakeCompletenessScore: optionalPercentFormValue(formData, "intakeCompletenessScore"),
  });
  if (res && "error" in res && res.error) {
    console.error("[contracts] updateContractOperationalStateForm", res.error);
  }
}

export async function upsertContractIntakeRequest(input: {
  contractId?: string | null;
  source?: string | null;
  sourceLabel?: string | null;
  status?: "new" | "triage" | "review" | "ready" | "rejected";
  assignedTo?: string | null;
  completenessScore?: number | null;
  payload?: Record<string, unknown>;
  rejectionReason?: string | null;
}) {
  return await upsertContractIntakeRequestImpl(input);
}

export async function upsertContractIntakeRequestForm(formData: FormData) {
  const statusRaw = String(formData.get("status") ?? "").trim() || "new";
  const status = parseFixedEnumParam(statusRaw, INTAKE_REQUEST_STATUSES, "new");
  const source = optionalContractText(formData.get("source") ?? "", "Source", MAX_SOURCE_SYSTEM_LEN);
  const sourceLabel = optionalContractText(formData.get("sourceLabel") ?? "", "Source label", MAX_INTAKE_SOURCE_LABEL_LEN);
  const rejectionReason = optionalContractText(
    formData.get("rejectionReason") ?? "",
    "Rejection reason",
    MAX_REJECTION_REASON_LEN,
    { allowTextWhitespaceControls: true }
  );
  const contractId = String(formData.get("contractId") ?? "").trim();
  const assignedTo = String(formData.get("assignedTo") ?? "").trim();
  if (status !== statusRaw) {
    console.error("[contracts] upsertContractIntakeRequestForm", "Invalid intake status");
    return;
  }
  if (!source.ok) {
    console.error("[contracts] upsertContractIntakeRequestForm", source.error);
    return;
  }
  if (!sourceLabel.ok) {
    console.error("[contracts] upsertContractIntakeRequestForm", sourceLabel.error);
    return;
  }
  if (!rejectionReason.ok) {
    console.error("[contracts] upsertContractIntakeRequestForm", rejectionReason.error);
    return;
  }
  if (contractId && !isUuid(contractId)) {
    console.error("[contracts] upsertContractIntakeRequestForm", "Invalid contract");
    return;
  }
  if (assignedTo && !isUuid(assignedTo)) {
    console.error("[contracts] upsertContractIntakeRequestForm", "Invalid assignee");
    return;
  }
  const res = await upsertContractIntakeRequest({
    contractId: contractId || null,
    source: source.value,
    sourceLabel: sourceLabel.value,
    status,
    assignedTo: assignedTo || null,
    completenessScore: optionalPercentFormValue(formData, "completenessScore"),
    rejectionReason: rejectionReason.value,
  });
  if (res && "error" in res && res.error) {
    console.error("[contracts] upsertContractIntakeRequestForm", res.error);
  }
}

export async function updateContractExternalLink(input: {
  contractId: string;
  sourceSystem?: string | null;
  region?: string | null;
  annualValue?: string | number | null;
  externalReferenceId?: string | null;
}) {
  return await updateContractExternalLinkImpl(input);
}

export async function updateContractExternalLinkForm(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const sourceSystem = optionalContractText(formData.get("sourceSystem") ?? "", "Source system", MAX_SOURCE_SYSTEM_LEN);
  const region = optionalContractText(formData.get("region") ?? "", "Region", MAX_REGION_LEN);
  const annualValueValidation = validateBoundedString(formData.get("annualValue") ?? "", {
    maxLength: MAX_ANNUAL_VALUE_INPUT_LEN,
    allowEmpty: true,
  });
  const externalReferenceId = optionalContractText(
    formData.get("externalReferenceId") ?? "",
    "External reference",
    MAX_EXTERNAL_REF_LEN
  );
  if (!sourceSystem.ok) {
    console.error("[contracts] updateContractExternalLinkForm", sourceSystem.error);
    return;
  }
  if (!region.ok) {
    console.error("[contracts] updateContractExternalLinkForm", region.error);
    return;
  }
  if (!externalReferenceId.ok) {
    console.error("[contracts] updateContractExternalLinkForm", externalReferenceId.error);
    return;
  }
  if (!annualValueValidation.ok) {
    console.error("[contracts] updateContractExternalLinkForm", "Annual value must be a valid positive number.");
    return;
  }
  const res = await updateContractExternalLink({
    contractId,
    sourceSystem: sourceSystem.value,
    region: region.value,
    annualValue: annualValueValidation.value || null,
    externalReferenceId: externalReferenceId.value,
  });
  if (res && "error" in res && res.error) {
    console.error("[contracts] updateContractExternalLinkForm", res.error);
  }
}

export async function deleteContract(contractId: string) { return await deleteContractImpl(contractId); }
export async function applyContractTemplatePack(contractId: string) { return await applyContractTemplatePackImpl(contractId); }

export async function applyContractTemplatePackForm(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const res = await applyContractTemplatePack(contractId);
  if (res && "error" in res && res.error) {
    console.error("[contracts] applyContractTemplatePackForm", res.error);
  }
}
