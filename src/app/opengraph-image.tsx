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
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafaf9",
          padding: 48,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            maxWidth: 900,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: "#18181b",
              letterSpacing: -1,
            }}
          >
            Oblixa
          </div>
          <div
            style={{
              marginTop: 20,
              fontSize: 30,
              fontWeight: 500,
              color: "#52525b",
              lineHeight: 1.35,
            }}
          >
            Contract execution for post-signature teams
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
