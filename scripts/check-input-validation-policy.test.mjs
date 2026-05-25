import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeInputValidationPolicy } from "./check-input-validation-policy.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeFixture(root, overrides = {}) {
  const files = {
    "package.json": JSON.stringify({ scripts: { "check:input-validation-policy": "node scripts/check-input-validation-policy.mjs" } }),
    ".github/workflows/ci.yml": "npm run check:input-validation-policy\n",
    "scripts/pipelines/pipeline-security-comprehensive.mjs": '"check:input-validation-policy"\n',
    "src/lib/security/validation.ts": `
      export function isUuid() {}
      export function isIsoDateOnly() {}
      export const JSON_UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
      export function hasUnsafeJsonKey() {}
      export function containsControlOrBidi() {}
      export function isSafeRouteParam() {}
      export function validateBoundedString() {}
      allowTextWhitespaceControls
      export function isJsonShapeWithinLimits() {}
      allowJsonWhitespaceControls
      export function parsePositiveIntParam() {}
      export function parseFixedSortKey() {}
      export function parseFixedEnumParam() {}
      export function parseBooleanParam() { return "invalid_boolean"; }
      export function parseIsoDateRange() { return "date_range_too_large"; }
      export function parseIsoTimestampParam() { return "timestamp_too_old"; }
      export function parseFutureIsoTimestamp() { return "timestamp_too_far_in_future"; }
    `,
    "src/lib/security/validation.test.ts": `
      it("detects prototype-pollution keys at any depth", () => {})
      it("rejects bidi and control characters", () => {})
      it("validates bounded multiline text while rejecting unsafe controls", () => {})
      it("rejects empty, trimmed, encoded, separator, control, bidi, and overlong params", () => {})
      it("rejects excessive depth, arrays, object keys, and string lengths", () => {})
      it("can allow JSON whitespace controls while still rejecting unsafe controls", () => {})
      it("caps pagination limits and falls back on invalid numbers", () => {})
      it("selects only fixed sort keys", () => {})
      it("selects only fixed enum values", () => {})
      it("parses only explicit boolean query flags", () => {})
      it("validates date ranges and maximum span", () => {})
      it("validates bounded ISO timestamp query parameters", () => {})
      it("validates future ISO timestamp deadlines", () => {})
    `,
    "src/lib/security/security-regression-fixtures.ts": `
      export const SECURITY_REGRESSION_FIXTURES = {
        xssStrings: [],
        sqlLikePayloads: [],
        csvFormulas: [],
        bidiStrings: [],
        ssrfUrls: [],
        badTokens: [],
        badOrigins: [],
        oversizedBodies: [],
      }
      export function getSecurityRegressionFixtures() {}
    `,
    "src/lib/security/security-regression-fixtures.test.ts": `
      it("covers reusable attack strings across parser and boundary tests", () => {})
      it("returns strongly named fixture families", () => {})
    `,
    "src/lib/security/read-json-body-limited.ts": `
      hasUnsafeJsonKey
      isJsonShapeWithinLimits
      allowJsonWhitespaceControls
      reason: "unsafe_json_key"
      reason: "json_shape_too_large"
    `,
    "src/lib/security/read-json-body-limited.test.ts": `
      it("rejects prototype-pollution keys after parsing", () => {})
      it("rejects JSON shapes that exceed structural limits", () => {})
    `,
    "src/lib/security/route-params.ts": `
      export function rejectUnsafeRouteParams() {
        isSafeRouteParam(params[name])
        reason: "invalid_route_param"
      }
      export function rejectInvalidRouteParamEnums() {
        reason: "invalid_route_param_enum"
      }
    `,
    "src/lib/security/route-params.test.ts": `
      describe("rejectUnsafeRouteParams", () => {})
      it("returns problem JSON for unsafe path parameters", () => {})
      it("returns problem JSON for unsupported enum path parameters", () => {})
    `,
    "src/app/api/example/[id]/route.ts": `
      rejectUnsafeRouteParams({ id }, ["id"], "/api/example/[id]")
    `,
    "src/lib/decision-intelligence/external-action-types.ts": "export const EXTERNAL_ACTION_TYPES = []; export function isValidExternalActionType(){} export function externalActionTypeValidationError(){}",
    "src/lib/decision-intelligence/external-action-payload.ts": "function validateExternalActionPayload() { switch (actionType) {} const _exhaustive: never = actionType; }",
    "src/lib/decision-intelligence/external-action-payload.test.ts": `
      it("covers every ExternalActionType without falling through to unsupported", () => {})
      acknowledged must be boolean true
      review_decision_packet: reviewed true
    `,
    "src/app/api/external-actions/create-link/route.ts": `
      readJsonBodyLimited(request)
      isValidExternalActionType(rawAction)
      const maxHours = sensitive ? 168 : 720
      Math.max(1, Math.min(maxHours, 1))
      parseExpiresInHours(body.expiresInHours, actionType)
      parseFutureIsoTimestamp(workflowDeadlineRaw)
      workflowDeadlineIso must be a future ISO timestamp
    `,
    "src/app/api/evidence/requests/route.ts": `
      parseIsoTimestampParam(dueAtRaw)
      EVIDENCE_REQUEST_DUE_AT_WINDOW_DAYS
      v10_evidence_request_due_at_invalid
    `,
    "src/app/api/decisions/route.ts": `
      parseDecisionDueAt(body.dueAt)
      DECISION_DUE_AT_WINDOW_DAYS
      decision_due_at_invalid
    `,
    "src/app/api/decisions/[id]/route.ts": `
      rejectUnsafeRouteParams({ id }, ["id"], "/api/decisions/[id]")
      parseDecisionDueAt(body.dueAt)
      DECISION_DUE_AT_WINDOW_DAYS
      decision_due_at_invalid
    `,
    "src/app/api/exceptions/[id]/[action]/route.ts": `
      rejectUnsafeRouteParams({ id, action }, ["id", "action"], "/api/exceptions/[id]/[action]")
      rejectInvalidRouteParamEnums({ action }, { action: EXCEPTION_ACTIONS }, "/api/exceptions/[id]/[action]")
      isIsoDateOnly(dueDate)
      v10_exception_due_date_invalid
    `,
    "src/actions/tasks.ts": `
      isIsoDateOnly(dueDate)
      isIsoDateOnly(recurrenceAnchorDate)
    `,
    "src/actions/tasks.test.ts": 'it("rejects invalid ISO due dates before data writes", () => {})',
    "src/actions/obligations.ts": "isIsoDateOnly(dueDate)",
    "src/actions/obligations.test.ts": 'it("rejects invalid ISO due dates before querying contract state", () => {})',
    "src/actions/exceptions.ts": "isIsoDateOnly(dueDate)",
    "src/actions/contracts.ts": `
      validateBoundedString(formData.get("title") ?? ""
      optionalContractText(
      parseFixedEnumParam(intakeStatus
      parsePositiveIntParam(raw
      MAX_HANDOFF_NOTE_LEN
      MAX_SUPERSEDE_REASON_LEN
    `,
    "src/actions/contracts-lifecycle.ts": `
      lifecycleTextError(
      validateBoundedString(input.requiredNextStep
      parseFixedEnumParam(input.intakeStatus
      hasUnsafeJsonKey(payload)
      isJsonShapeWithinLimits(payload
      MAX_REJECTION_REASON_LEN
    `,
    "src/actions/contracts-action-scope.test.ts": `
      it("createContract rejects unsafe titles before auth or membership lookup", () => {})
      it("upsertContractHandoffChecklist rejects unsafe notes before auth or contract lookup", () => {})
      it("addManualField rejects unsafe values before auth or contract lookup", () => {})
      it("supersedeContractFile rejects unsafe reasons before auth or contract lookup", () => {})
      it("updateContractOperationalState rejects unsafe next steps before auth or contract lookup", () => {})
      it("upsertContractIntakeRequest rejects unsafe JSON keys before auth or writes", () => {})
      it("updateContractExternalLink rejects unsafe external references before auth or contract lookup", () => {})
    `,
    "src/actions/approvals.ts": `
      isIsoDateOnly(targetDecisionDate)
      isIsoDateOnly(escalationDate)
      validateOptionalApprovalText(
      parseApprovalFormEnum(
      parseOptionalScenarioConfidence(
      parsePositiveIntParam(raw
      Notes contain unsupported characters
      Commercial context contains unsupported characters
    `,
    "src/actions/approvals-action-scope.test.ts": `
      it("requestContractApproval rejects unsafe notes before auth or contract lookup", () => {})
      it("updateContractApprovalStatus rejects unsafe decision notes before auth or approval lookup", () => {})
      it("delegateContractApproval rejects unsafe reasons before auth or approval lookup", () => {})
      it("upsertRenewalScenario rejects unsafe commercial context before auth or contract lookup", () => {})
      it("upsertRenewalScenarioForm rejects unsafe blockers before auth or writes", () => {})
    `,
    "src/actions/field-comments.ts": `
      validateBoundedString(input.comment
      allowTextWhitespaceControls: true
      Comment contains unsupported characters.
    `,
    "src/actions/field-comments-action-scope.test.ts": 'it("rejects unsafe comment text before contract lookup", () => {})',
    "src/actions/renewal-playbook.ts": `
      validateBoundedString(input.body
      allowTextWhitespaceControls: true
      Note contains unsupported characters
    `,
    "src/actions/renewal-playbook-action-scope.test.ts": 'it("rejects unsafe note text before contract lookup", () => {})',
    "src/actions/watchlists.ts": `
      MAX_WATCHLIST_NOTE_LEN
      allowTextWhitespaceControls: true
    `,
    "src/actions/watchlists-action-scope.test.ts": 'it("upsertWatchlistEntryForm rejects unsafe note text before access queries", () => {})',
    "src/actions/maintenance.ts": `
      isIsoDateOnly(fallbackDate)
      validateBoundedString(formData.get("summary") ?? ""
      parsePositiveIntParam(maxRowsInput
      Reason contains unsupported characters
    `,
    "src/actions/maintenance-scope.test.ts": `
      it("rejects unsafe change summaries before auth or data writes", () => {})
      it("rejects unsafe archive reasons before auth or data writes", () => {})
    `,
    "src/actions/notes.ts": `
      validateBoundedString(input.note
      allowTextWhitespaceControls: true
      Note contains unsupported characters
    `,
    "src/actions/notes-action-scope.test.ts": 'it("rejects unsafe note text before contract access lookup", () => {})',
    "src/actions/settings.ts": `
      validateBoundedString(formData.get("fullName") ?? ""
      validateBoundedString(formData.get("name") ?? ""
      MAX_INVITE_EMAIL_LEN
      parseFixedEnumParam(roleValue
      VALID_INVITE_ROLES
      Organization name contains unsupported characters
      Invalid email address
    `,
    "src/actions/settings-action-scope.test.ts": `
      it("updateProfile rejects unsafe profile names before data writes", () => {})
      it("updateOrganization rejects unsafe organization names before membership lookup", () => {})
      it("inviteOrgMember rejects unsafe invite emails before auth or membership lookup", () => {})
      it("inviteOrgMember rejects unsupported invite roles before auth or membership lookup", () => {})
    `,
    "src/actions/auth.ts": `
      readAuthEmail(
      readAuthPassword(
      readAuthDisplayName(
      containsControlOrBidi(raw)
      isReasonableEmail(email)
      Password contains unsupported characters.
      Name contains unsupported characters.
    `,
    "src/actions/auth-actions.test.ts": `
      it("returns error for unsafe email text before password sign-in", () => {})
      it("returns error for unsafe display names before sign-up", () => {})
      it("resetPassword rejects unsafe replacement passwords before calling updateUser", () => {})
    `,
    "src/actions/saved-views.ts": `
      readOptionalSavedViewString(
      MAX_SUMMARY_RECIPIENTS
      isReasonableEmail(v)
      Saved view filters contain unsupported characters
    `,
    "src/actions/saved-views-scope.test.ts": `
      it("rejects unsafe saved view names before membership lookup", () => {})
      it("rejects unsafe saved view filters before membership lookup", () => {})
      it("rejects unsafe summary recipients before saved view lookup", () => {})
    `,
    "src/actions/automation.ts": `
      parsePositiveIntParam
      MAX_AUTOMATION_DAY_WINDOW
      !taskDetailsValidation.ok
      Rule name contains unsupported characters
    `,
    "src/actions/automation-action-scope.test.ts": `
      it("createTaskAutomationRule rejects unsafe names before membership lookup", () => {})
      it("createTaskAutomationRuleForm rejects unsafe FormData text before auth or writes", () => {})
      it("createTaskAutomationRuleForm clamps malformed numeric fields into bounded config", () => {})
    `,
    "src/actions/workflow-config.ts": `
      readWorkflowString(
      parseWorkflowHttpsUrl(
      parseWorkflowJsonObject(
      parseWorkflowInt(
      parseFutureIsoTimestamp(
      hasUnsafeJsonKey(parsed)
      isJsonShapeWithinLimits(parsed
      textInputError("Webhook URL", urlValidation)
      Invalid configJson payload
    `,
    "src/actions/workflow-config-action-scope.test.ts": `
      it("createWebhookSubscriptionForm rejects unsafe webhook URLs before auth or writes", () => {})
      it("upsertIntegrationConnectionForm rejects unsafe JSON keys before auth or writes", () => {})
      it("upsertWorkflowSettingsForm clamps malformed numeric settings into bounded config", () => {})
      it("revokeIntegrationApiKeyForm rejects unsafe revocation reasons before auth or cookies", () => {})
    `,
    "src/actions/tasks-automation.ts": "isIsoDateOnly(fieldDateValue.slice(0, 10))",
    "scripts/check-api-tenant-isolation.test.mjs": `
      test("analyzeTenantIsolationRoute flags cursor predicates before org predicates", () => {})
      test("analyzeTenantIsolationRoute accepts command-palette search through command index visibility helper", () => {})
    `,
    ...overrides,
  };
  for (const [rel, content] of Object.entries(files)) write(root, rel, content);
}

test("analyzeInputValidationPolicy accepts required validation markers", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-input-validation-"));
  writeFixture(root);
  const report = analyzeInputValidationPolicy(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});

test("analyzeInputValidationPolicy rejects missing prototype-pollution coverage", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-input-validation-missing-"));
  writeFixture(root, {
    "src/lib/security/validation.test.ts": `
      it("rejects bidi and control characters", () => {})
      it("rejects excessive depth, arrays, object keys, and string lengths", () => {})
      it("caps pagination limits and falls back on invalid numbers", () => {})
      it("selects only fixed sort keys", () => {})
      it("validates date ranges and maximum span", () => {})
    `,
  });
  const report = analyzeInputValidationPolicy(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "missing_marker" && issue.rel === "src/lib/security/validation.test.ts"), true);
});

test("analyzeInputValidationPolicy rejects dynamic routes without path parameter guards", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-input-validation-route-param-"));
  writeFixture(root, {
    "src/app/api/example/[id]/route.ts": `
      export async function GET(_request, { params }) {
        const { id } = await params;
        return Response.json({ id });
      }
    `,
  });
  const report = analyzeInputValidationPolicy(root);
  assert.equal(report.ok, false);
  assert.equal(
    report.issues.some((issue) => issue.issue === "dynamic_route_missing_param_shape_guard" && issue.rel === "src/app/api/example/[id]/route.ts"),
    true
  );
});

test("analyzeInputValidationPolicy rejects action routes without enum guards", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-input-validation-action-param-"));
  writeFixture(root, {
    "src/app/api/example/[id]/[action]/route.ts": `
      export async function POST(_request, { params }) {
        const { id, action } = await params;
        rejectUnsafeRouteParams({ id, action }, ["id", "action"], "/api/example/[id]/[action]");
        return Response.json({ id, action });
      }
    `,
  });
  const report = analyzeInputValidationPolicy(root);
  assert.equal(report.ok, false);
  assert.equal(
    report.issues.some(
      (issue) =>
        issue.issue === "dynamic_action_route_missing_enum_guard" &&
        issue.rel === "src/app/api/example/[id]/[action]/route.ts"
    ),
    true
  );
});

test("analyzeInputValidationPolicy rejects raw pagination, enum, date, and boolean query parameters", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-input-validation-query-param-"));
  writeFixture(root, {
    "src/app/api/query/route.ts": `
      export async function GET(request) {
        const url = new URL(request.url);
        const limit = url.searchParams.get("limit");
        const format = url.searchParams.get("format");
        const since = url.searchParams.get("since");
        const includeReminders = url.searchParams.get("includeReminders");
        return Response.json({ limit, format, since, includeReminders });
      }
    `,
  });
  const report = analyzeInputValidationPolicy(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "query_param_missing_positive_int_parser"), true);
  assert.equal(report.issues.some((issue) => issue.issue === "query_param_missing_fixed_enum_parser"), true);
  assert.equal(report.issues.some((issue) => issue.issue === "query_param_missing_date_parser"), true);
  assert.equal(report.issues.some((issue) => issue.issue === "query_param_missing_boolean_parser"), true);
});
