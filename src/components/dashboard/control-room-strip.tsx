import type { ComponentType } from "react";
import {
  ClipboardList,
  Gauge,
  LineChart,
  Scale,
  Share2,
  ShieldAlert,
} from "lucide-react";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import type { ControlRoomCardId, ControlRoomLiveCard } from "@/lib/decision-intelligence/control-room-dashboard";
import { CONTROL_ROOM_STRIP_FALLBACK } from "@/lib/decision-intelligence/control-room-dashboard";

const ICONS: Record<
  ControlRoomCardId,
  ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>
> = {
  action_required: ClipboardList,
  decisions: Scale,
  propagation: Share2,
  approval_risk: ShieldAlert,
  capacity: Gauge,
  change_review: LineChart,
};

/**
 * Portfolio-backed operational summary strip. Uses grounded counts when
 * `liveCards` is provided; otherwise shows zeroed fallback with the same layout.
 */
export function V5ControlRoomStrip(props: { liveCards?: ControlRoomLiveCard[] }) {
  const items =
    props.liveCards?.length === CONTROL_ROOM_STRIP_FALLBACK.length
      ? props.liveCards
      : CONTROL_ROOM_STRIP_FALLBACK;

  return (
    <section className="space-y-3">
      <div>
        <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
          <span className="landing-eyebrow-dot" aria-hidden />
          Monitor
        </p>
        <h2 className="ui-section-title mt-2 text-xl">Critical signals</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((card) => (
          <OperationalSummaryCard
            key={card.id}
            eyebrow={card.eyebrow}
            headline={card.headline}
            tone={card.tone}
            icon={ICONS[card.id]}
            primaryValue={card.primaryValue}
            primaryFallback={card.primaryFallback}
            primaryUnit={card.primaryUnit}
            secondaryLine={card.secondaryLine}
            breakdown={card.breakdown}
            action={{ href: card.href, label: card.actionLabel }}
          />
        ))}
      </div>
    </section>
  );
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { V5ControlRoomStrip as ControlRoomStrip };
// End version-name compatibility aliases.
