"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { isUuid } from "@/lib/security/validation";

const MAX_NAME_LEN = 80;
const VIEW_TYPES = ["contracts", "tasks", "obligations", "renewals"] as const;
type SavedViewType = (typeof VIEW_TYPES)[number];

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

  const { error } = await admin.from("saved_views").upsert(
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
        mine,
        team,
        pinned,
      },
    },
    {
      onConflict: "user_id,view_type,name",
      ignoreDuplicates: false,
    }
  );

  if (error) {
    return { error: mapDataSourceError(error.message) };
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
    .select("id, user_id, view_type, query_json")
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

  const { error } = await admin
    .from("saved_views")
    .delete()
    .eq("id", savedViewId)
    .eq("user_id", user.id);

  if (error) {
    return { error: mapDataSourceError(error.message) };
  }
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
    .select("id, organization_id, user_id")
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
    .select("id, organization_id, user_id")
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
    .select("id, user_id")
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

  revalidatePath("/contracts");
  return { success: true as const };
}
