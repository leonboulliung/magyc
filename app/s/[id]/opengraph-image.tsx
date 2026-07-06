import { ImageResponse } from "next/og";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

// Node runtime: supabaseAdmin is server-only and uses the service-role client.
export const runtime = "nodejs";
export const alt = "MAGYC — Fotografie-Projekt";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Per-space share preview. Privacy-aware: the real title is only shown for a
 * SHARED or published space (the ones actually posted/sent); private drafts
 * fall back to generic brand copy so nothing leaks through a link crawler.
 */
export default async function OpengraphImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let title = "Ein Fotografie-Projekt";
  let accent = "#c0396e";
  try {
    const { data } = await supabaseAdmin()
      .from("spaces")
      .select("title, style, shared, visibility")
      .eq("id", id)
      .maybeSingle();
    const isPublic = !!data && (data.shared === true || (data.visibility != null && data.visibility !== ""));
    if (isPublic && typeof data?.title === "string" && data.title.trim()) {
      title = data.title.trim().slice(0, 90);
    }
    const c2 = (data?.style as { color2?: unknown } | null)?.color2;
    if (typeof c2 === "string" && /^#[0-9a-fA-F]{6}$/.test(c2)) accent = c2;
  } catch {
    // fall back to generic brand copy
  }

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
        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 26, height: 26, borderRadius: 999, background: accent }} />
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 2, color: "#0d0d0d" }}>MAGYC</div>
        </div>

        {/* Title */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 30, color: accent, fontWeight: 700, marginBottom: 18 }}>
            Fotografie-Projekt
          </div>
          <div style={{ fontSize: 76, fontWeight: 800, color: "#0d0d0d", lineHeight: 1.05, maxWidth: 1000 }}>
            {title}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 26, color: "#4a4a48" }}>
            Gemeinsam planen · abstimmen · unterschreiben
          </div>
          <div style={{ fontSize: 26, color: "#6a6a66", fontWeight: 600 }}>magyc.site</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
