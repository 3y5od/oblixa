import Link from "next/link";
import { submitEvidenceNoteAction } from "@/actions/v4";

type ReqRow = {
  id: string;
  title: string;
  requirement_type: string;
  status: string;
  due_at: string | null;
  review_due_at: string | null;
  work_item_type: string;
  work_item_id: string;
};

export function ContractEvidenceRequirementsPanel({
  requirements,
  canEdit,
  contractId,
}: {
  requirements: ReqRow[];
  canEdit: boolean;
  contractId: string;
}) {
  async function submitNote(formData: FormData) {
    "use server";
    await submitEvidenceNoteAction(formData);
  }

  if (requirements.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No structured evidence requirements on this contract yet. Apply a program that references{" "}
        <code className="text-xs">evidenceTemplateIds</code> or add templates in Evidence studio.
      </p>
    );
  }

  return (
    <ul className="space-y-3 text-sm">
      {requirements.map((r) => (
        <li key={r.id} className="rounded-lg border border-zinc-200 px-3 py-2">
          <p className="font-medium text-zinc-900">{r.title}</p>
          <p className="text-xs text-zinc-500">
            {r.requirement_type} · {r.status}
            {r.due_at ? ` · due ${r.due_at.slice(0, 10)}` : ""}
            <span className="text-zinc-300"> · </span>
            {r.work_item_type} {r.work_item_id.slice(0, 8)}…
          </p>
          {canEdit && (r.status === "required" || r.status === "rejected") ? (
            <form action={submitNote} className="mt-2 flex flex-wrap items-end gap-2">
              <input type="hidden" name="requirementId" value={r.id} />
              <textarea
                name="note"
                rows={2}
                placeholder="Evidence notes, URL, or completion summary"
                className="ui-input min-w-[12rem] flex-1 text-xs"
                required
              />
              <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
                Submit
              </button>
            </form>
          ) : null}
        </li>
      ))}
      <li className="text-xs text-zinc-500">
        <Link href={`/api/evidence/export/${contractId}`} className="ui-link" target="_blank" rel="noreferrer">
          Export evidence pack (JSON)
        </Link>
      </li>
    </ul>
  );
}
