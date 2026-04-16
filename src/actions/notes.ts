"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getContractAccessContext } from "@/lib/actions/access";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import { isUuid } from "@/lib/security/validation";

const MAX_NOTE_LEN = 5000;

async function getNoteContext(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  noteId: string
) {
  return await admin
    .from("contract_notes")
    .select("id, contract_id, organization_id, author_id, pinned")
    .eq("id", noteId)
    .maybeSingle();
}

async function getUserContextForContract(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string,
  contractId: string
) {
  const access = await getContractAccessContext(admin, userId, contractId);
  if (!access.ok) return null;
  return {
    contractId,
    orgId: access.ctx.orgId,
    role: access.ctx.role,
  };
}

export async function createContractNote(input: {
  contractId: string;
  note: string;
  pinned?: boolean;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.contractId)) return { error: "Invalid contract" };

  const note = input.note.trim();
  if (!note) return { error: "Note cannot be empty" };
  if (note.length > MAX_NOTE_LEN) return { error: "Note is too long" };

  const ctx = await getUserContextForContract(admin, user.id, input.contractId);
  if (!ctx) return { error: "Access denied" };

  const pin = Boolean(input.pinned);
  if (pin && !canEditContracts(ctx.role)) {
    return { error: "Only editors/admins can pin notes." };
  }

  const { data: created, error } = await admin
    .from("contract_notes")
    .insert({
      contract_id: ctx.contractId,
      organization_id: ctx.orgId,
      author_id: user.id,
      note,
      pinned: pin,
    })
    .select("id")
    .single();

  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: ctx.orgId,
    contract_id: ctx.contractId,
    user_id: user.id,
    action: "note.created",
    details: { note_id: created.id, pinned: pin },
  });

  return { success: true as const, noteId: created.id };
}

export async function toggleContractNotePin(noteId: string, pinned: boolean) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(noteId)) return { error: "Invalid note" };

  const { data: note } = await getNoteContext(admin, noteId);
  if (!note) return { error: "Note not found" };

  const role = await getOrgMemberRole(admin, user.id, note.organization_id);
  if (!canEditContracts(role)) return { error: "Viewers cannot pin notes." };

  const { error } = await admin
    .from("contract_notes")
    .update({ pinned })
    .eq("id", noteId);
  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: note.organization_id,
    contract_id: note.contract_id,
    user_id: user.id,
    action: pinned ? "note.pinned" : "note.unpinned",
    details: { note_id: noteId },
  });

  return { success: true as const };
}

export async function deleteContractNote(noteId: string) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(noteId)) return { error: "Invalid note" };

  const { data: note } = await getNoteContext(admin, noteId);
  if (!note) return { error: "Note not found" };

  const role = await getOrgMemberRole(admin, user.id, note.organization_id);
  const canDelete = note.author_id === user.id || canEditContracts(role);
  if (!canDelete) return { error: "Only note authors or editors/admins can delete this note." };

  const { error } = await admin.from("contract_notes").delete().eq("id", noteId);
  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: note.organization_id,
    contract_id: note.contract_id,
    user_id: user.id,
    action: "note.deleted",
    details: { note_id: noteId },
  });

  return { success: true as const };
}
