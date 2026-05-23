import { CalendarRange } from "lucide-react";
import { getDashboardAdminClientCached, getDashboardDateFieldsCached } from "@/lib/dashboard-data";
import { HorizonTimeline, type HorizonMarker } from "@/components/ui/horizon-timeline";
import { differenceInDays, isValid } from "date-fns";

interface RenewalsHorizonProps {
  orgId: string;
}

type DateFieldRow = {
  id: string;
  field_name: string;
  field_value: string | null;
  contracts: { id: string; title: string; organization_id: string };
};

const RELEVANT_FIELDS = new Set([
  "renewal_date",
  "end_date",
  "notice_window_starts",
  "notice_window_ends",
  "expiration_date",
]);

const HORIZON_DAYS = 90;

function fieldLabel(name: string): string {
  if (name === "renewal_date") return "Renewal";
  if (name === "end_date") return "End";
  if (name === "expiration_date") return "Expires";
  if (name === "notice_window_starts") return "Notice opens";
  if (name === "notice_window_ends") return "Notice closes";
  return name.replace(/_/g, " ");
}

export async function RenewalsHorizon({ orgId }: RenewalsHorizonProps) {
  const dateFields = (await getDashboardDateFieldsCached(orgId)) as unknown as DateFieldRow[];
  const today = new Date();

  const markers: HorizonMarker[] = dateFields
    .filter((f) => f.field_value && RELEVANT_FIELDS.has(f.field_name))
    .flatMap<HorizonMarker>((f) => {
      const date = new Date(f.field_value as string);
      if (!isValid(date)) return [];
      const days = differenceInDays(date, today);
      if (days < 0 || days > HORIZON_DAYS) return [];
      const tone: "danger" | "warning" | "neutral" =
        days <= 14 ? "danger" : days <= 30 ? "warning" : "neutral";
      return [
        {
          date,
          label: `${fieldLabel(f.field_name)} · ${f.contracts.title}`,
          tone,
          href: `/contracts/${f.contracts.id}`,
        },
      ];
    });

  if (markers.length === 0) return null;

  // Renewal value summary — sum of value across affected contracts (if available).
  const admin = await getDashboardAdminClientCached();
  const contractIds = Array.from(new Set(markers.map((m) => m.href!.replace("/contracts/", ""))));
  let totalValue = 0;
  let valueContractCount = 0;
  if (contractIds.length > 0) {
    const { data: contracts } = await admin
      .from("contracts")
      .select("id, annual_value")
      .in("id", contractIds);
    for (const c of (contracts ?? []) as Array<{ id: string; annual_value: number | null }>) {
      if (typeof c.annual_value === "number" && Number.isFinite(c.annual_value)) {
        totalValue += c.annual_value;
        valueContractCount += 1;
      }
    }
  }

  const formattedValue =
    totalValue > 0
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
          notation: totalValue >= 1_000_000 ? "compact" : "standard",
        }).format(totalValue)
      : null;

  return (
    <section className="space-y-3" aria-label="Renewals horizon">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-[1.375rem] font-semibold tracking-tight text-[var(--text-primary)]">
          <CalendarRange className="h-4 w-4 text-[var(--accent-strong)]" strokeWidth={1.85} aria-hidden />
          Renewals horizon
        </h2>
        {formattedValue ? (
          <p className="text-[11.5px] text-[var(--text-tertiary)]">
            <span className="tabular-nums font-semibold text-[var(--text-secondary)]">
              {formattedValue}
            </span>{" "}
            renewing · {valueContractCount} contract{valueContractCount === 1 ? "" : "s"} with value
          </p>
        ) : null}
      </div>
      <div className="rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)] p-4">
        <HorizonTimeline markers={markers} horizonDays={HORIZON_DAYS} />
      </div>
    </section>
  );
}
