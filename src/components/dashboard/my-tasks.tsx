import Link from "next/link";
import { format } from "date-fns";
import type { ContractTask } from "@/lib/types";

type TaskRow = Pick<ContractTask, "id" | "title" | "status" | "priority" | "due_date"> & {
  contracts: { id: string; title: string };
};

function priorityTone(priority: ContractTask["priority"]) {
  if (priority === "high") return "text-rose-700";
  if (priority === "low") return "text-zinc-500";
  return "text-amber-700";
}

export function MyTasks({ tasks }: { tasks: TaskRow[] }) {
  if (tasks.length === 0) {
    return (
      <section className="ui-card flex min-h-[200px] flex-col justify-center px-6 py-8 text-center md:min-h-[220px] md:px-8 md:py-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
          Your queue
        </p>
        <h2 className="mt-2 ui-section-title text-base">No open tasks</h2>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-zinc-500 md:text-sm">
          Tasks assigned to you will appear here with due dates and contract context.
        </p>
      </section>
    );
  }

  return (
    <section className="ui-card overflow-hidden">
      <div className="border-b border-zinc-100/90 bg-zinc-50/30 px-4 py-3.5 md:px-6 md:py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="ui-section-title">My open tasks</h2>
            <p className="mt-1 text-[11px] text-zinc-500 md:text-[12px]">
              Assigned work that still needs action
            </p>
          </div>
          <Link href="/contracts/tasks" className="ui-link text-[12px] md:text-[13px]">
            Full queue
          </Link>
        </div>
      </div>
      <ul className="divide-y divide-zinc-100">
        {tasks.map((task) => (
          <li key={task.id}>
            <Link
              href={`/contracts/${task.contracts.id}`}
              className="block px-4 py-3.5 transition-colors hover:bg-zinc-50/70 md:px-6 md:py-4"
            >
              <p className="text-[14px] font-semibold text-zinc-900 md:text-[15px]">{task.title}</p>
              <p className="mt-0.5 text-[13px] text-zinc-500">{task.contracts.title}</p>
              <p className="mt-1 text-[12px]">
                <span className={`font-semibold ${priorityTone(task.priority)}`}>
                  {task.priority}
                </span>
                <span className="text-zinc-300"> · </span>
                <span className="text-zinc-500">{task.status.replace("_", " ")}</span>
                {task.due_date && (
                  <>
                    <span className="text-zinc-300"> · </span>
                    <span className="text-zinc-500">
                      Due {format(new Date(`${task.due_date}T12:00:00`), "MMM d, yyyy")}
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
