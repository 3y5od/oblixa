import Link from "next/link";
import type { ContractTask } from "@/lib/types";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBusinessDateAtNoon } from "@/lib/v9-business-dates";

type TaskRow = Pick<ContractTask, "id" | "title" | "status" | "priority" | "due_date"> & {
  contracts: { id: string; title: string };
};

function priorityTone(priority: ContractTask["priority"]) {
  if (priority === "high") return "text-[var(--danger-ink)]";
  if (priority === "low") return "text-[var(--text-tertiary)]";
  return "text-[var(--warning-ink)]";
}

export function MyTasks({ tasks }: { tasks: TaskRow[] }) {
  if (tasks.length === 0) {
    return (
      <section>
        <EmptyState
          eyebrow="Your queue"
          title="No open tasks"
          copy="Tasks assigned to you will appear here with due dates and contract context."
          className="min-h-[200px] md:min-h-[220px]"
        />
      </section>
    );
  }

  return (
    <section className="ui-card overflow-hidden">
      <div className="ui-surface-tint px-4 py-3.5 md:px-6 md:py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="ui-section-title">My open tasks</h2>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)] md:text-[12px]">
              Assigned work that still needs action
            </p>
          </div>
          <Link href="/contracts/tasks" className="ui-link text-[12px] md:text-[13px]">
            Full queue
          </Link>
        </div>
      </div>
      <ul className="divide-y divide-[var(--border-subtle)]">
        {tasks.map((task) => (
          <li key={task.id}>
            <Link
              href={`/contracts/${task.contracts.id}`}
              className="block px-4 py-3.5 transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_72%,transparent)] md:px-6 md:py-4"
            >
              <p className="text-[14px] font-semibold text-[var(--text-primary)] md:text-[15px]">{task.title}</p>
              <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">{task.contracts.title}</p>
              <p className="mt-1 text-[12px]">
                <span className={`font-semibold ${priorityTone(task.priority)}`}>
                  {task.priority}
                </span>
                <span className="text-[var(--text-tertiary)]"> · </span>
                <span className="text-[var(--text-secondary)]">{task.status.replace("_", " ")}</span>
                {task.due_date && (
                  <>
                    <span className="text-[var(--text-tertiary)]"> · </span>
                    <span className="text-[var(--text-secondary)]">
                      Due {formatBusinessDateAtNoon(task.due_date)}
                    </span>
                  </>
                )}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
