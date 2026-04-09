"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RelationshipKeyJump() {
  const router = useRouter();
  const [accountKey, setAccountKey] = useState("");
  const [counterpartyKey, setCounterpartyKey] = useState("");

  function goAccount(e: React.FormEvent) {
    e.preventDefault();
    const k = accountKey.trim();
    if (!k) return;
    router.push(`/accounts/${encodeURIComponent(k)}`);
  }

  function goCounterparty(e: React.FormEvent) {
    e.preventDefault();
    const k = counterpartyKey.trim();
    if (!k) return;
    router.push(`/counterparties/${encodeURIComponent(k)}`);
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form onSubmit={goAccount} className="rounded-xl border border-zinc-200/80 bg-zinc-50/40 p-5">
        <p className="ui-label-caps">Account workspace</p>
        <p className="mt-1 text-xs text-zinc-500">
          Use the same <code className="rounded bg-zinc-200/60 px-1">account_key</code> stored on contracts.
        </p>
        <label className="mt-3 block text-xs font-medium text-zinc-600">
          Account key
          <input
            className="ui-input mt-1 w-full"
            value={accountKey}
            onChange={(ev) => setAccountKey(ev.target.value)}
            placeholder="e.g. acme_corp"
            autoComplete="off"
          />
        </label>
        <button type="submit" className="ui-btn-primary mt-3 w-full text-sm">
          Open account summary
        </button>
      </form>
      <form onSubmit={goCounterparty} className="rounded-xl border border-zinc-200/80 bg-zinc-50/40 p-5">
        <p className="ui-label-caps">Counterparty workspace</p>
        <p className="mt-1 text-xs text-zinc-500">
          Use <code className="rounded bg-zinc-200/60 px-1">counterparty_key</code> from contract records.
        </p>
        <label className="mt-3 block text-xs font-medium text-zinc-600">
          Counterparty key
          <input
            className="ui-input mt-1 w-full"
            value={counterpartyKey}
            onChange={(ev) => setCounterpartyKey(ev.target.value)}
            placeholder="e.g. vendor_llc"
            autoComplete="off"
          />
        </label>
        <button type="submit" className="ui-btn-primary mt-3 w-full text-sm">
          Open counterparty summary
        </button>
      </form>
    </div>
  );
}
