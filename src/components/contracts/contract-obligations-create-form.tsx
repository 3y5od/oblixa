import { applyObligationTemplatesToContractForm } from "@/actions/obligations";
import { UiSelect } from "@/components/ui/ui-select";
import { RECURRENCE_OPTIONS } from "@/components/contracts/contract-obligations-panel-options";
import type { MemberOption } from "@/components/contracts/contract-obligations-panel-types";

export function ContractObligationCreateTools({
  contractId,
  members,
  isPending,
  onCreate,
}: {
  contractId: string;
  members: MemberOption[];
  isPending: boolean;
  onCreate: (formData: FormData) => void;
}) {
  return (
    <>
      <form action={onCreate} className="grid gap-3 rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="ui-label-caps">Requirement</label>
            <input
              aria-label="Deliver quarterly compliance report"
              name="title"
              required
              maxLength={240}
              placeholder="Deliver quarterly compliance report"
              className="ui-input w-full"
            />
          </div>
          <div>
            <label className="ui-label-caps">Type</label>
            <input
              aria-label="reporting"
              name="obligationType"
              maxLength={80}
              placeholder="reporting"
              className="ui-input w-full"
            />
          </div>
          <div>
            <label className="ui-label-caps">Cadence</label>
            <input
              aria-label="monthly / quarterly / annual"
              name="cadence"
              maxLength={120}
              placeholder="monthly / quarterly / annual"
              className="ui-input w-full"
            />
          </div>
          <div>
            <label className="ui-label-caps">Recurrence</label>
            <UiSelect
              name="recurrenceType"
              defaultValue="none"
              ariaLabel="Recurrence"
              options={RECURRENCE_OPTIONS}
              variant="compact"
              portal
              className="w-full"
              buttonClassName="w-full !min-h-11"
            />
          </div>
          <div>
            <label className="ui-label-caps">Recurrence interval days</label>
            <input
              aria-label="e.g. 30"
              name="recurrenceIntervalDays"
              type="number"
              min={1}
              max={3650}
              placeholder="e.g. 30"
              className="ui-input w-full"
            />
          </div>
          <div>
            <label className="ui-label-caps">Owner</label>
            <UiSelect
              name="ownerId"
              defaultValue=""
              ariaLabel="Owner"
              options={[
                { value: "", label: "Unassigned" },
                ...members.map((m) => ({ value: m.userId, label: m.label })),
              ]}
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
          <div>
            <label className="ui-label-caps">Escalation due at</label>
            <input
              aria-label="Escalation due at"
              name="escalationDueAt"
              type="datetime-local"
              className="ui-input w-full"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="ui-label-caps">Details (optional)</label>
            <textarea
              name="details"
              rows={2}
              maxLength={4000}
              placeholder="Capture criteria, source clause, and evidence expectations."
              className="ui-input w-full resize-y"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="ui-label-caps">Evidence URL (optional)</label>
            <input
              aria-label="https://..."
              name="evidenceUrl"
              type="url"
              placeholder="https://..."
              className="ui-input w-full"
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--text-tertiary)]">
            Requirements track non-date commitments tied to this contract.
          </p>
          <button type="submit" disabled={isPending} className="ui-btn-primary px-4 py-2 text-[12.5px]">
            {isPending ? "Saving..." : "Add requirement"}
          </button>
        </div>
      </form>
      <form action={applyObligationTemplatesToContractForm.bind(null, contractId) as never}>
        <button type="submit" disabled={isPending} className="ui-btn-secondary px-4 py-2 text-[12.5px]">
          Apply templates for this contract type
        </button>
      </form>
    </>
  );
}
