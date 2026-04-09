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

export async function createContractsSavedView(formData: FormData) {
  await createSavedView(formData, "contracts");
}

export async function createSavedView(formData: FormData, fallbackType?: SavedViewType) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

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

  if (!name) return;
  if (name.length > MAX_NAME_LEN) return;
  if (!orgId || !isUuid(orgId)) return;
  if (owner && !isUuid(owner)) return;

  const { data: membership } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return;

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
    console.error("[saved-views] create", mapDataSourceError(error.message));
    return;
  }
  revalidatePath("/contracts");
  if (viewType === "tasks") revalidatePath("/contracts/tasks");
  if (viewType === "obligations") revalidatePath("/contracts/obligations");
  if (viewType === "renewals") revalidatePath("/contracts/renewals");
}

export async function setSavedViewPinned(savedViewId: string, pinned: boolean) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  if (!isUuid(savedViewId)) return;

  const { data: row } = await admin
    .from("saved_views")
    .select("id, user_id, view_type, query_json")
    .eq("id", savedViewId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) return;
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
    console.error("[saved-views] set pinned", mapDataSourceError(error.message));
    return;
  }
  revalidatePath("/contracts");
  if (row.view_type === "tasks") revalidatePath("/contracts/tasks");
  if (row.view_type === "obligations") revalidatePath("/contracts/obligations");
  if (row.view_type === "renewals") revalidatePath("/contracts/renewals");
}

export async function deleteSavedView(savedViewId: string) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  if (!isUuid(savedViewId)) return;

  const { error } = await admin
    .from("saved_views")
    .delete()
    .eq("id", savedViewId)
    .eq("user_id", user.id);

  if (error) {
    console.error("[saved-views] delete", mapDataSourceError(error.message));
    return;
  }
  revalidatePath("/contracts");
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
  if (!user) return;
  if (!isUuid(savedViewId)) return;

  const { data: savedView } = await admin
    .from("saved_views")
    .select("id, organization_id, user_id")
    .eq("id", savedViewId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!savedView) return;

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
      console.error("[saved-views] enable weekly summary", mapDataSourceError(error.message));
      return;
    }
  } else {
    const { error } = await admin
      .from("report_subscriptions")
      .update({ active: false })
      .eq("user_id", user.id)
      .eq("saved_view_id", savedView.id)
      .eq("frequency", "weekly");
    if (error) {
      console.error("[saved-views] disable weekly summary", mapDataSourceError(error.message));
      return;
    }
  }

  revalidatePath("/contracts");
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
  if (!user) return;
  if (!isUuid(savedViewId)) return;

  const { data: savedView } = await admin
    .from("saved_views")
    .select("id, organization_id, user_id")
    .eq("id", savedViewId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!savedView) return;

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
      console.error("[saved-views] enable monthly summary", mapDataSourceError(error.message));
      return;
    }
  } else {
    const { error } = await admin
      .from("report_subscriptions")
      .update({ active: false })
      .eq("user_id", user.id)
      .eq("saved_view_id", savedView.id)
      .eq("frequency", "monthly");
    if (error) {
      console.error("[saved-views] disable monthly summary", mapDataSourceError(error.message));
      return;
    }
  }

  revalidatePath("/contracts");
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
  if (!user) return;
  if (!isUuid(savedViewId)) return;

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
  if (!savedView) return;

  const { error } = await admin
    .from("report_subscriptions")
    .update({ recipient_emails: recipients })
    .eq("user_id", user.id)
    .eq("saved_view_id", savedView.id)
    .in("frequency", ["weekly", "monthly"]);
  if (error) {
    console.error("[saved-views] set weekly recipients", mapDataSourceError(error.message));
    return;
  }

  revalidatePath("/contracts");
}
