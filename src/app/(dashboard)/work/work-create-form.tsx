import Link from "next/link";
import { UiSelect } from "@/components/ui/ui-select";
import { buildWorkHref } from "@/lib/work/model";
import type { loadWorkPageModel } from "@/lib/work/model";

type WorkModel = Awaited<ReturnType<typeof loadWorkPageModel>>;

type CreateWorkItemAction = (formData: FormData) => Promise<void>;

export function WorkCreateForm({
  model,
  error,
  action,
}: {
  model: WorkModel;
  error: string;
  action: CreateWorkItemAction;
}) {
  return (
    <div className="border-y border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_26%,transparent)] px-5 py-3">
      <form action={action} className="grid gap-3 lg:grid-cols-[1.25fr_1.35fr_0.95fr_0.8fr_0.95fr]">
        <div className="space-y-2">
          <p className="ui-caps-2 text-[var(--text-tertiary)]">{model.primaryCta}</p>
          <label className="ui-label-caps" htmlFor="work-create-contract">
            Linked contract
          </label>
          <UiSelect
            className="block w-full"
            buttonClassName="w-full"
            name="contractId"
            required
            options={model.create.contracts.map((contract) => ({
              value: contract.value,
              label: contract.label,
            }))}
            placeholder="Select contract"
            ariaLabel="Linked contract"
            portal
          />
        </div>
        <div className="space-y-2">
          <label className="ui-label-caps" htmlFor="work-create-title">
            Title
          </label>
          <input
            id="work-create-title"
            name="title"
            required
            className="ui-input w-full"
            placeholder="e.g., Confirm renewal notice owner"
          />
          {error ? <p className="text-[12.5px] text-[var(--danger-ink)]">{error}</p> : null}
        </div>
        <div className="space-y-2">
          <label className="ui-label-caps" htmlFor="work-create-owner">
            Owner
          </label>
          <UiSelect
            className="block w-full"
            buttonClassName="w-full"
            name="assigneeId"
            options={[
              { value: "", label: "Unassigned" },
              ...model.create.ownerOptions.map((owner) => ({
                value: owner.value,
                label: owner.label,
              })),
            ]}
            placeholder="Unassigned"
            ariaLabel="Owner"
            portal
          />
        </div>
        <div className="space-y-2">
          <label className="ui-label-caps" htmlFor="work-create-due">
            Due date
          </label>
          <input id="work-create-due" name="dueDate" type="date" className="ui-input w-full" />
        </div>
        <div className="space-y-2">
          <label className="ui-label-caps" htmlFor="work-create-type">
            Type
          </label>
          <UiSelect
            className="block w-full"
            buttonClassName="w-full"
            name="type"
            defaultValue={model.create.typeOptions[0]?.value ?? ""}
            options={model.create.typeOptions.map((type) => ({
              value: type.value,
              label: type.label,
            }))}
            placeholder={model.create.typeOptions[0]?.label ?? "Type"}
            ariaLabel="Type"
            portal
          />
        </div>
        <div className="space-y-2 lg:col-span-4">
          <label className="ui-label-caps" htmlFor="work-create-details">
            Details
          </label>
          <textarea id="work-create-details" name="details" className="ui-input min-h-16 w-full resize-y" />
        </div>
        <div className="flex flex-wrap items-end justify-end gap-2 lg:col-span-1">
          <Link href={buildWorkHref({ tab: model.activeTab, filters: model.filters })} className="ui-btn-secondary px-4 py-2">
            Cancel
          </Link>
          <button type="submit" className="ui-btn-primary px-4 py-2">
            {model.primaryCta}
          </button>
        </div>
      </form>
    </div>
  );
}
