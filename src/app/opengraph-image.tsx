import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export const alt = "Oblixa — Contract execution for post-signature teams";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg, #0f172a 0%, #161f35 48%, #1d2b52 100%)",
          padding: 48,
          color: "#f8fafc",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at top right, rgba(129, 140, 248, 0.32), transparent 34%), radial-gradient(circle at bottom left, rgba(56, 189, 248, 0.22), transparent 30%)",
          }}
        />
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            borderRadius: 36,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
            boxShadow: "0 24px 80px rgba(15, 23, 42, 0.28)",
            padding: "44px 48px",
          }}
        >
          <div
            style={{
              display: "flex",
              width: "100%",
              justifyContent: "space-between",
              gap: 32,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                maxWidth: 780,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                }}
              >
                <div
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: 24,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "linear-gradient(180deg, #eef2ff 0%, #c7d2fe 100%)",
                    color: "#1e293b",
                    fontSize: 46,
                    fontWeight: 700,
                  }}
                >
                  O
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      width: "fit-content",
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "rgba(255,255,255,0.08)",
                      padding: "8px 14px",
                      fontSize: 18,
                      fontWeight: 600,
                      letterSpacing: 0.2,
                    }}
                  >
                    Post-signature operations
                  </div>
                  <div
                    style={{
                      fontSize: 64,
                      fontWeight: 700,
                      letterSpacing: -1.4,
                    }}
                  >
                    Oblixa
                  </div>
                </div>
              </div>
              <div
                style={{
                  marginTop: 34,
                  fontSize: 34,
                  fontWeight: 500,
                  lineHeight: 1.25,
                  color: "rgba(241, 245, 249, 0.9)",
                }}
              >
                Contract execution for post-signature teams
              </div>
              <div
                style={{
                  marginTop: 18,
                  fontSize: 24,
                  lineHeight: 1.4,
                  color: "rgba(191, 219, 254, 0.86)",
                }}
              >
                Turn signed agreements into tracked work, deadlines, approvals, obligations, and audit-ready evidence.
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                alignItems: "flex-end",
                minWidth: 220,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  width: "100%",
                }}
              >
                {["Operational deadlines", "Review queues", "Evidence-ready history"].map((label) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      borderRadius: 20,
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "rgba(255,255,255,0.06)",
                      padding: "12px 14px",
                      fontSize: 18,
                    }}
                  >
                    <span>{label}</span>
                    <span style={{ color: "#93c5fd" }}>•</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
