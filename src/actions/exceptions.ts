"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import { emitVisibleMutationErrorTelemetry } from "@/lib/product-telemetry";
import { isUuid } from "@/lib/security/validation";
import type { OrgRole } from "@/lib/types";

const MAX_RESOLUTION_NOTE_LEN = 4000;

async function appendExceptionEvent(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  input: {
    organizationId: string;
    exceptionId: string;
    actorId: string;
    eventType: "assigned" | "resolved" | "reopened";
    details?: Record<string, unknown>;
  }
) {
  await admin.from("exception_events").insert({
    organization_id: input.organizationId,
    exception_id: input.exceptionId,
    event_type: input.eventType,
    actor_user_id: input.actorId,
    details: input.details ?? {},
  });
}

async function ensureOwnerMember(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  orgId: string,
  ownerId: string
) {
  const { data } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", ownerId)
    .maybeSingle();
  return Boolean(data);
}

async function getEditableExceptionContext(exceptionId: string) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" as const };
  if (!isUuid(exceptionId)) return { error: "Invalid exception" as const };

  const { data: exception } = await admin
    .from("exceptions")
    .select("id, contract_id, organization_id, status, owner_id, due_date")
    .eq("id", exceptionId)
    .maybeSingle();
  if (!exception) return { error: "Exception not found" as const };

  const role = await getOrgMemberRole(admin, user.id, exception.organization_id);
  if (!canEditContracts(role as OrgRole)) {
    return { error: "Viewers cannot update exceptions." as const };
  }

  return { admin, userId: user.id, exception } as const;
}

async function emitExceptionMutationError(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  input: {
    organizationId: string;
    contractId: string | null;
    userId: string;
    mutation: "assignException" | "resolveException" | "reopenException";
    code: string;
  }
) {
  await emitVisibleMutationErrorTelemetry(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
    contractId: input.contractId,
    surface: "exceptions",
    mutation: input.mutation,
    code: input.code,
  });
}

export async function assignException(input: {
  exceptionId: string;
  ownerId: string;
  dueDate?: string | null;
}) {
  const ctx = await getEditableExceptionContext(input.exceptionId);
  if ("error" in ctx) return { error: ctx.error };

  const ownerId = input.ownerId.trim();
  const dueDate = input.dueDate?.trim() || null;
  if (!ownerId || !isUuid(ownerId)) return { error: "Select a valid owner." };
  if (dueDate && Number.isNaN(new Date(`${dueDate}T12:00:00`).getTime())) {
    return { error: "Enter a valid due date." };
  }
  if (!(await ensureOwnerMember(ctx.admin, ctx.exception.organization_id, ownerId))) {
    return { error: "Owner must be a member of this organization." };
  }
  if (!["open", "in_progress"].includes(ctx.exception.status)) {
    return { error: "Only active exceptions can be reassigned." };
  }

  const { error } = await ctx.admin
    .from("exceptions")
    .update({ owner_id: ownerId, due_date: dueDate, status: "in_progress" })
    .eq("organization_id", ctx.exception.organization_id)
    .eq("id", ctx.exception.id);
  if (error) {
    const code = mapDataSourceError(error.message);
    await emitExceptionMutationError(ctx.admin, {
      organizationId: ctx.exception.organization_id,
      contractId: ctx.exception.contract_id,
      userId: ctx.userId,
      mutation: "assignException",
      code,
    });
    return { error: code };
  }

  await ctx.admin.from("audit_events").insert({
    organization_id: ctx.exception.organization_id,
    contract_id: ctx.exception.contract_id,
    user_id: ctx.userId,
    action: "exception.assigned",
    details: { exception_id: ctx.exception.id, owner_id: ownerId, due_date: dueDate },
  });
  await appendExceptionEvent(ctx.admin, {
    organizationId: ctx.exception.organization_id,
    exceptionId: ctx.exception.id,
    actorId: ctx.userId,
    eventType: "assigned",
    details: { owner_id: ownerId, due_date: dueDate },
  });

  revalidatePath("/contracts/exceptions");
  if (ctx.exception.contract_id) revalidatePath(`/contracts/${ctx.exception.contract_id}`);
  return {
    success: true as const,
    message: "Owner and due date saved. This exception is now in progress.",
  };
}

export async function resolveException(input: {
  exceptionId: string;
  resolutionNote?: string | null;
}) {
  const ctx = await getEditableExceptionContext(input.exceptionId);
  if ("error" in ctx) return { error: ctx.error };

  const resolutionNote = input.resolutionNote?.trim() || null;
  if (resolutionNote && resolutionNote.length > MAX_RESOLUTION_NOTE_LEN) {
    return { error: "Resolution note is too long." };
  }
  if (!["open", "in_progress"].includes(ctx.exception.status)) {
    return { error: "Only active exceptions can be resolved." };
  }

  const { error } = await ctx.admin
    .from("exceptions")
    .update({ status: "resolved", resolution_note: resolutionNote, resolved_at: new Date().toISOString() })
    .eq("organization_id", ctx.exception.organization_id)
    .eq("id", ctx.exception.id);
  if (error) {
    const code = mapDataSourceError(error.message);
    await emitExceptionMutationError(ctx.admin, {
      organizationId: ctx.exception.organization_id,
      contractId: ctx.exception.contract_id,
      userId: ctx.userId,
      mutation: "resolveException",
      code,
    });
    return { error: code };
  }

  await ctx.admin.from("audit_events").insert({
    organization_id: ctx.exception.organization_id,
    contract_id: ctx.exception.contract_id,
    user_id: ctx.userId,
    action: "exception.resolved",
    details: { exception_id: ctx.exception.id, resolution_note: resolutionNote },
  });
  await appendExceptionEvent(ctx.admin, {
    organizationId: ctx.exception.organization_id,
    exceptionId: ctx.exception.id,
    actorId: ctx.userId,
    eventType: "resolved",
    details: { resolution_note: resolutionNote },
  });

  revalidatePath("/contracts/exceptions");
  if (ctx.exception.contract_id) revalidatePath(`/contracts/${ctx.exception.contract_id}`);
  return {
    success: true as const,
    message: "Exception resolved. The resolution stays visible in history.",
  };
}

export async function reopenException(input: { exceptionId: string }) {
  const ctx = await getEditableExceptionContext(input.exceptionId);
  if ("error" in ctx) return { error: ctx.error };

  if (!["resolved", "closed"].includes(ctx.exception.status)) {
    return { error: "Only resolved exceptions can be reopened." };
  }

  const { error } = await ctx.admin
    .from("exceptions")
    .update({ status: "open", resolved_at: null, resolved_by: null })
    .eq("organization_id", ctx.exception.organization_id)
    .eq("id", ctx.exception.id);
  if (error) {
    const code = mapDataSourceError(error.message);
    await emitExceptionMutationError(ctx.admin, {
      organizationId: ctx.exception.organization_id,
      contractId: ctx.exception.contract_id,
      userId: ctx.userId,
      mutation: "reopenException",
      code,
    });
    return { error: code };
  }

  await ctx.admin.from("audit_events").insert({
    organization_id: ctx.exception.organization_id,
    contract_id: ctx.exception.contract_id,
    user_id: ctx.userId,
    action: "exception.reopened",
    details: { exception_id: ctx.exception.id },
  });
  await appendExceptionEvent(ctx.admin, {
    organizationId: ctx.exception.organization_id,
    exceptionId: ctx.exception.id,
    actorId: ctx.userId,
    eventType: "reopened",
    details: {},
  });

  revalidatePath("/contracts/exceptions");
  if (ctx.exception.contract_id) revalidatePath(`/contracts/${ctx.exception.contract_id}`);
  return {
    success: true as const,
    message: "Exception reopened and returned to the active ledger.",
  };
}
