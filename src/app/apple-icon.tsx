import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Apple touch icon — same mark as app/icon at marketing-safe resolution. */
export default function AppleIcon() {
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
          fontSize: 112,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
          borderRadius: 48,
          border: "6px solid rgba(15, 23, 42, 0.06)",
        }}
      >
        O
      </div>
    ),
    { ...size }
  );
}
