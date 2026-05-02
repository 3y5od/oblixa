#!/usr/bin/env node
/**
 * Enforces config/qa-taxonomy-strictness-sla.json against the current waiver ratio
 * from config/qa-comprehensive-taxonomy.json + config/qa-external-waiver-registry.json.
 * Picks the latest milestone whose effective date is on or before today (UTC).
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

function parseEffective(isoDate) {
  const d = new Date(`${isoDate}T23:59:59.999Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function main() {
  const slaPath = path.join(root, "config", "qa-taxonomy-strictness-sla.json");
  const sla = readJson("config/qa-taxonomy-strictness-sla.json");
  const tax = readJson("config/qa-comprehensive-taxonomy.json");
  const waivers = readJson("config/qa-external-waiver-registry.json");
  const waiverIds = new Set((waivers.waivers || []).map((w) => w.id));
  const today = new Date();

  const milestones = Array.isArray(sla.milestones) ? sla.milestones : [];
  const applicable = milestones
    .map((m) => ({ m, eff: m.effective ? parseEffective(m.effective) : null }))
    .filter((x) => x.eff && x.eff <= today)
    .sort((a, b) => b.eff.getTime() - a.eff.getTime());

  const active = applicable[0]?.m;
  if (!active) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "no_milestone_effective_yet",
          today: today.toISOString(),
          slaPath: path.relative(root, slaPath),
        },
        null,
        2
      )
    );
    return;
  }

  const itemsWithWaiver = new Set();
  for (const it of tax.items || []) {
    for (const b of it.bindings || []) {
      if (b.kind === "waiver" && waiverIds.has(b.ref)) {
        itemsWithWaiver.add(it.id);
        break;
      }
    }
  }
  const n = tax.items?.length || 1;
  const ratio = itemsWithWaiver.size / n;

  if (active.disallowWaivers && itemsWithWaiver.size > 0) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          reason: "milestone_disallows_waivers",
          milestone: active.id,
          effective: active.effective,
          itemsWithWaiver: itemsWithWaiver.size,
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const cap =
    typeof active.maxWaiverRatio === "number" && Number.isFinite(active.maxWaiverRatio)
      ? active.maxWaiverRatio
      : null;
  if (cap != null && ratio > cap) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          reason: "waiver_ratio_exceeds_milestone_cap",
          milestone: active.id,
          effective: active.effective,
          maxWaiverRatio: cap,
          ratio,
          itemsWithWaiver: itemsWithWaiver.size,
          itemCount: n,
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        milestone: active.id,
        effective: active.effective,
        maxWaiverRatio: cap,
        disallowWaivers: !!active.disallowWaivers,
        ratio,
        itemsWithWaiver: itemsWithWaiver.size,
        itemCount: n,
      },
      null,
      2
    )
  );
}

main();
