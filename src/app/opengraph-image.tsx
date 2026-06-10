import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export const alt = "Oblixa — Track renewals, requirements, and owners from signed contracts";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

/* v18 — warm editorial card matching the lp-* marketing system: ivory paper
   canvas, ink type, thin warm rules, a renewal-ledger artifact strip. The
   prior navy gradient + glassmorphism card was the banned cool-blue system in
   raster form.

   Typeface note: `next/og` cannot consume `next/font`, and bundling raw serif
   font data is deliberately deferred — the card uses the built-in sans with
   ink weight/tracking doing the editorial work. Revisit if a TTF is added to
   the repo. */

const INK = "#2c2820";
const INK_SOFT = "#5c564a";
const INK_FAINT = "#8a8270";
const RULE = "#ddd5c2";
const PAPER = "#f7f4ea";
const CARD = "#fdfcf7";
const ROW = "#fffefa";

const LEDGER_ROWS = [
  {
    name: "Meridian Logistics — MSA",
    chip: "Confirmed",
    chipBg: "#e7f0e3",
    chipInk: "#3e6647",
    date: "MAY 12",
  },
  {
    name: "Northwind Analytics — Order form",
    chip: "Needs confirmation",
    chipBg: "#f6eed7",
    chipInk: "#7a652e",
    date: "MAY 28",
  },
  {
    name: "Beacon Staffing — Master services",
    chip: "Notice window open",
    chipBg: "#f6eed7",
    chipInk: "#7a652e",
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
                  borderTop: i === 0 ? "none" : `1px solid #eee7d6`,
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
