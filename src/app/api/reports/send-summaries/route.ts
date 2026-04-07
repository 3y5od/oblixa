import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/server";
import { authorizeCronRequest } from "@/lib/security/cron-auth";
import { getRequestOrigin } from "@/lib/app-url";
import { sendSavedViewSummaryEmail } from "@/lib/email";
import {
  getSupabasePublicEnv,
  getSupabaseServiceRoleKey,
} from "@/lib/env/server";
import { captureServerMessage } from "@/lib/observability/sentry";
import { getContractIdsForDeadlinePreset, type DeadlinePreset } from "@/lib/contract-filters";
import { pingCronHealthcheck } from "@/lib/observability/cron-healthcheck";

function authorizeCron(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return authorizeCronRequest(request, cronSecret);
}

function parseViewQuery(
  query: Record<string, unknown>
): { status?: string; owner?: string; region?: string; search?: string; deadline?: DeadlinePreset } {
  const status = typeof query.status === "string" && query.status.trim() ? query.status.trim() : undefined;
  const owner = typeof query.owner === "string" && query.owner.trim() ? query.owner.trim() : undefined;
  const region = typeof query.region === "string" && query.region.trim() ? query.region.trim() : undefined;
  const search = typeof query.search === "string" && query.search.trim() ? query.search.trim() : undefined;
  const deadline =
    typeof query.deadline === "string" && query.deadline.trim()
      ? (query.deadline.trim() as DeadlinePreset)
      : undefined;
  return { status, owner, region, search, deadline };
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    pingCronHealthcheck("reports/send-summaries", {
      ok: false,
      status: 500,
      reason: "cron_secret_missing",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "Server misconfigured: CRON_SECRET is not set" },
      { status: 500 }
    );
  }
  if (!authorizeCron(request)) {
    pingCronHealthcheck("reports/send-summaries", {
      ok: false,
      status: 401,
      reason: "unauthorized",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabaseUrl: string;
  let serviceRoleKey: string;
  try {
    ({ url: supabaseUrl } = getSupabasePublicEnv());
    serviceRoleKey = getSupabaseServiceRoleKey();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Supabase env misconfigured";
    console.error("[reports/cron] configuration error:", message);
    pingCronHealthcheck("reports/send-summaries", {
      ok: false,
      status: 500,
      reason: "supabase_env_invalid",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const supabase = createServerClient(supabaseUrl, serviceRoleKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  });

  const nowIso = new Date().toISOString();
  const { data: rows, error } = await supabase
    .from("report_subscriptions")
    .select(
      "id, saved_view_id, user_id, organization_id, frequency, next_run_at, recipient_emails, saved_views!inner(id, name, view_type, query_json)"
    )
    .eq("active", true)
    .in("frequency", ["weekly", "monthly"])
    .lte("next_run_at", nowIso)
    .limit(100);

  if (error) {
    console.error("[reports/cron] subscriptions query:", error.message);
    captureServerMessage(error.message, {
      level: "error",
      extra: { route: "reports/send-summaries", phase: "query_subscriptions" },
    });
    pingCronHealthcheck("reports/send-summaries", {
      ok: false,
      status: 500,
      reason: "subscription_query_failed",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "Could not load subscriptions" }, { status: 500 });
  }

  const list = rows ?? [];
  if (list.length === 0) {
    const payload = { sent: 0, candidates: 0, message: "No due summaries", durationMs: Date.now() - startedAt };
    pingCronHealthcheck("reports/send-summaries", { ok: true, ...payload });
    return NextResponse.json(payload);
  }

  const userIds = [...new Set(list.map((r) => r.user_id).filter(Boolean))];
  const { data: profiles } =
    userIds.length === 0
      ? { data: [] as Array<{ id: string; email: string | null }> }
      : await supabase
          .from("profiles")
          .select("id, email")
          .in("id", userIds);
  const profileByUserId = new Map((profiles ?? []).map((p) => [p.id, p.email]));

  const appUrl = getRequestOrigin(request);
  let sent = 0;
  const errors: string[] = [];

  for (const row of list) {
    const savedView = row.saved_views as unknown as {
      id: string;
      name: string;
      view_type: string;
      query_json: Record<string, unknown>;
    };
    const ownerEmail = profileByUserId.get(row.user_id) ?? null;
    const extraRecipients = ((row.recipient_emails ?? []) as string[]).filter(Boolean);
    const recipients = [...new Set([ownerEmail, ...extraRecipients].filter(Boolean))] as string[];
    if (recipients.length === 0) {
      continue;
    }

    const parsed = parseViewQuery(savedView.query_json ?? {});
    let count = 0;
    let sampleRows: Array<{ label: string; href: string; meta: string }> = [];
    let workspacePath = "/contracts";

    if (savedView.view_type === "contracts") {
      let deadlineIds: string[] | null = null;
      if (parsed.deadline) {
        deadlineIds = await getContractIdsForDeadlinePreset(
          supabase as unknown as Awaited<ReturnType<typeof createAdminClient>>,
          row.organization_id,
          parsed.deadline
        );
      }

      let q = supabase
        .from("contracts")
        .select("id, title, counterparty, status", { count: "exact" })
        .eq("organization_id", row.organization_id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (parsed.status) q = q.eq("status", parsed.status);
      if (parsed.owner) q = q.eq("owner_id", parsed.owner);
      if (parsed.region) q = q.eq("region", parsed.region);
      if (deadlineIds !== null) {
        if (deadlineIds.length === 0) {
          q = q.in("id", ["00000000-0000-0000-0000-000000000000"]);
        } else {
          q = q.in("id", deadlineIds);
        }
      }
      if (parsed.search) {
        q = q.or(
          `title.ilike.%${parsed.search}%,counterparty.ilike.%${parsed.search}%,contract_type.ilike.%${parsed.search}%`
        );
      }

      const { data: records, count: total, error: viewErr } = await q;
      if (viewErr) {
        errors.push(`${row.id}: ${viewErr.message}`);
        continue;
      }
      count = total ?? 0;
      sampleRows = (records ?? []).map((c) => ({
        label: c.title,
        href: `/contracts/${c.id}`,
        meta: `${c.counterparty ?? "No counterparty"} · ${c.status}`,
      }));
      workspacePath = "/contracts";
    } else if (savedView.view_type === "tasks") {
      let q = supabase
        .from("contract_tasks")
        .select("id, title, status, priority, contracts!inner(id, title, organization_id)", { count: "exact" })
        .eq("organization_id", row.organization_id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (parsed.status) q = q.eq("status", parsed.status);
      const { data: records, count: total, error: viewErr } = await q;
      if (viewErr) {
        errors.push(`${row.id}: ${viewErr.message}`);
        continue;
      }
      count = total ?? 0;
      sampleRows = (records ?? []).flatMap((t) => {
        const contract = (Array.isArray(t.contracts) ? t.contracts[0] : t.contracts) as
          | { id?: string; title?: string }
          | undefined;
        if (!contract?.id) return [];
        return [{ label: t.title, href: `/contracts/${contract.id}`, meta: `${contract.title} · ${t.status} · ${t.priority}` }];
      });
      workspacePath = "/contracts/tasks";
    } else if (savedView.view_type === "obligations") {
      let q = supabase
        .from("contract_obligations")
        .select("id, title, status, due_date, contracts!inner(id, title, organization_id)", { count: "exact" })
        .eq("organization_id", row.organization_id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (parsed.status) q = q.eq("status", parsed.status);
      const { data: records, count: total, error: viewErr } = await q;
      if (viewErr) {
        errors.push(`${row.id}: ${viewErr.message}`);
        continue;
      }
      count = total ?? 0;
      sampleRows = (records ?? []).flatMap((o) => {
        const contract = (Array.isArray(o.contracts) ? o.contracts[0] : o.contracts) as
          | { id?: string; title?: string }
          | undefined;
        if (!contract?.id) return [];
        return [
          {
            label: o.title,
            href: `/contracts/${contract.id}`,
            meta: `${contract.title} · ${o.status}${o.due_date ? ` · due ${o.due_date}` : ""}`,
          },
        ];
      });
      workspacePath = "/contracts/obligations";
    } else if (savedView.view_type === "renewals") {
      const horizon = parsed.deadline || "renewal_90";
      const ids =
        (await getContractIdsForDeadlinePreset(
        supabase as unknown as Awaited<ReturnType<typeof createAdminClient>>,
        row.organization_id,
        horizon
      )) ?? [];
      let q = supabase
        .from("contracts")
        .select("id, title, counterparty, status", { count: "exact" })
        .eq("organization_id", row.organization_id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (ids.length === 0) {
        q = q.in("id", ["00000000-0000-0000-0000-000000000000"]);
      } else {
        q = q.in("id", ids);
      }
      const { data: records, count: total, error: viewErr } = await q;
      if (viewErr) {
        errors.push(`${row.id}: ${viewErr.message}`);
        continue;
      }
      count = total ?? 0;
      sampleRows = (records ?? []).map((c) => ({
        label: c.title,
        href: `/contracts/${c.id}`,
        meta: `${c.counterparty ?? "No counterparty"} · ${c.status}`,
      }));
      workspacePath = "/contracts/renewals";
    } else {
      continue;
    }
    const send = await sendSavedViewSummaryEmail({
      to: recipients,
      viewName: savedView.name,
      appUrl,
      itemCount: count,
      workspacePath,
      sampleRows,
    });

    if (send.error) {
      errors.push(`${row.id}: ${send.error.message}`);
      continue;
    }

    const nextRun = (() => {
      if (row.frequency === "monthly") {
        const d = new Date();
        d.setUTCDate(1);
        d.setUTCHours(9, 30, 0, 0);
        d.setUTCMonth(d.getUTCMonth() + 1);
        return d.toISOString();
      }
      const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      return d.toISOString();
    })();
    await supabase
      .from("report_subscriptions")
      .update({ last_sent_at: nowIso, next_run_at: nextRun })
      .eq("id", row.id);
    sent++;
  }

  if (errors.length > 0) {
    captureServerMessage("report summary cron errors", {
      level: "warning",
      extra: { route: "reports/send-summaries", errorCount: errors.length },
    });
  }

  const payload = {
    sent,
    candidates: list.length,
    errors: errors.length ? errors : undefined,
    durationMs: Date.now() - startedAt,
  };
  pingCronHealthcheck("reports/send-summaries", {
    ok: errors.length === 0,
    ...payload,
  });
  return NextResponse.json(payload);
}
