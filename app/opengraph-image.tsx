import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "MAGYC — vom Prompt zum Vertrag";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Default site share preview (marketing/landing pages). A per-space image
 * lives at /s/[id]/opengraph-image for shared project links.
 */
export default function OpengraphImage() {
  const accent = "#c0396e";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f4f4f1",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 26, height: 26, borderRadius: 999, background: accent }} />
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 2, color: "#0d0d0d" }}>MAGYC</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 30, color: accent, fontWeight: 700, marginBottom: 18 }}>
            Das Projekt-Werkzeug für Fotograf:innen
          </div>
          <div style={{ fontSize: 82, fontWeight: 800, color: "#0d0d0d", lineHeight: 1.02 }}>
            Von der Kundenanfrage<br />zum Vertrag.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 26, color: "#4a4a48" }}>
            Planen · abstimmen · unterschreiben — an einem Ort
          </div>
          <div style={{ fontSize: 26, color: "#6a6a66", fontWeight: 600 }}>magyc.site</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
