"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { isUuid } from "@/lib/security/validation";
import { recordV10AuditEvent } from "@/lib/v10-server-contracts";
import { refreshV10ReadModelsForOrganization } from "@/lib/v10-read-model-refresh";

const MAX_NAME_LEN = 80;
const VIEW_TYPES = ["contracts", "tasks", "obligations", "renewals"] as const;
type SavedViewType = (typeof VIEW_TYPES)[number];
type Admin = Awaited<ReturnType<typeof createAdminClient>>;

async function recordV10SavedViewMutation(
  admin: Admin,
  input: {
    organizationId: string;
    actorUserId: string;
    action: string;
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

function trimOrNull(v: FormDataEntryValue | null): string | null {
  const t = String(v ?? "").trim();
  return t ? t : null;
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

  const name = trimOrNull(formData.get("name"));
  const orgId = trimOrNull(formData.get("organizationId"));
  const status = trimOrNull(formData.get("status"));
  const search = trimOrNull(formData.get("search"));
  const owner = trimOrNull(formData.get("owner"));
  const region = trimOrNull(formData.get("region"));
  const deadline = trimOrNull(formData.get("deadline"));
  const sort = trimOrNull(formData.get("sort"));
  const exceptions = trimOrNull(formData.get("exceptions"));
  const review = trimOrNull(formData.get("review"));
  const data_quality = trimOrNull(formData.get("data_quality"));
  const evidence = trimOrNull(formData.get("evidence"));
  const mine = trimOrNull(formData.get("mine"));
  const team = trimOrNull(formData.get("team"));
  const viewTypeRaw = trimOrNull(formData.get("viewType"));
  const pinned = trimOrNull(formData.get("pinned")) === "1";
  const viewType =
    (viewTypeRaw && VIEW_TYPES.includes(viewTypeRaw as SavedViewType)
      ? (viewTypeRaw as SavedViewType)
      : fallbackType) ?? "contracts";

  if (!name) return { error: "Name is required" };
  if (name.length > MAX_NAME_LEN) return { error: "Name is too long" };
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
          region,
          deadline,
          sort,
          exceptions,
          review,
          data_quality,
          evidence,
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

  const recipientsCsv = String(formData.get("recipientsCsv") ?? "");
  const recipients = recipientsCsv
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter((v) => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));

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
