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
          background: "linear-gradient(180deg, #faf7ef 0%, #ece4d2 100%)",
          color: "#2c2820",
          fontSize: 18,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
          borderRadius: 10,
          border: "1px solid rgba(70, 58, 35, 0.18)",
        }}
      >
        O
      </div>
    ),
    { ...size }
  );
}
