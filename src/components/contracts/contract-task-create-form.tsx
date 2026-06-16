import { UiSelect } from "@/components/ui/ui-select";
import { PRIORITY_OPTIONS } from "@/components/contracts/contract-tasks-panel-options";
import type { MemberOption } from "./contract-tasks-panel-types";

export function ContractTaskCreateForm({
  members,
  isPending,
  onCreate,
}: {
  members: MemberOption[];
  isPending: boolean;
  onCreate: (formData: FormData) => void;
}) {
  return (
    <form action={onCreate} className="grid gap-3 rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] p-4">
      <div>
        <label className="ui-label-caps">Task title</label>
        <input aria-label="Follow up on renewal terms" name="title" required maxLength={240} placeholder="Follow up on renewal terms" className="ui-input w-full" />
      </div>
      <div>
        <label className="ui-label-caps">Details (optional)</label>
        <textarea name="details" rows={2} maxLength={4000} placeholder="Add context, expected outcome, and dependencies." className="ui-input w-full resize-y" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="ui-label-caps">Priority</label>
          <UiSelect name="priority" defaultValue="medium" ariaLabel="Priority" options={PRIORITY_OPTIONS} variant="compact" portal className="w-full" buttonClassName="w-full !min-h-11" />
        </div>
        <div>
          <label className="ui-label-caps">Assignee</label>
          <UiSelect
            name="assigneeId"
            defaultValue=""
            ariaLabel="Assignee"
            options={[{ value: "", label: "Unassigned" }, ...members.map((m) => ({ value: m.userId, label: m.label }))]}
            variant="compact"
            portal
            searchThreshold={8}
            className="w-full"
            buttonClassName="w-full !min-h-11"
          />
        </div>
        <div>
          <label className="ui-label-caps">Due date</label>
          <input aria-label="Due date" name="dueDate" type="date" className="ui-input w-full" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="ui-label-caps">Team queue</label>
          <input aria-label="ops / legal / finance" name="teamKey" maxLength={80} placeholder="ops / legal / finance" className="ui-input w-full" />
        </div>
        <div>
          <label className="ui-label-caps">Recurrence (days)</label>
          <input aria-label="e.g. 30" name="recurrenceIntervalDays" type="number" min={1} max={3650} placeholder="e.g. 30" className="ui-input w-full" />
        </div>
        <div>
          <label className="ui-label-caps">SLA due at</label>
          <input aria-label="Sla due at" name="slaDueAt" type="datetime-local" className="ui-input w-full" />
        </div>
      </div>
      <div>
        <label className="ui-label-caps">Dependency reason (optional)</label>
        <input aria-label="Input needed from dependency or external response" name="blockedReason" maxLength={400} placeholder="Input needed from dependency or external response" className="ui-input w-full" />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--text-tertiary)]">Tasks attach follow-up actions to this contract.</p>
        <button type="submit" disabled={isPending} className="ui-btn-primary px-4 py-2 text-[12.5px]">
          {isPending ? "Saving..." : "Add task"}
        </button>
      </div>
    </form>
  );
}
