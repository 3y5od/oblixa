import Link from "next/link";
import { getAuthContext } from "@/lib/supabase/server";
import { createEvidenceTemplateAction } from "@/actions/v4";

export default async function EvidenceStudioPage() {
  const ctx = await getAuthContext();
  if (!ctx) return null;

  const templatesResult = await ctx.admin
    .from("evidence_requirement_templates")
    .select("id, name, requirement_type, created_at")
    .eq("organization_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(50);
  const templates = templatesResult.error ? [] : templatesResult.data ?? [];

  async function createTemplateAction(formData: FormData) {
    "use server";
    await createEvidenceTemplateAction(formData);
  }

  return (
    <div className="space-y-8">
      <header className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Evidence</p>
          <h1 className="ui-display-title mt-2">Evidence studio</h1>
          <p className="ui-muted mt-3">
            Reusable evidence requirement templates and links to contract-level exports.
          </p>
        </div>
      </header>

      <section className="ui-card p-5">
        <p className="ui-label-caps">Create template</p>
        <form action={createTemplateAction} className="mt-3 space-y-2">
          <input name="name" required placeholder="Quarterly attestation pack" className="ui-input w-full max-w-md" />
          <select name="requirementType" className="ui-input w-full max-w-md">
            <option value="document">document</option>
            <option value="structured_form">structured_form</option>
            <option value="comment">comment</option>
            <option value="external_reference">external_reference</option>
            <option value="manager_approval">manager_approval</option>
            <option value="attestation">attestation</option>
          </select>
          <textarea
            name="templateJson"
            rows={4}
            defaultValue='{"description": "Attach signed confirmation", "fields": []}'
            className="ui-input w-full max-w-2xl font-mono text-xs"
          />
          <button type="submit" className="ui-btn-primary px-4 py-2 text-xs">
            Save template
          </button>
        </form>
      </section>

      <section className="ui-card p-5">
        <p className="ui-label-caps">Templates</p>
        <ul className="mt-3 space-y-2 text-sm">
          {templates.length === 0 ? (
            <li className="text-zinc-500">No templates yet.</li>
          ) : (
            templates.map((t) => (
              <li key={t.id} className="rounded border border-zinc-200 px-3 py-2">
                <span className="font-medium text-zinc-900">{t.name}</span>
                <span className="text-xs text-zinc-500"> · {t.requirement_type}</span>
              </li>
            ))
          )}
        </ul>
        <p className="mt-4 text-xs text-zinc-500">
          On any contract, use{" "}
          <span className="font-mono text-zinc-700">Download evidence pack (JSON)</span> in the overview workflow card
          to export requirements and submissions.
        </p>
        <Link href="/contracts" className="ui-link mt-2 inline-block text-xs">
          Go to contracts
        </Link>
      </section>
    </div>
  );
}
