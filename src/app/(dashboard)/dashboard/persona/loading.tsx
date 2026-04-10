const shell =
  "rounded-2xl border border-[var(--border-subtle)] bg-surface shadow-[var(--shadow-1)]";

export default function PersonaDashboardLoading() {
  return (
    <div className="ui-page-stack" aria-hidden>
      <div className={`ui-skeleton h-20 ${shell}`} />
      <div className={`ui-skeleton h-28 ${shell}`} />
      <div className={`ui-skeleton h-56 ${shell}`} />
      <div className={`ui-skeleton h-72 ${shell}`} />
    </div>
  );
}
