import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeAiToolCallAuthz } from "./check-ai-tool-call-authz.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeBase(root) {
  write(root, "package.json", JSON.stringify({ scripts: { "check:ai-tool-call-authz": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:ai-tool-call-authz\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:ai-tool-call-authz"\n');
  write(
    root,
    "src/lib/security/ai-tool-call-authz.ts",
    'verifyAiToolMutationRequest\nauthorizeAiToolMutation\nrecordAiToolAuditEvent\nai_tool_auth_required\nai_tool_arguments_invalid\nai_tool_cross_org_arguments\nai_tool_role_required\nai_tool_capability_required\nai_tool_target_forbidden\nrequiredRole\nrequiredCapability\nauthorizeTarget\nredactSensitiveLogString\n.from("audit_events").insert\n'
  );
  write(
    root,
    "src/lib/security/ai-tool-call-authz.test.ts",
    "rejects AI tool calls without authenticated org context\nvalidates AI tool arguments with the direct user input parser\nrejects cross-org AI tool arguments\nrecords an audit event for authorized AI-assisted actions\nrequires role, capability, and target scope before authorizing AI tools\n"
  );
  write(
    root,
    "scripts/check-ai-tool-call-authz.test.mjs",
    "rejects OpenAI tool surfaces that do not use the authz helper\naccepts OpenAI tool surfaces routed through AI tool authz\nai_tool_call_surface_missing_role_gate\nai_tool_call_surface_missing_capability_gate\nai_tool_call_surface_missing_target_scope_authorization\n"
  );
}

test("analyzeAiToolCallAuthz accepts source with no AI tool-call surface", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-ai-tool-authz-ok-"));
  writeBase(root);
  write(root, "src/lib/extraction/extract-fields.ts", 'import("openai");\nclient.chat.completions.create({ messages: [] });\n');

  const report = analyzeAiToolCallAuthz(root);
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
});

test("analyzeAiToolCallAuthz rejects OpenAI tool surfaces that do not use the authz helper", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-ai-tool-authz-bad-"));
  writeBase(root);
  write(
    root,
    "src/lib/ai/tool-runner.ts",
    'import OpenAI from "openai";\nconst client = new OpenAI();\nawait client.chat.completions.create({ tools: [] });\n'
  );

  const report = analyzeAiToolCallAuthz(root);
  assert.equal(report.ok, false);
  assert(
    report.issues.some(
      (issue) =>
        issue.rel === "src/lib/ai/tool-runner.ts" &&
        issue.issue === "ai_tool_call_surface_present_requires_explicit_authorization_design"
    )
  );
  assert(report.issues.some((issue) => issue.issue === "ai_tool_call_surface_missing_authenticated_org_context"));
  assert(report.issues.some((issue) => issue.issue === "ai_tool_call_surface_missing_argument_validation"));
  assert(report.issues.some((issue) => issue.issue === "ai_tool_call_surface_missing_audit_event"));
  assert(report.issues.some((issue) => issue.issue === "ai_tool_call_surface_missing_role_gate"));
  assert(report.issues.some((issue) => issue.issue === "ai_tool_call_surface_missing_capability_gate"));
  assert(report.issues.some((issue) => issue.issue === "ai_tool_call_surface_missing_target_scope_authorization"));
});

test("analyzeAiToolCallAuthz accepts OpenAI tool surfaces routed through AI tool authz", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-ai-tool-authz-authorized-"));
  writeBase(root);
  write(
    root,
    "src/lib/ai/tool-runner.ts",
    [
      'import OpenAI from "openai";',
      'import { authorizeAiToolMutation, recordAiToolAuditEvent, type AiToolMutationAuthContext } from "@/lib/security/ai-tool-call-authz";',
      "const directSchema = { safeParse: (raw) => ({ success: true, data: raw }) };",
      "export async function run(ctx: AiToolMutationAuthContext, raw) {",
      "  const result = await authorizeAiToolMutation({ ctx, toolName: 'task.create', rawArguments: raw, parseArguments: directSchema.safeParse, getArgumentOrgId: (args) => args.organizationId, requiredRole: 'admin', requiredCapability: 'tasks:write', targetType: 'contract', targetId: (args) => args.contractId, authorizeTarget: (args, ctx) => args.organizationId === ctx.orgId });",
      "  if (!result.ok) return result;",
      "  await recordAiToolAuditEvent(ctx.admin, { organizationId: result.ctx.orgId, userId: result.ctx.userId, toolName: result.toolName, status: 'executed' });",
      "  const client = new OpenAI();",
      "  return client.chat.completions.create({ tools: [] });",
      "}",
    ].join("\n")
  );

  const report = analyzeAiToolCallAuthz(root);
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
});
