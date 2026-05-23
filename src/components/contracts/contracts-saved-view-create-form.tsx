"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { createContractsSavedViewWithFeedback } from "@/actions/saved-views";
import { PermissionEligibilityHint } from "@/components/ui/permission-eligibility-hint";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="ui-btn-secondary shrink-0 px-3 py-1.5 text-[12px]">
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

export type ContractsSavedViewDefaults = {
  search: string;
  status: string;
  owner: string;
  counterparty: string;
  contract_type: string;
  region: string;
  deadline: string;
  sort: string;
  exceptions: string;
  review: string;
  data_quality: string;
  evidence: string;
  work: string;
};

export function ContractsSavedViewCreateForm(props: {
  organizationId: string;
  canEdit: boolean;
  defaults: ContractsSavedViewDefaults;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(createContractsSavedViewWithFeedback, undefined);

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
  }, [state?.ok, router]);

  if (!props.canEdit) {
    return <PermissionEligibilityHint variant="not_permitted" />;
  }

  const d = props.defaults;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="organizationId" value={props.organizationId} />
      <input type="hidden" name="search" value={d.search} />
      <input type="hidden" name="status" value={d.status} />
      <input type="hidden" name="owner" value={d.owner} />
      <input type="hidden" name="counterparty" value={d.counterparty} />
      <input type="hidden" name="contract_type" value={d.contract_type} />
      <input type="hidden" name="region" value={d.region} />
      <input type="hidden" name="deadline" value={d.deadline} />
      <input type="hidden" name="sort" value={d.sort} />
      <input type="hidden" name="exceptions" value={d.exceptions} />
      <input type="hidden" name="review" value={d.review} />
      <input type="hidden" name="data_quality" value={d.data_quality} />
      <input type="hidden" name="evidence" value={d.evidence} />
      <input type="hidden" name="work" value={d.work} />
      <div className="flex items-center gap-2">
        <label htmlFor="saved-view-name" className="sr-only">
          Save current view
        </label>
        <input
          id="saved-view-name"
          name="name"
          required
          maxLength={80}
          placeholder="Name this view…"
          className="ui-input-compact h-9 flex-1 text-[12.5px]"
          aria-invalid={state?.error ? true : undefined}
          aria-describedby={state?.error ? "saved-view-error" : undefined}
        />
        <SubmitButton />
      </div>
      {state?.error ? (
        <p id="saved-view-error" role="alert" className="text-[12.5px] font-medium text-[var(--danger-ink)]">
          {describeRecoverableMutationError(state.error)}
        </p>
      ) : null}
    </form>
  );
}
