import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export const alt = "Oblixa — Track renewals, requirements, and owners from signed contracts";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

/* Editorial card on the established palette. The revised design contract is
   palette-agnostic; earlier warm hexes were swapped for the app's
   cool-neutral token equivalents: neutral canvas, ink type, thin rules, a
   renewal-ledger artifact strip. The original navy gradient + glassmorphism
   card remains the banned generic system in raster form — don't restore it.

   Typeface note: `next/og` cannot consume `next/font`, and bundling raw serif
   font data is deliberately deferred — the card uses the built-in sans with
   ink weight/tracking doing the editorial work. Revisit if a TTF is added to
   the repo. */

const INK = "#262b33";
const INK_SOFT = "#5d6470";
const INK_FAINT = "#626970";
const RULE = "#dde0e5";
const PAPER = "#f4f6f9";
const CARD = "#fcfdfe";
const ROW = "#ffffff";

const LEDGER_ROWS = [
  {
    name: "Meridian Logistics — MSA",
    chip: "Confirmed",
    chipBg: "#e2f1e6",
    chipInk: "#2e6a45",
    date: "MAY 12",
  },
  {
    name: "Northwind Analytics — Order form",
    chip: "Needs confirmation",
    chipBg: "#f7efd5",
    chipInk: "#7a611f",
    date: "MAY 28",
  },
  {
    name: "Beacon Staffing — Master services",
    chip: "Notice window open",
    chipBg: "#f7efd5",
    chipInk: "#7a611f",
    date: "JUN 14",
  },
] as const;

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          background: PAPER,
          padding: 40,
          color: INK,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            borderRadius: 24,
            border: `1px solid ${RULE}`,
            background: CARD,
            padding: "44px 52px",
          }}
        >
          {/* Brand row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: INK,
                  color: PAPER,
                  fontSize: 34,
                  fontWeight: 700,
                }}
              >
                O
              </div>
              <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: -0.8 }}>
                Oblixa
              </div>
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: 3,
                color: INK_FAINT,
              }}
            >
              CONTRACT TRACKING
            </div>
          </div>

          {/* Headline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                display: "flex",
                fontSize: 58,
                fontWeight: 600,
                letterSpacing: -1.6,
                lineHeight: 1.08,
                maxWidth: 860,
              }}
            >
              Track what signed contracts require next.
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 23,
                lineHeight: 1.4,
                color: INK_SOFT,
                maxWidth: 880,
              }}
            >
              Confirm suggested contract details, assign owners, and turn renewals, requirements,
              and evidence into accountable tasks and reports.
            </div>
          </div>

          {/* Renewal ledger artifact strip */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              borderRadius: 14,
              border: `1px solid ${RULE}`,
              background: ROW,
              overflow: "hidden",
            }}
          >
            {LEDGER_ROWS.map((row, i) => (
              <div
                key={row.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "13px 22px",
                  borderTop: i === 0 ? "none" : `1px solid #e9ecf0`,
                }}
              >
                <div style={{ display: "flex", fontSize: 19, fontWeight: 600, color: INK }}>
                  {row.name}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                  <div
                    style={{
                      display: "flex",
                      borderRadius: 7,
                      background: row.chipBg,
                      color: row.chipInk,
                      fontSize: 14,
                      fontWeight: 600,
                      padding: "5px 11px",
                    }}
                  >
                    {row.chip}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontSize: 16,
                      fontWeight: 600,
                      letterSpacing: 1.4,
                      color: INK_FAINT,
                    }}
                  >
                    {row.date}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
