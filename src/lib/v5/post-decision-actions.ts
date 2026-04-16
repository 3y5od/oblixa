import type { createAdminClient } from "@/lib/supabase/server";

type Admin = Awaited<ReturnType<typeof createAdminClient>>;

export type PostDecisionAction = Record<string, unknown> & {
  type?: string;
};

const TASK_MARKER = "[oblixa:v5:post_decision]";

function firstLinkedContractId(linkedContractIds: unknown): string | null {
  if (!Array.isArray(linkedContractIds)) return null;
  for (const x of linkedContractIds) {
    if (typeof x === "string" && x.trim()) return x.trim();
  }
  return null;
}

/**
 * When the close payload omits postActions, suggest grounded follow-up tasks from decision_type (§9.1).
 * Callers may still pass explicit postActions to override entirely.
 */
export function suggestDefaultPostDecisionActions(
  decisionType: string,
  linkedContractIds: unknown
): PostDecisionAction[] {
  const contractId = firstLinkedContractId(linkedContractIds);
  if (!contractId) return [];

  const t = decisionType.trim();
  if (t === "renewal" || t === "renewal_recommendation") {
    return [
      {
        type: "create_task",
        contractId,
        title: "Renewal decision — operational follow-up",
        details: "Complete approved renewal steps and align obligations or program assignments.",
        teamKey: "ops",
      },
    ];
  }
  if (t === "amendment_request") {
    return [
      {
        type: "create_task",
        contractId,
        title: "Amendment decision — operational follow-up",
        details: "Execute amendment workstream and capture evidence per policy.",
        teamKey: "legal",
      },
    ];
  }
  if (t === "remediation_acceptance" || t === "waiver_exception") {
    return [
      {
        type: "create_task",
        contractId,
        title: "Exception / remediation follow-up",
        details: "Close the loop on accepted disposition and monitor for recurrence.",
        teamKey: "ops",
      },
    ];
  }
  return [];
}

/**
 * Runs idempotently after a decision first transitions to `closed`.
 * Supported shapes:
 * - { type: "create_task", contractId, title, details?, dueDate?, teamKey? }
 * - { type: "link_exception", exceptionId }
 */
export async function executePostDecisionActions(params: {
  admin: Admin;
  organizationId: string;
  userId: string;
  decisionWorkspaceId: string;
  actions: PostDecisionAction[];
}): Promise<{ tasksCreated: number; exceptionsLinked: number; errors: string[] }> {
  const { admin, organizationId, userId, decisionWorkspaceId, actions } = params;
  let tasksCreated = 0;
  let exceptionsLinked = 0;
  const errors: string[] = [];

  for (let i = 0; i < actions.length; i++) {
    const raw = actions[i];
    const type = typeof raw.type === "string" ? raw.type : "";
    try {
      if (type === "create_task") {
        const contractId = typeof raw.contractId === "string" ? raw.contractId : "";
        const title = typeof raw.title === "string" ? raw.title.trim() : "";
        if (!contractId || !title) {
          errors.push(`create_task[${i}]: contractId and title required`);
          continue;
        }
        const { data: contract } = await admin
          .from("contracts")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("id", contractId)
          .maybeSingle();
        if (!contract) {
          errors.push(`create_task[${i}]: contract not found`);
          continue;
        }
        const detailsBase =
          typeof raw.details === "string" && raw.details.trim()
            ? raw.details.trim()
            : "Created from decision workspace post-close actions.";
        const dueDate =
          typeof raw.dueDate === "string" && raw.dueDate.trim()
            ? raw.dueDate.trim().slice(0, 10)
            : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const teamKey =
          typeof raw.teamKey === "string" && raw.teamKey.trim() ? raw.teamKey.trim() : "ops";

        const markerLine = `${TASK_MARKER} decision=${decisionWorkspaceId} idx=${i}`;
        const { data: existing } = await admin
          .from("contract_tasks")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("contract_id", contractId)
          .ilike("details", `%${markerLine}%`)
          .limit(1)
          .maybeSingle();
        if (existing) continue;

        const { error: insertError } = await admin.from("contract_tasks").insert({
          contract_id: contractId,
          organization_id: organizationId,
          created_by: userId,
          title,
          details: `${detailsBase}\n\n${markerLine}`,
          status: "open",
          priority: "medium",
          due_date: dueDate,
          created_via: "manual",
          team_key: teamKey,
        });
        if (insertError) {
          errors.push(`create_task[${i}]: insert failed: ${insertError.message}`);
          continue;
        }
        tasksCreated += 1;
      } else if (type === "link_exception") {
        const exceptionId = typeof raw.exceptionId === "string" ? raw.exceptionId : "";
        if (!exceptionId) {
          errors.push(`link_exception[${i}]: exceptionId required`);
          continue;
        }
        const { data: row, error } = await admin
          .from("exceptions")
          .update({ decision_workspace_id: decisionWorkspaceId })
          .eq("organization_id", organizationId)
          .eq("id", exceptionId)
          .select("id")
          .maybeSingle();
        if (error || !row) {
          errors.push(`link_exception[${i}]: update failed`);
          continue;
        }
        exceptionsLinked += 1;
      } else if (type) {
        errors.push(`Unknown post_decision action type: ${type}`);
      }
    } catch (e) {
      errors.push(
        `action[${i}]: ${e instanceof Error ? e.message : "unexpected error"}`
      );
    }
  }

  return { tasksCreated, exceptionsLinked, errors };
}
