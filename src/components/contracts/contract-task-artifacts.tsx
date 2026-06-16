import { ExternalLink } from "@/components/ui/external-link";
import type { ContractTaskArtifact } from "./contract-tasks-panel-types";

export function ContractTaskArtifacts({
  taskId,
  artifacts,
  canEdit,
  isPending,
  onAdd,
  onDelete,
}: {
  taskId: string;
  artifacts: ContractTaskArtifact[];
  canEdit: boolean;
  isPending: boolean;
  onAdd: (taskId: string, formData: FormData) => void;
  onDelete: (artifactId: string) => void;
}) {
  const taskArtifacts = artifacts.filter((artifact) => artifact.task_id === taskId);

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-[var(--border-subtle)]/70 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
        Artifacts
      </p>
      <ul className="space-y-1">
        {taskArtifacts.map((artifact) => (
          <li key={artifact.id} className="flex items-center justify-between gap-2 text-xs">
            <ExternalLink href={artifact.url} className="truncate text-[var(--accent-strong)] hover:underline">
              {artifact.label}
            </ExternalLink>
            {canEdit ? (
              <button type="button" disabled={isPending} onClick={() => onDelete(artifact.id)} className="ui-btn-secondary px-1.5 py-0.5 text-[11px]">
                Remove
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {canEdit ? (
        <form action={onAdd.bind(null, taskId)} className="grid gap-1 sm:grid-cols-3">
          <input aria-label="Artifact label" name="label" placeholder="Artifact label" className="ui-input h-7 text-[11px]" />
          <input aria-label="https://..." name="url" placeholder="https://..." className="ui-input h-7 text-[11px] sm:col-span-2" />
          <button type="submit" className="ui-btn-secondary px-2 py-1 text-[11px] sm:col-span-3">
            Add artifact
          </button>
        </form>
      ) : null}
    </div>
  );
}
