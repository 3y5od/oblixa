const shell =
  "rounded-2xl border border-[var(--border-subtle)] bg-surface shadow-[var(--shadow-1)]";

export default function ContractTasksLoading() {
  return (
    <div className="ui-page-stack" aria-hidden>
      <div className={`ui-skeleton h-24 ${shell}`} />
      <div className={`ui-skeleton h-48 ${shell}`} />
      <div className={`ui-skeleton h-80 ${shell}`} />
    </div>
  );
}
