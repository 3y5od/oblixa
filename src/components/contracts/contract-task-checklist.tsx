import type { ContractTaskChecklistItem } from "./contract-tasks-panel-types";

export function ContractTaskChecklist({
  taskId,
  items,
  canEdit,
  isPending,
  onToggle,
  onAdd,
  onUpdate,
  onDelete,
  onMove,
}: {
  taskId: string;
  items: ContractTaskChecklistItem[];
  canEdit: boolean;
  isPending: boolean;
  onToggle: (checklistItemId: string, done: boolean) => void;
  onAdd: (taskId: string, formData: FormData) => void;
  onUpdate: (checklistItemId: string, formData: FormData) => void;
  onDelete: (checklistItemId: string) => void;
  onMove: (checklistItemId: string, direction: "up" | "down") => void;
}) {
  const taskItems = items
    .filter((item) => item.task_id === taskId)
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-[var(--border-subtle)]/70 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
        Checklist
      </p>
      <ul className="space-y-1">
        {taskItems.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={item.is_done} disabled={isPending || !canEdit} onChange={(e) => onToggle(item.id, e.target.checked)} className="ui-checkbox" />
            <span className={item.is_done ? "text-[var(--text-tertiary)] line-through" : "text-[var(--text-secondary)]"}>
              {item.label}
            </span>
            {canEdit ? (
              <ChecklistItemActions item={item} isPending={isPending} onUpdate={onUpdate} onDelete={onDelete} onMove={onMove} />
            ) : null}
          </li>
        ))}
      </ul>
      {canEdit ? (
        <form action={onAdd.bind(null, taskId)} className="flex items-center gap-2">
          <input aria-label="Add checklist item" name="label" placeholder="Add checklist item" className="ui-input h-7 flex-1 text-[11px]" />
          <button type="submit" className="ui-btn-secondary px-2 py-1 text-[11px]">
            Add
          </button>
        </form>
      ) : null}
    </div>
  );
}

function ChecklistItemActions({
  item,
  isPending,
  onUpdate,
  onDelete,
  onMove,
}: {
  item: ContractTaskChecklistItem;
  isPending: boolean;
  onUpdate: (checklistItemId: string, formData: FormData) => void;
  onDelete: (checklistItemId: string) => void;
  onMove: (checklistItemId: string, direction: "up" | "down") => void;
}) {
  return (
    <>
      <form action={onUpdate.bind(null, item.id)} className="ml-auto flex items-center gap-1">
        <input aria-label="Label" name="label" defaultValue={item.label} className="ui-input h-6 w-40 text-[11px]" />
        <button type="submit" className="ui-btn-secondary px-1.5 py-0.5 text-[11px]">
          Save
        </button>
      </form>
      <button type="button" disabled={isPending} onClick={() => onMove(item.id, "up")} className="ui-btn-secondary px-1.5 py-0.5 text-[11px]">
        {"\u2191"}
      </button>
      <button type="button" disabled={isPending} onClick={() => onMove(item.id, "down")} className="ui-btn-secondary px-1.5 py-0.5 text-[11px]">
        {"\u2193"}
      </button>
      <button type="button" disabled={isPending} onClick={() => onDelete(item.id)} className="ui-btn-secondary px-1.5 py-0.5 text-[11px]">
        Remove
      </button>
    </>
  );
}
