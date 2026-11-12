import { ImageResponse } from "next/og";

export const alt = "BEVCAST AI: demand-forecasting studio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0b1220", color: "#e6edf7", padding: 64 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: "#2bb3c0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, color: "#0b1220", fontWeight: 700 }}>
            B
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: -1 }}>BEVCAST AI</div>
            <div style={{ fontSize: 26, color: "#9aa8bd" }}>AI in Operations · demand-forecasting studio</div>
          </div>
        </div>
        <div style={{ fontSize: 40, fontWeight: 600, maxWidth: 980 }}>Forecast better. Produce smarter. Distribute with confidence.</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#9aa8bd" }}>
          <span>Naïve vs ML · MAPE & WAPE · 3-month forecast · LLM copilot on live data</span>
          <span>Krishna Mathur · AS25DXB018</span>
        </div>
      </div>
    ),
    size,
  );
}
