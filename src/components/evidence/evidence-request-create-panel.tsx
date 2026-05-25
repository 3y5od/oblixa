"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { UiSelect } from "@/components/ui/ui-select";
import { mutateV10 } from "@/lib/api-client";
import { EVIDENCE_ACTION_LABELS } from "@/lib/evidence/spec-strings";
import type { EvidenceCreateModel } from "@/lib/evidence/types";

export function EvidenceRequestCreatePanel({
  model,
  cancelHref,
}: {
  model: EvidenceCreateModel;
  cancelHref: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [contractId, setContractId] = useState(model.selectedContractId);
  const [obligationId, setObligationId] = useState("");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [responderEmail, setResponderEmail] = useState("");
  const [allowedFileTypes, setAllowedFileTypes] = useState("pdf, docx");
  const [message, setMessage] = useState<string | null>(null);

  const obligationOptions = useMemo(
    () => [
      { value: "", label: "No linked obligation" },
      ...model.obligations.map((obligation) => ({ value: obligation.value, label: obligation.label })),
    ],
    [model.obligations]
  );

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const result = await mutateV10({
        url: "/api/evidence/requests",
        body: {
          contractId,
          sourceType: obligationId ? "obligation" : "contract",
          sourceId: obligationId || contractId,
          dueAt: dueDate ? new Date(`${dueDate}T12:00:00.000Z`).toISOString() : undefined,
          responderEmail: responderEmail.trim() || undefined,
          requiredNote: title.trim(),
          allowedFileTypes: splitTokens(allowedFileTypes),
        },
      });
      if (!result.ok) {
        setMessage(result.userMessage);
        return;
      }
      router.push("/contracts/evidence-studio");
      router.refresh();
    });
  }

  return (
    <div className="border-y border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_26%,transparent)] px-5 py-4">
      <div className="grid gap-3 lg:grid-cols-[1.1fr_1.35fr_1fr_0.8fr]">
        <div className="space-y-2">
          <p className="ui-caps-2 text-[var(--text-tertiary)]">{EVIDENCE_ACTION_LABELS.request_evidence}</p>
          <label className="block text-[12.5px] font-medium text-[var(--text-secondary)]" htmlFor="evidence-create-contract">
            Linked contract
          </label>
          <UiSelect
            className="block w-full"
            buttonClassName="w-full"
            value={contractId}
            onChange={setContractId}
            options={model.contracts.map((contract) => ({ value: contract.value, label: contract.label }))}
            placeholder="Select contract"
            ariaLabel="Linked contract"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="block text-[12.5px] font-medium text-[var(--text-secondary)]" htmlFor="evidence-create-title">
            Request title
          </label>
          <input
            id="evidence-create-title"
            className="ui-input w-full"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g., Upload current cyber insurance certificate"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="block text-[12.5px] font-medium text-[var(--text-secondary)]" htmlFor="evidence-create-obligation">
            Linked obligation
          </label>
          <UiSelect
            className="block w-full"
            buttonClassName="w-full"
            value={obligationId}
            onChange={setObligationId}
            options={obligationOptions}
            placeholder="No linked obligation"
            ariaLabel="Linked obligation"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-[12.5px] font-medium text-[var(--text-secondary)]" htmlFor="evidence-create-due">
            Due date
          </label>
          <input
            id="evidence-create-due"
            type="date"
            className="ui-input w-full"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </div>
        <div className="space-y-2 lg:col-span-2">
          <label className="block text-[12.5px] font-medium text-[var(--text-secondary)]" htmlFor="evidence-create-responder">
            Responder email
          </label>
          <input
            id="evidence-create-responder"
            className="ui-input w-full"
            value={responderEmail}
            onChange={(event) => setResponderEmail(event.target.value)}
            placeholder="vendor@example.com"
            type="email"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-[12.5px] font-medium text-[var(--text-secondary)]" htmlFor="evidence-create-files">
            Allowed file types
          </label>
          <input
            id="evidence-create-files"
            className="ui-input w-full"
            value={allowedFileTypes}
            onChange={(event) => setAllowedFileTypes(event.target.value)}
            placeholder="pdf, docx"
          />
        </div>
        <div className="flex flex-wrap items-end justify-end gap-2">
          <Link href={cancelHref} className="ui-btn-secondary px-4 py-2">
            Cancel
          </Link>
          <button
            type="button"
            className="ui-btn-primary px-4 py-2 disabled:opacity-60"
            disabled={isPending || !contractId || !title.trim()}
            onClick={submit}
          >
            {isPending ? "Saving..." : EVIDENCE_ACTION_LABELS.request_evidence}
          </button>
        </div>
      </div>
      {message ? (
        <p className="mt-3 text-[12.5px] text-[var(--danger-ink)]" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function splitTokens(value: string) {
  return value
    .split(/[,\s]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}
