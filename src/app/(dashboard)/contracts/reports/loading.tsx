const shell =
  "rounded-2xl border border-[var(--border-subtle)] bg-surface shadow-[var(--shadow-1)]";

export default function ReportsHistoryLoading() {
  return (
    <div className="ui-page-stack" aria-hidden>
      <div className={`ui-skeleton h-20 ${shell}`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className={`ui-skeleton h-96 ${shell}`} />
        <div className={`ui-skeleton h-96 ${shell}`} />
      </div>
    </div>
  );
}
