/** Printable HTML for a decision packet run (browser Save-as-PDF; no server PDF engine). */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatJsonBlock(value: unknown): string {
  try {
    return escapeHtml(JSON.stringify(value, null, 2));
  } catch {
    return escapeHtml(String(value));
  }
}

function row(label: string, value: string): string {
  return `<tr><th style="text-align:left;padding:8px 12px 8px 0;border-bottom:1px solid #e4e4e7;vertical-align:top;width:160px;color:#52525b;font-weight:600">${escapeHtml(
    label
  )}</th><td style="padding:8px 0;border-bottom:1px solid #e4e4e7">${value}</td></tr>`;
}

export function buildDecisionPacketRunHtml(input: {
  decisionId: string;
  runId: string;
  packetType: string;
  exportedAt: string | null;
  createdAt: string | null;
  payload: unknown;
}): string {
  const p =
    input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
      ? (input.payload as Record<string, unknown>)
      : {};
  const decision =
    p.decision && typeof p.decision === "object" && !Array.isArray(p.decision)
      ? (p.decision as Record<string, unknown>)
      : {};
  const title =
    typeof decision.title === "string" && decision.title.trim()
      ? decision.title
      : "Decision packet";
  const hint =
    typeof p.template_catalog_hint === "string" ? p.template_catalog_hint : "";

  const decisionRows: string[] = [];
  const add = (k: string, v: unknown) => {
    if (v === undefined || v === null || v === "") return;
    decisionRows.push(row(k, escapeHtml(String(v))));
  };
  add("Decision type", decision.decision_type);
  add("Status", decision.status);
  add("Due", decision.due_at);
  add("Account key", decision.linked_account_key);
  add("Counterparty key", decision.linked_counterparty_key);

  const contracts = Array.isArray(p.linked_contracts) ? p.linked_contracts : [];
  const contractRows = contracts
    .filter((c): c is Record<string, unknown> => c !== null && typeof c === "object")
    .map((c) => {
      const id = typeof c.id === "string" ? c.id : "";
      const t = typeof c.title === "string" ? c.title : "";
      return `<li>${escapeHtml(id)}${t ? ` — ${escapeHtml(t)}` : ""}</li>`;
    })
    .join("");

  const queue = Array.isArray(p.manager_queue_snapshot) ? p.manager_queue_snapshot : [];
  const queueTable =
    queue.length === 0
      ? ""
      : `<h2 style="margin-top:28px;font-size:16px">Open decision queue (snapshot)</h2>
<table style="border-collapse:collapse;width:100%;max-width:960px;font-size:13px">
<thead><tr>
<th style="text-align:left;padding:8px;border-bottom:2px solid #e4e4e7">Title</th>
<th style="text-align:left;padding:8px;border-bottom:2px solid #e4e4e7">Type</th>
<th style="text-align:left;padding:8px;border-bottom:2px solid #e4e4e7">Status</th>
<th style="text-align:left;padding:8px;border-bottom:2px solid #e4e4e7">Due</th>
<th style="text-align:left;padding:8px;border-bottom:2px solid #e4e4e7">SLA</th>
</tr></thead>
<tbody>
${queue
  .filter((r): r is Record<string, unknown> => r !== null && typeof r === "object")
  .map((r) => {
    const ttl = typeof r.title === "string" ? r.title : "—";
    const dt = typeof r.decision_type === "string" ? r.decision_type : "—";
    const st = typeof r.status === "string" ? r.status : "—";
    const due = typeof r.due_at === "string" ? r.due_at : "—";
    const sla = typeof r.sla_status === "string" ? r.sla_status : "—";
    return `<tr>
<td style="padding:8px;border-bottom:1px solid #f4f4f5">${escapeHtml(ttl)}</td>
<td style="padding:8px;border-bottom:1px solid #f4f4f5">${escapeHtml(dt)}</td>
<td style="padding:8px;border-bottom:1px solid #f4f4f5">${escapeHtml(st)}</td>
<td style="padding:8px;border-bottom:1px solid #f4f4f5">${escapeHtml(due)}</td>
<td style="padding:8px;border-bottom:1px solid #f4f4f5">${escapeHtml(sla)}</td>
</tr>`;
  })
  .join("")}
</tbody></table>`;

  const rationale =
    typeof p.rationale_markdown === "string" && p.rationale_markdown.trim()
      ? `<h2 style="margin-top:28px;font-size:16px">Rationale</h2>
<pre style="white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:12px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;padding:12px">${escapeHtml(
          p.rationale_markdown
        )}</pre>`
      : "";

  const metaLine = [
    `Packet type: ${input.packetType}`,
    input.exportedAt ? `Exported: ${input.exportedAt}` : null,
    `Run: ${input.runId}`,
    `Workspace: ${input.decisionId}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(title)} — packet</title>
<style>
body{font-family:system-ui,sans-serif;padding:24px;color:#18181b;max-width:960px;margin:0 auto;line-height:1.45}
h1{font-size:22px;margin:0 0 8px}
.sub{color:#52525b;font-size:14px;margin-bottom:24px}
table.meta{width:100%;max-width:720px}
@media print{body{padding:12px}}
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p class="sub">${escapeHtml(metaLine)}</p>
${hint ? `<p style="color:#52525b;font-size:14px">${escapeHtml(hint)}</p>` : ""}
<h2 style="margin-top:24px;font-size:16px">Decision</h2>
<table class="meta"><tbody>${decisionRows.join("")}</tbody></table>
${rationale}
${p.recommendation_json !== undefined && p.recommendation_json !== null ? `<h2 style="margin-top:28px;font-size:16px">Recommendation</h2><pre style="white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:12px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;padding:12px">${formatJsonBlock(p.recommendation_json)}</pre>` : ""}
${p.final_disposition_json !== undefined && p.final_disposition_json !== null ? `<h2 style="margin-top:28px;font-size:16px">Final disposition</h2><pre style="white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:12px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;padding:12px">${formatJsonBlock(p.final_disposition_json)}</pre>` : ""}
${contractRows ? `<h2 style="margin-top:28px;font-size:16px">Linked contracts</h2><ul>${contractRows}</ul>` : ""}
${queueTable}
${
  Object.keys(p.template_overlay ?? {}).length > 0
    ? `<h2 style="margin-top:28px;font-size:16px">Template overlay</h2><pre style="white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:12px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;padding:12px">${formatJsonBlock(p.template_overlay)}</pre>`
    : ""
}
<h2 style="margin-top:28px;font-size:16px">Full payload (JSON)</h2>
<pre style="white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:11px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;padding:12px;max-height:480px;overflow:auto">${formatJsonBlock(
    input.payload
  )}</pre>
<p style="margin-top:32px;font-size:12px;color:#71717a">Print this page or use your browser’s Print dialog to save as PDF.</p>
</body>
</html>`;
}
