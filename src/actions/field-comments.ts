"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { getOrgMemberRole } from "@/lib/permissions";
import { isUuid } from "@/lib/security/validation";
import { isNotificationTypeAllowedForWorkspace } from "@/lib/notification-policy";

const MAX_COMMENT_LEN = 4000;

async function resolveMentionsToUserIds(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  organizationId: string,
  comment: string
): Promise<string[]> {
  const matches = [...comment.matchAll(/@([A-Za-z0-9._@-]+)/g)].map((m) => m[1].toLowerCase());
  if (matches.length === 0) return [];

  const { data: members } = await admin
    .from("organization_members")
    .select("user_id, profiles(full_name, email)")
    .eq("organization_id", organizationId);

  const resolved = new Set<string>();
  for (const token of matches) {
    if (isUuid(token)) {
      resolved.add(token);
      continue;
    }
    for (const member of members ?? []) {
      const profile = member.profiles as unknown as { full_name: string | null; email: string | null } | null;
      const email = profile?.email?.toLowerCase() ?? "";
      const fullName = profile?.full_name?.toLowerCase() ?? "";
      const fullNameSlug = fullName.replace(/\s+/g, ".");
      const localPart = email.includes("@") ? email.split("@")[0] : "";
      if (token === email || token === localPart || token === fullNameSlug || token === fullName) {
        resolved.add(member.user_id);
      }
    }
  }
  return [...resolved];
}

export async function addFieldComment(input: {
  contractId: string;
  fieldId?: string | null;
  comment: string;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.contractId)) return { error: "Invalid contract" };
  if (input.fieldId && !isUuid(input.fieldId)) return { error: "Invalid field" };

  const comment = input.comment.trim();
  if (!comment) return { error: "Comment cannot be empty." };
  if (comment.length > MAX_COMMENT_LEN) return { error: "Comment is too long." };

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id")
    .eq("id", input.contractId)
    .maybeSingle();
  if (!contract) return { error: "Contract not found" };

  const role = await getOrgMemberRole(admin, user.id, contract.organization_id);
  if (!role) return { error: "Access denied" };

  const mentions = await resolveMentionsToUserIds(admin, contract.organization_id, comment);
  const { data: created, error } = await admin
    .from("contract_field_comments")
    .insert({
      contract_id: input.contractId,
      organization_id: contract.organization_id,
      field_id: input.fieldId ?? null,
      author_id: user.id,
      comment,
      mentions,
    })
    .select("id")
    .single();
  if (error) return { error: mapDataSourceError(error.message) };

  if (mentions.length > 0) {
    const { data: members } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", contract.organization_id)
      .in("user_id", mentions);
    const validMentionIds = (members ?? []).map((m) => m.user_id).filter((id) => id !== user.id);
    if (validMentionIds.length > 0) {
      const notificationsAllowed = await isNotificationTypeAllowedForWorkspace(admin as never, {
        organizationId: contract.organization_id,
        notificationType: "mention",
      });
      if (notificationsAllowed) {
        await admin.from("internal_notifications").insert(
          validMentionIds.map((userId) => ({
            organization_id: contract.organization_id,
            user_id: userId,
            notification_type: "mention",
            title: "You were mentioned on a contract field",
            body: comment.slice(0, 180),
            entity_type: "field_comment",
            entity_id: created.id,
          }))
        );
      }
    }
  }

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: input.contractId,
    user_id: user.id,
    action: "field.comment_added",
    details: { field_id: input.fieldId ?? null, mention_count: mentions.length },
  });

  return { success: true as const, commentId: created.id };
}

export async function addFieldCommentForm(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const fieldId = String(formData.get("fieldId") ?? "").trim();
  const comment = String(formData.get("comment") ?? "");
  const res = await addFieldComment({
    contractId,
    fieldId: fieldId || null,
    comment,
  });
  if (res && "error" in res && res.error) {
    console.error("[field-comments] addFieldCommentForm", res.error);
  }
}

export async function markNotificationRead(notificationId: string) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(notificationId)) return { error: "Invalid notification" };

  const { error } = await admin
    .from("internal_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id);
  if (error) return { error: mapDataSourceError(error.message) };
  return { success: true as const };
}

export async function markNotificationReadVoid(notificationId: string) {
  const res = await markNotificationRead(notificationId);
  if (res && "error" in res && res.error) {
    console.error("[field-comments] markNotificationReadVoid", res.error);
  }
}
