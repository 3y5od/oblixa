#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;
const LOCAL_URL_PREFIXES = ["http://127.0.0.1:", "http://localhost:"];
const DEFAULT_ORG_ID = "00000000-0000-4000-8000-000000000101";
const DEFAULT_ORG_NAME = "Oblixa Local Dev";
const LOCAL_AUTH_REACHABILITY_TIMEOUT_MS = 2_000;

const FIXTURE_IDS = {
  contracts: {
    atlasDpa: "00000000-0000-4000-8000-000000000201",
    northstarMsa: "00000000-0000-4000-8000-000000000202",
    ridgewayRenewal: "00000000-0000-4000-8000-000000000203",
    heliosNda: "00000000-0000-4000-8000-000000000204",
  },
  tasks: {
    atlasReview: "00000000-0000-4000-8000-000000000301",
    ridgewayBlocker: "00000000-0000-4000-8000-000000000302",
  },
  obligations: {
    northstarSecurityReport: "00000000-0000-4000-8000-000000000311",
    ridgewayServiceCredits: "00000000-0000-4000-8000-000000000312",
  },
  approvals: {
    ridgewayCommercial: "00000000-0000-4000-8000-000000000321",
  },
  exceptions: {
    ridgewayNotice: "00000000-0000-4000-8000-000000000331",
  },
  evidenceRequirements: {
    northstarInsurance: "00000000-0000-4000-8000-000000000341",
  },
  renewalScenarios: {
    ridgeway: "00000000-0000-4000-8000-000000000351",
  },
  renewalCheckpoints: {
    ridgewayDecision: "00000000-0000-4000-8000-000000000361",
  },
  savedViews: {
    activeRenewals: "00000000-0000-4000-8000-000000000371",
    blockedTasks: "00000000-0000-4000-8000-000000000372",
  },
  auditEvents: {
    northstarApproved: "00000000-0000-4000-8000-000000000381",
    ridgewayTaskCreated: "00000000-0000-4000-8000-000000000382",
  },
  v10WorkItems: {
    atlasReview: "00000000-0000-4000-8000-000000000401",
    ridgewayBlocker: "00000000-0000-4000-8000-000000000402",
    northstarObligation: "00000000-0000-4000-8000-000000000403",
    ridgewayApproval: "00000000-0000-4000-8000-000000000404",
    ridgewayException: "00000000-0000-4000-8000-000000000405",
    northstarEvidence: "00000000-0000-4000-8000-000000000406",
  },
  v10Activity: {
    northstarApproved: "00000000-0000-4000-8000-000000000411",
    ridgewayTaskCreated: "00000000-0000-4000-8000-000000000412",
  },
};

function readEnv(env, key) {
  return env[key]?.trim() || null;
}

function requireEnv(key, env = process.env) {
  const value = readEnv(env, key);
  if (!value) throw new Error(`Missing required env var ${key}`);
  return value;
}

function optionalEnv(key, env = process.env) {
  return readEnv(env, key);
}

function addDays(baseDate, days) {
  const next = new Date(baseDate);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateOnly(baseDate, days) {
  return addDays(baseDate, days).toISOString().slice(0, 10);
}

function timestamp(baseDate, days) {
  return addDays(baseDate, days).toISOString();
}

function dueState(baseDate, dueAt) {
  const diffMs = dueAt.getTime() - baseDate.getTime();
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "due_today";
  if (diffDays <= 14) return "due_soon";
  return "none";
}

async function upsertRows(supabase, table, rows, options) {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(rows, options);
  if (error) throw new Error(`Could not seed ${table}: ${error.message}`);
}

async function tableSupportsColumn(supabase, table, column) {
  const { error } = await supabase.from(table).select(column).limit(1);
  if (!error) return true;
  if (
    error.message.includes(`'${column}' column`) ||
    error.message.includes(`column ${table}.${column} does not exist`) ||
    error.message.includes(`Could not find the '${column}' column`)
  ) {
    return false;
  }
  throw new Error(`Could not inspect ${table}.${column}: ${error.message}`);
}

function assertLocalSupabaseUrl(url) {
  if (!LOCAL_URL_PREFIXES.some((prefix) => url.startsWith(prefix))) {
    throw new Error("Refusing to seed auth against a non-local Supabase URL.");
  }
}

async function assertLocalAuthReachable(supabaseUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOCAL_AUTH_REACHABILITY_TIMEOUT_MS);
  try {
    const healthUrl = new URL("/auth/v1/health", supabaseUrl);
    const response = await fetch(healthUrl, { signal: controller.signal });
    if (response.status >= 500) {
      throw new Error(`Local Supabase Auth returned ${response.status}.`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Local Supabase Auth returned ")) {
      throw error;
    }
    throw new Error("Local Supabase Auth is not reachable. Start it with `supabase start` before seeding.");
  } finally {
    clearTimeout(timer);
  }
}

async function findUserByEmail(supabase, email) {
  let page = 1;
  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 100) return null;
    page += 1;
  }
  throw new Error("Too many local users to scan; clear the local auth database or seed manually.");
}

export function resolveSeedUsers(env = process.env) {
  const users = [
    {
      email: requireEnv("E2E_TEST_EMAIL", env).toLowerCase(),
      password: requireEnv("E2E_TEST_PASSWORD", env),
      fullName: "Local Dev User",
      seedWorkspace: true,
    },
  ];
  const warnings = [];
  const configuredEmail = optionalEnv("COMPREHENSIVE_PASS_EMAIL", env);
  const configuredPassword = optionalEnv("COMPREHENSIVE_PASS_PASSWORD", env);
  if (configuredEmail && configuredPassword && configuredEmail.toLowerCase() !== users[0].email) {
    users.push({
      email: configuredEmail.toLowerCase(),
      password: configuredPassword,
      fullName: optionalEnv("COMPREHENSIVE_PASS_FULL_NAME", env),
      seedWorkspace: false,
    });
  } else if (configuredEmail || configuredPassword) {
    warnings.push(
      "COMPREHENSIVE_PASS_EMAIL and COMPREHENSIVE_PASS_PASSWORD must both be set to seed that local login."
    );
  }
  return { users, warnings };
}

async function upsertLocalUser(supabase, { email, password, fullName }) {
  const existing = await findUserByEmail(supabase, email);
  const userMetadata = { full_name: fullName ?? null };
  const userResult = existing
    ? await supabase.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: userMetadata,
      })
    : await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: userMetadata,
      });

  if (userResult.error || !userResult.data.user) {
    throw userResult.error ?? new Error("Local auth seed did not return a user.");
  }
  return userResult.data.user;
}

async function seedLocalWorkspaceData(supabase, { userId, email }) {
  const now = new Date();
  const nowIso = now.toISOString();
  const contractIds = FIXTURE_IDS.contracts;
  const taskDueAt = addDays(now, 2);
  const obligationDueAt = addDays(now, 7);
  const approvalDueAt = addDays(now, 3);
  const exceptionDueAt = addDays(now, 5);
  const evidenceDueAt = addDays(now, 10);

  await upsertRows(
    supabase,
    "organization_workflow_settings",
    [
      {
        organization_id: DEFAULT_ORG_ID,
        weekly_intake_lookback_days: 7,
        renewal_horizon_days: 120,
        stale_contract_days: 90,
        stale_ownership_days: 30,
        created_by: userId,
        dashboard_tracking_enabled: true,
        dashboard_pins_json: {
          review_queue: true,
          upcoming_deadlines: true,
          work_needing_action: true,
          data_gaps: true,
        },
      },
    ],
    { onConflict: "organization_id" }
  );

  await upsertRows(
    supabase,
    "contracts",
    [
      {
        id: contractIds.atlasDpa,
        organization_id: DEFAULT_ORG_ID,
        title: "Atlas Data Processing Agreement",
        counterparty: "Atlas Cloud Systems",
        contract_type: "Data Processing Agreement",
        status: "pending_review",
        owner_id: userId,
        created_by: userId,
        region: "North America",
        intake_status: "awaiting_review",
        health_status: "watch",
        required_next_step: "Review pending extracted fields",
        source_system: "local_seed",
        external_reference_id: "local-atlas-dpa",
        annual_value: 82000,
        search_document:
          "Atlas Cloud Systems data processing agreement covering security, subprocessors, audit support, breach notice, and renewal notice windows.",
        received_at: timestamp(now, -12),
        owner_assigned_at: timestamp(now, -10),
        created_at: timestamp(now, -12),
        updated_at: timestamp(now, -1),
      },
      {
        id: contractIds.northstarMsa,
        organization_id: DEFAULT_ORG_ID,
        title: "Northstar Master Services Agreement",
        counterparty: "Northstar Analytics",
        contract_type: "MSA",
        status: "active",
        owner_id: userId,
        created_by: userId,
        region: "EMEA",
        intake_status: "active",
        health_status: "healthy",
        required_next_step: "Collect quarterly security evidence",
        source_system: "local_seed",
        external_reference_id: "local-northstar-msa",
        annual_value: 245000,
        search_document:
          "Northstar Analytics master services agreement with quarterly reporting, insurance evidence, service levels, and renewal planning.",
        received_at: timestamp(now, -35),
        reviewed_at: timestamp(now, -30),
        operationally_active_at: timestamp(now, -28),
        owner_assigned_at: timestamp(now, -32),
        created_at: timestamp(now, -35),
        updated_at: timestamp(now, -2),
      },
      {
        id: contractIds.ridgewayRenewal,
        organization_id: DEFAULT_ORG_ID,
        title: "Ridgeway Support Renewal",
        counterparty: "Ridgeway Support LLC",
        contract_type: "Support Agreement",
        status: "active",
        owner_id: userId,
        created_by: userId,
        region: "North America",
        intake_status: "renewal_prep",
        health_status: "at_risk",
        required_next_step: "Resolve commercial exception before notice deadline",
        source_system: "local_seed",
        external_reference_id: "local-ridgeway-renewal",
        annual_value: 138000,
        search_document:
          "Ridgeway support renewal with notice deadline approaching, commercial exception, service credit obligation, and renewal decision checkpoint.",
        received_at: timestamp(now, -70),
        reviewed_at: timestamp(now, -63),
        operationally_active_at: timestamp(now, -60),
        owner_assigned_at: timestamp(now, -65),
        created_at: timestamp(now, -70),
        updated_at: timestamp(now, -1),
      },
      {
        id: contractIds.heliosNda,
        organization_id: DEFAULT_ORG_ID,
        title: "Helios Vendor NDA",
        counterparty: null,
        contract_type: "NDA",
        status: "draft",
        owner_id: null,
        created_by: userId,
        region: "APAC",
        intake_status: "in_clarification",
        health_status: "unknown",
        required_next_step: "Assign owner and confirm counterparty",
        source_system: "local_seed",
        external_reference_id: "local-helios-nda",
        annual_value: null,
        search_document:
          "Helios vendor NDA draft missing owner, counterparty, renewal date, notice date, and value.",
        received_at: timestamp(now, -4),
        owner_assigned_at: timestamp(now, -4),
        created_at: timestamp(now, -4),
        updated_at: nowIso,
      },
    ],
    { onConflict: "id" }
  );

  await upsertRows(
    supabase,
    "extracted_fields",
    [
      {
        id: "00000000-0000-4000-8000-000000000501",
        contract_id: contractIds.atlasDpa,
        field_name: "effective_date",
        field_value: dateOnly(now, -10),
        source_snippet: "Effective as of the latest signature date.",
        confidence: 0.74,
        status: "pending",
        source: "ai",
      },
      {
        id: "00000000-0000-4000-8000-000000000502",
        contract_id: contractIds.atlasDpa,
        field_name: "renewal_date",
        field_value: dateOnly(now, 80),
        source_snippet: "The term renews unless either party gives timely notice.",
        confidence: 0.69,
        status: "pending",
        source: "ai",
      },
      {
        id: "00000000-0000-4000-8000-000000000503",
        contract_id: contractIds.northstarMsa,
        field_name: "renewal_date",
        field_value: dateOnly(now, 72),
        source_snippet: "Renewal date approved from order form.",
        confidence: 0.95,
        status: "approved",
        source: "human",
        reviewed_by: userId,
        reviewed_at: timestamp(now, -3),
      },
      {
        id: "00000000-0000-4000-8000-000000000504",
        contract_id: contractIds.northstarMsa,
        field_name: "notice_window",
        field_value: "45 days",
        source_snippet: "Either party may give notice at least 45 days before renewal.",
        confidence: 0.91,
        status: "approved",
        source: "human",
        reviewed_by: userId,
        reviewed_at: timestamp(now, -3),
      },
      {
        id: "00000000-0000-4000-8000-000000000505",
        contract_id: contractIds.ridgewayRenewal,
        field_name: "renewal_date",
        field_value: dateOnly(now, 37),
        source_snippet: "Support services renew on the anniversary date.",
        confidence: 0.94,
        status: "approved",
        source: "human",
        reviewed_by: userId,
        reviewed_at: timestamp(now, -5),
      },
      {
        id: "00000000-0000-4000-8000-000000000506",
        contract_id: contractIds.ridgewayRenewal,
        field_name: "notice_date",
        field_value: dateOnly(now, 14),
        source_snippet: "Notice of non-renewal must be delivered before the notice deadline.",
        confidence: 0.93,
        status: "approved",
        source: "human",
        reviewed_by: userId,
        reviewed_at: timestamp(now, -5),
      },
      {
        id: "00000000-0000-4000-8000-000000000507",
        contract_id: contractIds.ridgewayRenewal,
        field_name: "end_date",
        field_value: dateOnly(now, 37),
        source_snippet: "Current support term ends on the renewal date.",
        confidence: 0.92,
        status: "approved",
        source: "human",
        reviewed_by: userId,
        reviewed_at: timestamp(now, -5),
      },
    ],
    { onConflict: "id" }
  );

  await upsertRows(
    supabase,
    "contract_tasks",
    [
      {
        id: FIXTURE_IDS.tasks.atlasReview,
        contract_id: contractIds.atlasDpa,
        organization_id: DEFAULT_ORG_ID,
        created_by: userId,
        assignee_id: userId,
        title: "Review Atlas renewal extraction",
        details: "Confirm the inferred renewal date and notice language before approving fields.",
        status: "in_progress",
        priority: "high",
        due_date: dateOnly(now, 2),
        created_via: "manual",
        team_key: "legal_ops",
        sla_due_at: timestamp(now, 2),
      },
      {
        id: FIXTURE_IDS.tasks.ridgewayBlocker,
        contract_id: contractIds.ridgewayRenewal,
        organization_id: DEFAULT_ORG_ID,
        created_by: userId,
        assignee_id: userId,
        title: "Resolve Ridgeway price hold blocker",
        details: "Finance needs approval before the renewal scenario can move forward.",
        status: "blocked",
        priority: "high",
        due_date: dateOnly(now, 3),
        created_via: "manual",
        team_key: "commercial",
        blocked_reason: "Waiting on finance approval for price hold.",
        sla_due_at: timestamp(now, 3),
      },
    ],
    { onConflict: "id" }
  );

  await upsertRows(
    supabase,
    "contract_obligations",
    [
      {
        id: FIXTURE_IDS.obligations.northstarSecurityReport,
        contract_id: contractIds.northstarMsa,
        organization_id: DEFAULT_ORG_ID,
        created_by: userId,
        owner_id: userId,
        title: "Collect quarterly security report",
        details: "Northstar must provide the Q2 security report before the next governance review.",
        obligation_type: "security_report",
        cadence: "quarterly",
        due_date: dateOnly(now, 7),
        status: "open",
        recurrence_type: "quarterly",
        next_due_date: dateOnly(now, 7),
        escalation_due_at: timestamp(now, 10),
        escalation_status: "none",
      },
      {
        id: FIXTURE_IDS.obligations.ridgewayServiceCredits,
        contract_id: contractIds.ridgewayRenewal,
        organization_id: DEFAULT_ORG_ID,
        created_by: userId,
        owner_id: userId,
        title: "Verify support service credit clause",
        details: "Confirm whether the proposed renewal changes the service credit terms.",
        obligation_type: "service_level",
        cadence: "renewal",
        due_date: dateOnly(now, 5),
        status: "in_progress",
        recurrence_type: "none",
        next_due_date: dateOnly(now, 5),
        escalation_due_at: timestamp(now, 8),
        escalation_status: "pending",
      },
    ],
    { onConflict: "id" }
  );

  await upsertRows(
    supabase,
    "contract_approvals",
    [
      {
        id: FIXTURE_IDS.approvals.ridgewayCommercial,
        contract_id: contractIds.ridgewayRenewal,
        organization_id: DEFAULT_ORG_ID,
        approval_type: "commercial_exception",
        status: "pending",
        requested_by: userId,
        approver_id: userId,
        notes: "Approve temporary price hold before sending renewal notice.",
        due_at: timestamp(now, 3),
        category: "financial",
        exception_flag: true,
        exception_reason: "Renewal pricing is outside the current approval policy.",
      },
    ],
    { onConflict: "id" }
  );

  await upsertRows(
    supabase,
    "exceptions",
    [
      {
        id: FIXTURE_IDS.exceptions.ridgewayNotice,
        organization_id: DEFAULT_ORG_ID,
        contract_id: contractIds.ridgewayRenewal,
        exception_type: "renewal_notice_risk",
        title: "Notice deadline depends on unresolved pricing",
        details: "The notice window is approaching while the commercial exception is still pending.",
        severity: "high",
        status: "open",
        owner_id: userId,
        due_date: dateOnly(now, 5),
        root_cause: "Pricing approval not completed before renewal planning.",
      },
    ],
    { onConflict: "id" }
  );

  await upsertRows(
    supabase,
    "evidence_requirements",
    [
      {
        id: FIXTURE_IDS.evidenceRequirements.northstarInsurance,
        organization_id: DEFAULT_ORG_ID,
        contract_id: contractIds.northstarMsa,
        work_item_type: "obligation",
        work_item_id: FIXTURE_IDS.obligations.northstarSecurityReport,
        requirement_type: "document",
        title: "Upload current cyber insurance certificate",
        required: true,
        due_at: timestamp(now, 10),
        review_due_at: timestamp(now, 14),
        reviewer_id: userId,
        status: "required",
        config_json: {
          accepted_file_types: ["pdf"],
          local_seed: true,
        },
      },
    ],
    { onConflict: "id" }
  );

  await upsertRows(
    supabase,
    "contract_renewal_scenarios",
    [
      {
        id: FIXTURE_IDS.renewalScenarios.ridgeway,
        contract_id: contractIds.ridgewayRenewal,
        organization_id: DEFAULT_ORG_ID,
        scenario: "renegotiate",
        decision_notes: "Evaluate renewal pricing and service-credit exposure.",
        blocker: "Commercial approval pending",
        decided_by: null,
        workspace_status: "decision_pending",
        owner_id: userId,
        target_decision_date: dateOnly(now, 14),
        escalation_date: dateOnly(now, 10),
        commercial_context: "Local fixture renewal scenario with an approaching notice deadline.",
        scenario_confidence: 82,
        last_reviewed_at: timestamp(now, -1),
      },
    ],
    { onConflict: "id" }
  );

  await upsertRows(
    supabase,
    "contract_renewal_checkpoints",
    [
      {
        id: FIXTURE_IDS.renewalCheckpoints.ridgewayDecision,
        contract_id: contractIds.ridgewayRenewal,
        organization_id: DEFAULT_ORG_ID,
        scenario_id: FIXTURE_IDS.renewalScenarios.ridgeway,
        task_key: "decision_packet",
        label: "Prepare Ridgeway renewal decision packet",
        offset_days: 30,
        due_date: dateOnly(now, 12),
        status: "pending",
        notes: "Collect pricing exception, service credit analysis, and renewal recommendation.",
        required: true,
      },
    ],
    { onConflict: "id" }
  );

  await upsertRows(
    supabase,
    "contract_watchlists",
    [
      {
        id: "00000000-0000-4000-8000-000000000391",
        contract_id: contractIds.ridgewayRenewal,
        organization_id: DEFAULT_ORG_ID,
        user_id: userId,
        team_key: "commercial",
        note: "Track renewal notice and approval risk.",
      },
    ],
    { onConflict: "id" }
  );

  const savedViewsHavePinned = await tableSupportsColumn(supabase, "saved_views", "pinned");
  const savedViewRows = [
    {
      id: FIXTURE_IDS.savedViews.activeRenewals,
      organization_id: DEFAULT_ORG_ID,
      user_id: userId,
      view_type: "renewals",
      name: "Renewals in next 90 days",
      query_json: { horizon: "90_days", pinned: true, local_seed: true },
      pinned: true,
    },
    {
      id: FIXTURE_IDS.savedViews.blockedTasks,
      organization_id: DEFAULT_ORG_ID,
      user_id: userId,
      view_type: "tasks",
      name: "Blocked commercial tasks",
      query_json: { status: "blocked", team_key: "commercial", pinned: true, local_seed: true },
      pinned: true,
    },
  ].map((row) => {
    if (savedViewsHavePinned) return row;
    const withoutPinned = { ...row };
    delete withoutPinned.pinned;
    return withoutPinned;
  });

  await upsertRows(
    supabase,
    "saved_views",
    savedViewRows,
    { onConflict: "id" }
  );

  await upsertRows(
    supabase,
    "audit_events",
    [
      {
        id: FIXTURE_IDS.auditEvents.northstarApproved,
        organization_id: DEFAULT_ORG_ID,
        contract_id: contractIds.northstarMsa,
        user_id: userId,
        action: "field.approved",
        details: { field_name: "renewal_date", local_seed: true },
        created_at: timestamp(now, -2),
      },
      {
        id: FIXTURE_IDS.auditEvents.ridgewayTaskCreated,
        organization_id: DEFAULT_ORG_ID,
        contract_id: contractIds.ridgewayRenewal,
        user_id: userId,
        action: "contract.owner_changed",
        details: { owner_email: email, local_seed: true },
        created_at: timestamp(now, -1),
      },
    ],
    { onConflict: "id" }
  );

  await upsertRows(
    supabase,
    "v10_work_items",
    [
      {
        id: FIXTURE_IDS.v10WorkItems.atlasReview,
        organization_id: DEFAULT_ORG_ID,
        workspace_mode: "core",
        required_role_minimum: "viewer",
        feature_family: "review",
        source_table: "contract_tasks",
        source_id: FIXTURE_IDS.tasks.atlasReview,
        type: "contract_task",
        status: "in_progress",
        title: "Review Atlas renewal extraction",
        contract_id: contractIds.atlasDpa,
        source_type: "work_item",
        owner_user_id: userId,
        owner_state: "assigned",
        due_at: taskDueAt.toISOString(),
        due_state: dueState(now, taskDueAt),
        priority: "high",
        severity: "medium",
        primary_action: "open_task",
        secondary_actions: ["view_contract"],
        compatible_action_group: "task_resolution",
        last_state_change_at: timestamp(now, -1),
      },
      {
        id: FIXTURE_IDS.v10WorkItems.ridgewayBlocker,
        organization_id: DEFAULT_ORG_ID,
        workspace_mode: "core",
        required_role_minimum: "viewer",
        feature_family: "work",
        source_table: "contract_tasks",
        source_id: FIXTURE_IDS.tasks.ridgewayBlocker,
        type: "contract_task",
        status: "blocked",
        title: "Resolve Ridgeway price hold blocker",
        contract_id: contractIds.ridgewayRenewal,
        source_type: "work_item",
        owner_user_id: userId,
        owner_state: "assigned",
        due_at: taskDueAt.toISOString(),
        due_state: dueState(now, taskDueAt),
        priority: "urgent",
        severity: "high",
        blocked_reason: "Waiting on finance approval for price hold.",
        primary_action: "resolve_blocker",
        secondary_actions: ["view_contract", "request_approval"],
        compatible_action_group: "task_resolution",
        last_state_change_at: timestamp(now, -1),
      },
      {
        id: FIXTURE_IDS.v10WorkItems.northstarObligation,
        organization_id: DEFAULT_ORG_ID,
        workspace_mode: "core",
        required_role_minimum: "viewer",
        feature_family: "obligations",
        source_table: "contract_obligations",
        source_id: FIXTURE_IDS.obligations.northstarSecurityReport,
        type: "obligation",
        status: "open",
        title: "Collect quarterly security report",
        contract_id: contractIds.northstarMsa,
        source_type: "obligation",
        owner_user_id: userId,
        owner_state: "assigned",
        due_at: obligationDueAt.toISOString(),
        due_state: dueState(now, obligationDueAt),
        priority: "high",
        severity: "medium",
        primary_action: "submit_evidence",
        secondary_actions: ["view_obligation"],
        compatible_action_group: "obligation_evidence",
        last_state_change_at: timestamp(now, -2),
      },
      {
        id: FIXTURE_IDS.v10WorkItems.ridgewayApproval,
        organization_id: DEFAULT_ORG_ID,
        workspace_mode: "core",
        required_role_minimum: "viewer",
        feature_family: "approvals",
        source_table: "contract_approvals",
        source_id: FIXTURE_IDS.approvals.ridgewayCommercial,
        type: "approval",
        status: "open",
        title: "Approve Ridgeway commercial exception",
        contract_id: contractIds.ridgewayRenewal,
        source_type: "approval",
        owner_user_id: userId,
        owner_state: "assigned",
        due_at: approvalDueAt.toISOString(),
        due_state: dueState(now, approvalDueAt),
        priority: "urgent",
        severity: "high",
        primary_action: "review_approval",
        secondary_actions: ["view_contract"],
        compatible_action_group: "approval_review",
        last_state_change_at: timestamp(now, -1),
      },
      {
        id: FIXTURE_IDS.v10WorkItems.ridgewayException,
        organization_id: DEFAULT_ORG_ID,
        workspace_mode: "core",
        required_role_minimum: "viewer",
        feature_family: "exceptions",
        source_table: "exceptions",
        source_id: FIXTURE_IDS.exceptions.ridgewayNotice,
        type: "exception",
        status: "open",
        title: "Notice deadline depends on unresolved pricing",
        contract_id: contractIds.ridgewayRenewal,
        source_type: "exception",
        owner_user_id: userId,
        owner_state: "assigned",
        due_at: exceptionDueAt.toISOString(),
        due_state: dueState(now, exceptionDueAt),
        priority: "high",
        severity: "high",
        primary_action: "open_exception",
        secondary_actions: ["view_contract"],
        compatible_action_group: "exception_resolution",
        last_state_change_at: timestamp(now, -1),
      },
      {
        id: FIXTURE_IDS.v10WorkItems.northstarEvidence,
        organization_id: DEFAULT_ORG_ID,
        workspace_mode: "core",
        required_role_minimum: "viewer",
        feature_family: "evidence",
        source_table: "evidence_requirements",
        source_id: FIXTURE_IDS.evidenceRequirements.northstarInsurance,
        type: "evidence_request",
        status: "open",
        title: "Upload current cyber insurance certificate",
        contract_id: contractIds.northstarMsa,
        source_type: "evidence_request",
        owner_user_id: userId,
        owner_state: "assigned",
        due_at: evidenceDueAt.toISOString(),
        due_state: dueState(now, evidenceDueAt),
        priority: "normal",
        severity: "medium",
        primary_action: "upload_evidence",
        secondary_actions: ["view_contract"],
        compatible_action_group: "evidence_collection",
        last_state_change_at: timestamp(now, -1),
      },
    ],
    { onConflict: "organization_id,source_table,source_id,type" }
  );

  await upsertRows(
    supabase,
    "v10_contract_activity_events",
    [
      {
        id: FIXTURE_IDS.v10Activity.northstarApproved,
        organization_id: DEFAULT_ORG_ID,
        workspace_mode: "core",
        required_role_minimum: "viewer",
        feature_family: "audit",
        source_table: "audit_events",
        source_id: FIXTURE_IDS.auditEvents.northstarApproved,
        contract_id: contractIds.northstarMsa,
        actor_user_id: userId,
        actor_display: "Local Dev User",
        action: "field.approved",
        target_type: "field",
        target_id: "renewal_date",
        outcome: "success",
        safe_summary: "Approved Northstar renewal date",
        metadata_safe: { local_seed: true },
        occurred_at: timestamp(now, -2),
      },
      {
        id: FIXTURE_IDS.v10Activity.ridgewayTaskCreated,
        organization_id: DEFAULT_ORG_ID,
        workspace_mode: "core",
        required_role_minimum: "viewer",
        feature_family: "audit",
        source_table: "audit_events",
        source_id: FIXTURE_IDS.auditEvents.ridgewayTaskCreated,
        contract_id: contractIds.ridgewayRenewal,
        actor_user_id: userId,
        actor_display: "Local Dev User",
        action: "contract.owner_changed",
        target_type: "contract",
        target_id: contractIds.ridgewayRenewal,
        outcome: "success",
        safe_summary: "Assigned Ridgeway renewal owner",
        metadata_safe: { local_seed: true },
        occurred_at: timestamp(now, -1),
      },
    ],
    { onConflict: "organization_id,source_table,source_id" }
  );
}

export async function seedLocalAuth() {
  loadEnvConfig(process.cwd());

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const seedConfig = resolveSeedUsers();
  const seedUsers = seedConfig.users;

  assertLocalSupabaseUrl(supabaseUrl);
  await assertLocalAuthReachable(supabaseUrl);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { error: orgError } = await supabase.from("organizations").upsert({
    id: DEFAULT_ORG_ID,
    name: DEFAULT_ORG_NAME,
    v6_org_settings_json: {
      workspace_mode: "core",
      autopilot_allow_execution: false,
      search_scope: "match_mode",
      advanced_modules_hidden: [],
      assurance_modules_hidden: [],
      onboarding_calibration: {
        version: 2,
        blocking_required: false,
        status: "completed",
      },
    },
  });
  if (orgError) throw orgError;

  const seeded = [];
  for (const seedUser of seedUsers) {
    const user = await upsertLocalUser(supabase, seedUser);

    const { error: membershipError } = await supabase
      .from("organization_members")
      .upsert(
        {
          organization_id: DEFAULT_ORG_ID,
          user_id: user.id,
          role: "admin",
        },
        { onConflict: "organization_id,user_id" }
      );
    if (membershipError) throw membershipError;

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      email: seedUser.email,
      full_name: seedUser.fullName ?? null,
      onboarding_completed_at: new Date().toISOString(),
    });
    if (profileError) throw profileError;

    if (seedUser.seedWorkspace) {
      await seedLocalWorkspaceData(supabase, { userId: user.id, email: seedUser.email });
    }

    seeded.push({ email: seedUser.email, userId: user.id });
  }

  return {
    email: seeded[0]?.email,
    userId: seeded[0]?.userId,
    users: seeded,
    organizationId: DEFAULT_ORG_ID,
    warnings: seedConfig.warnings,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await seedLocalAuth();
    for (const warning of result.warnings) console.warn(`WARN: ${warning}`);
    console.log(
      `OK: seeded ${result.users.length} local auth user(s) in organization ${result.organizationId}.`
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
