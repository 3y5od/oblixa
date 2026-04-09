import Link from "next/link";
import type { ControlRoomLiveCard } from "@/lib/v5/control-room-dashboard";

const CONTROL_QUESTIONS = [
  {
    title: "What needs action now?",
    description: "Check active tasks and upcoming deadlines for immediate action.",
    href: "/work",
  },
  {
    title: "What needs a decision now?",
    description: "Review open decision workspaces and priority queue items.",
    href: "/decisions",
  },
  {
    title: "What is spreading?",
    description: "See campaign spread and cross-contract risk propagation.",
    href: "/campaigns",
  },
  {
    title: "What may break soon?",
    description: "Open portfolio signals for near-term SLA and exception pressure.",
    href: "/reports#portfolio-signals",
  },
  {
    title: "Where is capacity thin?",
    description: "Inspect forecast snapshots for overload and bottlenecks.",
    href: "/reports",
  },
  {
    title: "What changed since last review?",
    description: "Use relationship timelines and campaign events to assess drift.",
    href: "/campaigns",
  },
];

/**
 * When `liveCards` is set (requires ENABLE_V5_SIMULATION_AND_INTELLIGENCE on the server),
 * each card shows grounded counts. Otherwise shows link-only prompts (control-room UX
 * without intelligence flag).
 */
export function V5ControlRoomStrip(props: { liveCards?: ControlRoomLiveCard[] }) {
  const items = props.liveCards?.length
    ? props.liveCards.map((c) => ({
        title: c.title,
        description: c.description,
        href: c.href,
        metricLabel: c.metricLabel,
      }))
    : CONTROL_QUESTIONS.map((c) => ({
        title: c.title,
        description: c.description,
        href: c.href,
        metricLabel: undefined as string | undefined,
      }));

  return (
    <section className="space-y-3">
      <div>
        <p className="ui-eyebrow">Control room</p>
        <h2 className="ui-section-title mt-2 text-xl">Portfolio control questions</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <article key={item.title} className="ui-card p-4">
            <p className="text-sm font-semibold text-zinc-900">{item.title}</p>
            {item.metricLabel ? (
              <p className="mt-2 text-lg font-semibold tabular-nums text-zinc-800">{item.metricLabel}</p>
            ) : null}
            <p className={`text-xs leading-relaxed text-zinc-600 ${item.metricLabel ? "mt-1" : "mt-2"}`}>
              {item.description}
            </p>
            <Link href={item.href} className="ui-link mt-3 inline-block text-xs">
              Open
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

