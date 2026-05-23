"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { isReasonableEmail, isUuid, validateBoundedString } from "@/lib/security/validation";
import { recordV10AuditEvent } from "@/lib/v10-server-contracts";
import { refreshV10ReadModelsForOrganization } from "@/lib/v10-read-model-refresh";
import type { AuditAction } from "@/lib/security/audit-actions";

const MAX_NAME_LEN = 80;
const MAX_FILTER_VALUE_LEN = 240;
const MAX_SEARCH_VALUE_LEN = 500;
const MAX_RECIPIENTS_CSV_LEN = 2000;
const MAX_SUMMARY_RECIPIENTS = 25;
const VIEW_TYPES = ["contracts", "tasks", "obligations", "renewals"] as const;
type SavedViewType = (typeof VIEW_TYPES)[number];
type SavedViewAuditAction = Extract<AuditAction, `saved_view.${string}`>;
type Admin = Awaited<ReturnType<typeof createAdminClient>>;
type OptionalStringValidation =
  | { ok: true; value: string | null }
  | { ok: false; error: "invalid_string" | "string_too_long" | "unsafe_characters" };

async function recordV10SavedViewMutation(
  admin: Admin,
  input: {
    organizationId: string;
    actorUserId: string;
    action: SavedViewAuditAction;
    savedViewId: string;
    viewType?: string | null;
    safeMetadata?: Record<string, string | number | boolean | null>;
  }
) {
  const auditEventId = await recordV10AuditEvent(admin, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: input.action,
    targetType: "saved_view",
    targetId: input.savedViewId,
    outcome: "success",
    safeMetadata: {
      view_type: input.viewType ?? "unknown",
      ...(input.safeMetadata ?? {}),
    },
  });
  await refreshV10ReadModelsForOrganization(admin, input.organizationId, {
    reason: input.action,
    refreshScope: "incremental",
  });
  return auditEventId;
}

function readOptionalSavedViewString(
  formData: FormData,
  key: string,
  options: { maxLength?: number } = {}
): OptionalStringValidation {
  const raw = formData.get(key) ?? "";
  const parsed = validateBoundedString(raw, {
    maxLength: options.maxLength ?? MAX_FILTER_VALUE_LEN,
    allowEmpty: true,
  });
  if (!parsed.ok) return parsed;
  return { ok: true, value: parsed.value || null };
}

function revalidateSavedViewPaths(viewType?: string | null) {
  revalidatePath("/contracts");
  if (viewType === "tasks") revalidatePath("/contracts/tasks");
  if (viewType === "obligations") revalidatePath("/contracts/obligations");
  if (viewType === "renewals") revalidatePath("/contracts/renewals");
}

export async function createContractsSavedView(formData: FormData) {
  await createSavedView(formData, "contracts");
}

/** `useActionState` wrapper — returns structured feedback without silent failure (§21–22). */
export type SavedViewCreateFeedbackState = { error?: string; ok?: boolean };

export async function createContractsSavedViewWithFeedback(
  _prev: SavedViewCreateFeedbackState | undefined,
  formData: FormData
): Promise<SavedViewCreateFeedbackState> {
  const result = await createSavedView(formData, "contracts");
  if (result && "error" in result && result.error) {
    return { error: result.error };
  }
  return { ok: true };
}

export async function createSavedView(formData: FormData, fallbackType?: SavedViewType) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const nameValidation = validateBoundedString(formData.get("name") ?? "", {
    maxLength: MAX_NAME_LEN,
  });
  if (!nameValidation.ok) {
    if (nameValidation.error === "string_too_long") return { error: "Name is too long" };
    if (nameValidation.error === "unsafe_characters") return { error: "Name contains unsupported characters" };
    return { error: "Name is required" };
  }
  const orgId = String(formData.get("organizationId") ?? "").trim();
  const filters = {
    status: readOptionalSavedViewString(formData, "status"),
    search: readOptionalSavedViewString(formData, "search", { maxLength: MAX_SEARCH_VALUE_LEN }),
    owner: readOptionalSavedViewString(formData, "owner"),
    counterparty: readOptionalSavedViewString(formData, "counterparty"),
    contract_type: readOptionalSavedViewString(formData, "contract_type"),
    region: readOptionalSavedViewString(formData, "region"),
    deadline: readOptionalSavedViewString(formData, "deadline"),
    sort: readOptionalSavedViewString(formData, "sort"),
    exceptions: readOptionalSavedViewString(formData, "exceptions"),
    review: readOptionalSavedViewString(formData, "review"),
    data_quality: readOptionalSavedViewString(formData, "data_quality"),
    evidence: readOptionalSavedViewString(formData, "evidence"),
    work: readOptionalSavedViewString(formData, "work"),
    mine: readOptionalSavedViewString(formData, "mine"),
    team: readOptionalSavedViewString(formData, "team"),
    viewType: readOptionalSavedViewString(formData, "viewType"),
    pinned: readOptionalSavedViewString(formData, "pinned"),
  };
  if (
    !filters.status.ok ||
    !filters.search.ok ||
    !filters.owner.ok ||
    !filters.counterparty.ok ||
    !filters.contract_type.ok ||
    !filters.region.ok ||
    !filters.deadline.ok ||
    !filters.sort.ok ||
    !filters.exceptions.ok ||
    !filters.review.ok ||
    !filters.data_quality.ok ||
    !filters.evidence.ok ||
    !filters.work.ok ||
    !filters.mine.ok ||
    !filters.team.ok ||
    !filters.viewType.ok ||
    !filters.pinned.ok
  ) {
    return { error: "Saved view filters contain unsupported characters" };
  }
  const name = nameValidation.value;
  const status = filters.status.value;
  const search = filters.search.value;
  const owner = filters.owner.value;
  const counterparty = filters.counterparty.value;
  const contract_type = filters.contract_type.value;
  const region = filters.region.value;
  const deadline = filters.deadline.value;
  const sort = filters.sort.value;
  const exceptions = filters.exceptions.value;
  const review = filters.review.value;
  const data_quality = filters.data_quality.value;
  const evidence = filters.evidence.value;
  const work = filters.work.value;
  const mine = filters.mine.value;
  const team = filters.team.value;
  const viewTypeRaw = filters.viewType.value;
  const pinned = filters.pinned.value === "1";
  const viewType =
    (viewTypeRaw && VIEW_TYPES.includes(viewTypeRaw as SavedViewType)
      ? (viewTypeRaw as SavedViewType)
      : fallbackType) ?? "contracts";

  if (!orgId || !isUuid(orgId)) return { error: "Invalid organization" };
  if (owner && !isUuid(owner)) return { error: "Invalid owner" };

  const { data: membership } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { error: "Access denied" };

  const { data: savedView, error } = await admin
    .from("saved_views")
    .upsert(
      {
        organization_id: orgId,
        user_id: user.id,
        view_type: viewType,
        name,
        query_json: {
          status,
          search,
          owner,
          counterparty,
          contract_type,
          region,
          deadline,
          sort,
          exceptions,
          review,
          data_quality,
          evidence,
          work,
          mine,
          team,
          pinned,
        },
      },
      {
        onConflict: "user_id,view_type,name",
        ignoreDuplicates: false,
      }
    )
    .select("id")
    .single();

  if (error) {
    return { error: mapDataSourceError(error.message) };
  }
  if (savedView?.id) {
    await recordV10SavedViewMutation(admin, {
      organizationId: orgId,
      actorUserId: user.id,
      action: "saved_view.upserted",
      savedViewId: savedView.id,
      viewType,
      safeMetadata: {
        pinned,
        has_search: Boolean(search),
        has_deadline: Boolean(deadline),
      },
    });
  }
  revalidateSavedViewPaths(viewType);
  return { success: true as const };
}

export async function setSavedViewPinned(savedViewId: string, pinned: boolean) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(savedViewId)) return { error: "Invalid saved view" };

  const { data: row } = await admin
    .from("saved_views")
    .select("id, organization_id, user_id, view_type, query_json")
    .eq("id", savedViewId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) return { error: "Saved view not found" };
  const queryJson = (row.query_json ?? {}) as Record<string, unknown>;
  const { error } = await admin
    .from("saved_views")
    .update({
      query_json: {
        ...queryJson,
        pinned,
      },
    })
    .eq("id", row.id)
    .eq("user_id", user.id);
  if (error) {
    return { error: mapDataSourceError(error.message) };
  }
  await recordV10SavedViewMutation(admin, {
    organizationId: row.organization_id,
    actorUserId: user.id,
    action: "saved_view.pinned_changed",
    savedViewId: row.id,
    viewType: row.view_type,
    safeMetadata: { pinned },
  });
  revalidateSavedViewPaths(row.view_type);
  return { success: true as const };
}

export async function deleteSavedView(savedViewId: string) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(savedViewId)) return { error: "Invalid saved view" };

  const { data: row } = await admin
    .from("saved_views")
    .select("id, organization_id, view_type")
    .eq("id", savedViewId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) return { error: "Saved view not found" };

  const { error } = await admin
    .from("saved_views")
    .delete()
    .eq("id", savedViewId)
    .eq("user_id", user.id);

  if (error) {
    return { error: mapDataSourceError(error.message) };
  }
  await recordV10SavedViewMutation(admin, {
    organizationId: row.organization_id,
    actorUserId: user.id,
    action: "saved_view.deleted",
    savedViewId,
    viewType: row.view_type,
  });
  revalidatePath("/contracts");
  return { success: true as const };
}

export async function setSavedViewWeeklySummary(
  savedViewId: string,
  enable: boolean
) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(savedViewId)) return { error: "Invalid saved view" };

  const { data: savedView } = await admin
    .from("saved_views")
    .select("id, organization_id, user_id, view_type")
    .eq("id", savedViewId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!savedView) return { error: "Saved view not found" };

  if (enable) {
    const { error } = await admin.from("report_subscriptions").upsert(
      {
        organization_id: savedView.organization_id,
        user_id: user.id,
        saved_view_id: savedView.id,
        frequency: "weekly",
        active: true,
        next_run_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,saved_view_id,frequency",
        ignoreDuplicates: false,
      }
    );
    if (error) {
      return { error: mapDataSourceError(error.message) };
    }
  } else {
    const { error } = await admin
      .from("report_subscriptions")
      .update({ active: false })
      .eq("user_id", user.id)
      .eq("saved_view_id", savedView.id)
      .eq("frequency", "weekly");
    if (error) {
      return { error: mapDataSourceError(error.message) };
    }
  }

  await recordV10SavedViewMutation(admin, {
    organizationId: savedView.organization_id,
    actorUserId: user.id,
    action: "saved_view.summary_subscription_updated",
    savedViewId: savedView.id,
    viewType: savedView.view_type,
    safeMetadata: { frequency: "weekly", active: enable },
  });
  revalidatePath("/contracts");
  return { success: true as const };
}

export async function setSavedViewMonthlySummary(
  savedViewId: string,
  enable: boolean
) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(savedViewId)) return { error: "Invalid saved view" };

  const { data: savedView } = await admin
    .from("saved_views")
    .select("id, organization_id, user_id, view_type")
    .eq("id", savedViewId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!savedView) return { error: "Saved view not found" };

  if (enable) {
    const { error } = await admin.from("report_subscriptions").upsert(
      {
        organization_id: savedView.organization_id,
        user_id: user.id,
        saved_view_id: savedView.id,
        frequency: "monthly",
        active: true,
        next_run_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,saved_view_id,frequency",
        ignoreDuplicates: false,
      }
    );
    if (error) {
      return { error: mapDataSourceError(error.message) };
    }
  } else {
    const { error } = await admin
      .from("report_subscriptions")
      .update({ active: false })
      .eq("user_id", user.id)
      .eq("saved_view_id", savedView.id)
      .eq("frequency", "monthly");
    if (error) {
      return { error: mapDataSourceError(error.message) };
    }
  }

  await recordV10SavedViewMutation(admin, {
    organizationId: savedView.organization_id,
    actorUserId: user.id,
    action: "saved_view.summary_subscription_updated",
    savedViewId: savedView.id,
    viewType: savedView.view_type,
    safeMetadata: { frequency: "monthly", active: enable },
  });
  revalidatePath("/contracts");
  return { success: true as const };
}

export async function setSavedViewWeeklyRecipients(
  savedViewId: string,
  formData: FormData
) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(savedViewId)) return { error: "Invalid saved view" };

  const recipientsCsvValidation = validateBoundedString(formData.get("recipientsCsv") ?? "", {
    maxLength: MAX_RECIPIENTS_CSV_LEN,
    allowEmpty: true,
  });
  if (!recipientsCsvValidation.ok) return { error: "Invalid recipients" };
  const recipientsCsv = recipientsCsvValidation.value;
  const recipients = recipientsCsv
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter((v) => !!v && isReasonableEmail(v))
    .slice(0, MAX_SUMMARY_RECIPIENTS);

  const { data: savedView } = await admin
    .from("saved_views")
    .select("id, organization_id, user_id, view_type")
    .eq("id", savedViewId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!savedView) return { error: "Saved view not found" };

  const { error } = await admin
    .from("report_subscriptions")
    .update({ recipient_emails: recipients })
    .eq("user_id", user.id)
    .eq("saved_view_id", savedView.id)
    .in("frequency", ["weekly", "monthly"]);
  if (error) {
    return { error: mapDataSourceError(error.message) };
  }

  await recordV10SavedViewMutation(admin, {
    organizationId: savedView.organization_id,
    actorUserId: user.id,
    action: "saved_view.summary_recipients_updated",
    savedViewId: savedView.id,
    viewType: savedView.view_type,
    safeMetadata: { recipient_count: recipients.length },
  });
  revalidatePath("/contracts");
  return { success: true as const };
}
