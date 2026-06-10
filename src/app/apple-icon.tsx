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
          background: "linear-gradient(180deg, #faf7ef 0%, #ece4d2 100%)",
          color: "#2c2820",
          fontSize: 112,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
          borderRadius: 48,
          border: "6px solid rgba(70, 58, 35, 0.10)",
        }}
      >
        O
      </div>
    ),
    { ...size }
  );
}
