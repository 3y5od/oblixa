export function SettingsHealthRestrictedState() {
  return (
    <div className="ui-card px-6 py-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">Workspace</p>
      <h1 className="mt-2 text-[1.75rem] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)] sm:text-[2rem]">
        System health
      </h1>
      <div className="mt-6 max-w-xl rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
        <p className="text-[12.5px] font-semibold text-[var(--text-primary)]">System health is restricted</p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
          You do not have permission to view operational health details for this workspace.
        </p>
        <p className="mt-3 text-[11px] text-[var(--text-tertiary)]">
          Ask a workspace admin to grant settings access or open a support-safe diagnostic from another authorized
          account.
        </p>
      </div>
    </div>
  );
}
