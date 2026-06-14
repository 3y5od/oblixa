import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** App icon — favicon + metadata; keep in sync with apple-icon branding. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #eef2ff 0%, #c7d2fe 100%)",
          color: "#172033",
          fontSize: 18,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
          borderRadius: 10,
          border: "1px solid rgba(15, 23, 42, 0.08)",
        }}
      >
        O
      </div>
    ),
    { ...size }
  );
}
