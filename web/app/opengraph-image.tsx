import { ImageResponse } from "next/og";

export const alt = "PilotKit: AI insurance assistant, tested before launch";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Social share card (also used for Twitter/X via summary_large_image). Mirrors the always-dark landing hero.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72,
        background: "radial-gradient(circle at 18% 12%, #2a2466 0%, #050507 55%)", color: "#f4f6fc", fontFamily: "sans-serif",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 32, background: "#635bff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12h4l3-7 3 14 3-7h3" />
            </svg>
          </div>
          <div style={{ fontSize: 36, fontWeight: 600 }}>PilotKit</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 76, fontWeight: 600, lineHeight: 1.02, letterSpacing: -2, display: "flex", flexDirection: "column" }}>
            <span>AI insurance assistant,</span>
            <span style={{ color: "#8e88ff" }}>tested before launch.</span>
          </div>
          <div style={{ fontSize: 30, color: "rgba(244,246,252,0.72)", maxWidth: 960 }}>
            Check policies, file claims and compare 40 plans. Every answer stress-tested by simulated customers.
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 24, color: "rgba(244,246,252,0.8)" }}>
          {["Customers & shoppers", "Voice or text", "Decisions by Jev"].map((t) => (
            <div key={t} style={{ padding: "10px 22px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.05)" }}>{t}</div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
