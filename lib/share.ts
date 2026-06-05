"use client";

import type { Card } from "./types";
import { PARIS_BOUNDS, PARIS_CENTER } from "./quartiers";
import { cardColor, isDark } from "./color";

const W = 1080;
const H = 1350;

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawColorHero(ctx: CanvasRenderingContext2D, card: Card, height: number) {
  ctx.fillStyle = cardColor(card);
  ctx.fillRect(0, 0, W, height);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (ctx.measureText(t).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = t;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawMiniMap(
  ctx: CanvasRenderingContext2D,
  card: Card,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  // background
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#0a0a0a";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

  // grid lines (very faint)
  ctx.strokeStyle = "#e5e5e5";
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(x + (w * i) / 6, y);
    ctx.lineTo(x + (w * i) / 6, y + h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + (h * i) / 6);
    ctx.lineTo(x + w, y + (h * i) / 6);
    ctx.stroke();
  }

  // stylized Seine curve
  ctx.strokeStyle = "#0a0a0a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.62);
  ctx.bezierCurveTo(
    x + w * 0.25, y + h * 0.5,
    x + w * 0.55, y + h * 0.72,
    x + w, y + h * 0.58,
  );
  ctx.stroke();

  // map pin position from lat/lng within bounds
  const [[minLat, minLng], [maxLat, maxLng]] = PARIS_BOUNDS;
  // Ideas may have no location — fall back to the Paris center for the pin.
  const locLat = card.location?.lat ?? PARIS_CENTER[0];
  const locLng = card.location?.lng ?? PARIS_CENTER[1];
  const nx = (locLng - minLng) / (maxLng - minLng);
  const ny = 1 - (locLat - minLat) / (maxLat - minLat);
  const px = x + 6 + Math.max(0, Math.min(1, nx)) * (w - 12);
  const py = y + 6 + Math.max(0, Math.min(1, ny)) * (h - 12);

  // pulse ring
  ctx.fillStyle = "rgba(10,10,10,0.15)";
  ctx.beginPath();
  ctx.arc(px, py, 18, 0, Math.PI * 2);
  ctx.fill();

  // pin
  ctx.fillStyle = "#0a0a0a";
  ctx.beginPath();
  ctx.arc(px, py, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  avatar: HTMLImageElement | null,
  x: number,
  y: number,
  size: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.clip();
  if (avatar) {
    ctx.drawImage(avatar, x, y, size, size);
  } else {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
  // ring
  ctx.strokeStyle = "#0a0a0a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.stroke();
}

export async function renderShareImage(card: Card, avatarDataUrl?: string): Promise<Blob> {
  // ensure web fonts are available so canvas measures the right widths
  try {
    const d = document as Document & { fonts?: FontFaceSet };
    if (d.fonts) await d.fonts.ready;
  } catch { /* noop */ }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");

  // background base
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(0, 0, W, H);

  // vibe hero (top ~58%)
  const heroH = Math.round(H * 0.58);
  drawColorHero(ctx, card, heroH);
  const heroDark = isDark(cardColor(card));

  // top wordmark
  ctx.fillStyle = heroDark ? "rgba(255,255,255,0.92)" : "rgba(10,10,10,0.92)";
  ctx.font = "700 22px 'JetBrains Mono', monospace";
  ctx.textBaseline = "top";
  ctx.fillText("CREATOR", 48, 48);

  // activity tag top-right — request vs join, depending on permission.
  ctx.font = "700 22px 'JetBrains Mono', monospace";
  const tag = card.permission === "request" ? "REQUEST" : "JOIN";
  ctx.textAlign = "right";
  ctx.fillText(tag, W - 48, 48);
  ctx.textAlign = "left";

  // bottom area on hero — avatar + title
  const avatar = avatarDataUrl ? await loadImage(avatarDataUrl).catch(() => null) : null;
  const avSize = 88;
  const avX = 48;
  const avY = heroH - avSize - 36;
  drawAvatar(ctx, avatar, avX, avY, avSize);

  ctx.fillStyle = heroDark ? "#fafafa" : "#0a0a0a";
  ctx.font = "500 22px 'JetBrains Mono', monospace";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`@${card.owner.displayName}`, avX + avSize + 22, avY + avSize / 2 + 8);

  // bottom panel: title + meta + minimap
  const panelY = heroH;
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(0, panelY, W, H - panelY);

  // hairline
  ctx.strokeStyle = "#0a0a0a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(48, panelY);
  ctx.lineTo(W - 48, panelY);
  ctx.stroke();

  // title — massive black
  ctx.fillStyle = "#0a0a0a";
  let size = 96;
  ctx.font = `900 ${size}px Inter, system-ui, sans-serif`;
  let lines = wrapText(ctx, card.title, W - 96);
  while (lines.length > 3 && size > 56) {
    size -= 6;
    ctx.font = `900 ${size}px Inter, system-ui, sans-serif`;
    lines = wrapText(ctx, card.title, W - 96);
  }
  let ty = panelY + 38 + size * 0.85;
  for (const ln of lines.slice(0, 3)) {
    ctx.fillText(ln, 48, ty);
    ty += size * 0.95;
  }

  // meta
  ctx.font = "500 22px 'JetBrains Mono', monospace";
  ctx.fillStyle = "#0a0a0a";
  const meta1 = (card.location?.label || "OPEN").toUpperCase();
  const startStr = card.startsAt
    ? new Date(card.startsAt)
        .toLocaleString("en-GB", {
          weekday: "short",
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
        .toUpperCase()
    : "";
  const joinedCount = card.members.filter((m) => m.state === "joined").length;
  const meta2 = startStr
    ? `STARTS ${startStr}  ·  ${joinedCount}/${card.spots ?? "—"} PEOPLE`
    : `${joinedCount}/${card.spots ?? "—"} PEOPLE  ·  OPEN UNTIL IT HAPPENS`;
  ctx.fillText(meta1, 48, ty + 24);
  ctx.fillText(meta2, 48, ty + 56);

  // mini-map bottom-left
  const mmSize = 240;
  const mmX = 48;
  const mmY = H - mmSize - 88;
  // shift up if it overlaps meta
  const safeMmY = Math.max(ty + 96, mmY);
  drawMiniMap(ctx, card, mmX, safeMmY, mmSize, mmSize);

  // wordmark bottom-right
  ctx.font = "900 36px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#0a0a0a";
  ctx.textAlign = "right";
  ctx.fillText("CREATOR", W - 48, H - 32);
  ctx.textAlign = "left";

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png",
      0.95,
    );
  });
}

/**
 * Result of sharing a card:
 *   - "shared":   the native share sheet handled it (mobile / web-share API)
 *   - "copied":   copied the URL to clipboard (desktop / no share API)
 *   - "downloaded": fallback, the PNG was saved (no share + no clipboard)
 */
export type ShareResult = "shared" | "copied" | "downloaded";

function cardUrl(card: Card): string {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://creator-paris.vercel.app";
  return `${origin}/post/${card.id}`;
}

function shareText(card: Card): string {
  return card.location?.label ? `${card.title} — ${card.location.label}` : card.title;
}

/**
 * Primary share action: pass the URL (and a short text) to the native
 * share sheet on mobile, or copy the URL to the clipboard on desktop.
 * No PNG generation involved — that's a separate explicit "Save poster"
 * action via `downloadCardPoster()`.
 */
export async function shareCard(card: Card): Promise<ShareResult> {
  const url = cardUrl(card);
  const text = shareText(card);

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: card.title, text, url });
      return "shared";
    } catch {
      // user cancelled or unavailable — fall through to clipboard
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return "copied";
    } catch {
      // fall through
    }
  }

  // Last-resort fallback: download the PNG poster so the user has something.
  await downloadCardPoster(card);
  return "downloaded";
}

/** Explicit "save poster" action — generates and downloads the PNG. */
export async function downloadCardPoster(card: Card, avatarDataUrl?: string): Promise<void> {
  const blob = await renderShareImage(card, avatarDataUrl);
  const filename = `creator-paris-${card.id}.png`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ============================================================
// Tile-fetching helpers — real CARTO Positron no-labels tiles
// stitched onto the poster as the actual Paris map background.
// ============================================================

const TILE_SIZE = 256;
const SUBS = ["a", "b", "c", "d"] as const;

function lng2tileX(lng: number, z: number) {
  return ((lng + 180) / 360) * Math.pow(2, z);
}
function lat2tileY(lat: number, z: number) {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z);
}

/** Stitch a CARTO no-labels tile mosaic that exactly covers the given bbox. */
async function fetchParisTiles(
  zoom: number,
  bounds: [[number, number], [number, number]],
): Promise<HTMLCanvasElement> {
  const [[minLat, minLng], [maxLat, maxLng]] = bounds;
  const xMinF = lng2tileX(minLng, zoom);
  const xMaxF = lng2tileX(maxLng, zoom);
  const yMinF = lat2tileY(maxLat, zoom); // y increases southward
  const yMaxF = lat2tileY(minLat, zoom);

  const xT0 = Math.floor(xMinF);
  const xT1 = Math.ceil(xMaxF);
  const yT0 = Math.floor(yMinF);
  const yT1 = Math.ceil(yMaxF);

  const cols = xT1 - xT0;
  const rows = yT1 - yT0;

  const full = document.createElement("canvas");
  full.width = cols * TILE_SIZE;
  full.height = rows * TILE_SIZE;
  const fctx = full.getContext("2d");
  if (!fctx) throw new Error("No canvas context");
  // background fallback in case any tile fails to load
  fctx.fillStyle = "#fafafa";
  fctx.fillRect(0, 0, full.width, full.height);

  const tasks: Promise<void>[] = [];
  let i = 0;
  for (let x = xT0; x < xT1; x++) {
    for (let y = yT0; y < yT1; y++) {
      const sub = SUBS[i++ % SUBS.length];
      const url = `https://${sub}.basemaps.cartocdn.com/light_nolabels/${zoom}/${x}/${y}.png`;
      const dx = (x - xT0) * TILE_SIZE;
      const dy = (y - yT0) * TILE_SIZE;
      tasks.push(
        loadImage(url)
          .then((img) => {
            fctx.drawImage(img, dx, dy);
          })
          .catch(() => {
            /* tile failed — keep fallback paper */
          }),
      );
    }
  }
  await Promise.all(tasks);

  // Crop the stitched canvas down to the exact bbox area.
  const cropX = (xMinF - xT0) * TILE_SIZE;
  const cropY = (yMinF - yT0) * TILE_SIZE;
  const cropW = (xMaxF - xMinF) * TILE_SIZE;
  const cropH = (yMaxF - yMinF) * TILE_SIZE;
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(cropW));
  out.height = Math.max(1, Math.round(cropH));
  const octx = out.getContext("2d");
  if (!octx) return full;
  octx.drawImage(full, cropX, cropY, cropW, cropH, 0, 0, out.width, out.height);
  return out;
}

// Fan out pins that share a coordinate (e.g. several cards all pinned to the
// "Le Marais" quartier centre) into a small deterministic circle, so every pin
// stays visible on the poster instead of stacking into one. Mirrors the live
// Constellation de-collision. Longitude offset is scaled by 1/cos(lat) so the
// fan reads round at Paris latitude.
function fanCoincident<T extends { lat: number; lng: number }>(
  items: T[],
  latR = 0.0014, // ~155m default — matches the live Constellation's fan
                 // radius so the poster reads as the same layout.
): T[] {
  // Three-decimal key (~110m) groups cards pinned to the same quartier or
  // to nearby points within a block — same threshold as the live map.
  const groups = new Map<string, T[]>();
  const keyOf = (it: T) => `${it.lat.toFixed(3)},${it.lng.toFixed(3)}`;
  for (const it of items) {
    const k = keyOf(it);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(it);
  }
  return items.map((it) => {
    const group = groups.get(keyOf(it))!;
    if (group.length === 1) return it;
    const idx = group.indexOf(it);
    const angle = (2 * Math.PI * idx) / group.length - Math.PI / 2;
    const lngR = latR / Math.max(0.3, Math.cos((it.lat * Math.PI) / 180));
    return {
      ...it,
      lat: it.lat + latR * Math.sin(angle),
      lng: it.lng + lngR * Math.cos(angle),
    };
  });
}

// Bounds that frame the user's plotted pins, with a comfortable buffer
// so the poster reads like the live Constellation (zoomed onto the
// person's footprint, not the whole metro area).
function boundsForPoints(pts: { lat: number; lng: number }[]): [[number, number], [number, number]] {
  if (pts.length === 0) return PARIS_BOUNDS;
  if (pts.length === 1) {
    const off = 0.012; // ~1.3km square
    return [
      [pts[0].lat - off, pts[0].lng - off],
      [pts[0].lat + off, pts[0].lng + off],
    ];
  }
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of pts) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  const padLat = Math.max(0.004, (maxLat - minLat) * 0.18);
  const padLng = Math.max(0.004, (maxLng - minLng) * 0.18);
  return [
    [minLat - padLat, minLng - padLng],
    [maxLat + padLat, maxLng + padLng],
  ];
}

// Carnet poster: stitches together the user's whole pin constellation,
// on top of a real Paris map (CARTO Positron no-labels tiles).
export async function renderCarnetPoster(
  cards: {
    lat: number;
    lng: number;
    label: string;
    title: string;
    createdAt: number;
    color?: string | null;
    outerColor?: string | null;
  }[],
  email: string,
): Promise<Blob> {
  const PW = 1600;
  const PH = 2000;
  const canvas = document.createElement("canvas");
  canvas.width = PW;
  canvas.height = PH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");

  // ensure fonts are ready (canvas measures them right)
  try {
    const d = document as Document & { fonts?: FontFaceSet };
    if (d.fonts) await d.fonts.ready;
  } catch {
    /* noop */
  }

  // paper
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(0, 0, PW, PH);

  // header
  ctx.fillStyle = "#0a0a0a";
  ctx.font = "900 64px Inter, system-ui, sans-serif";
  ctx.fillText("CARNET", 96, 140);
  ctx.font = "500 22px 'JetBrains Mono', monospace";
  ctx.fillText(email.toUpperCase(), 96, 178);
  ctx.fillText(`${cards.length} CARDS  ·  PARIS  ·  ${new Date().getFullYear()}`, 96, 210);

  // map area dimensions
  const mx = 96;
  const my = 280;
  const mw = PW - 192;
  const mh = PH - 280 - 200;

  // Background frame
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(mx, my, mw, mh);

  // Frame the poster to the user's own pins (with a buffer) — same idea
  // as the live Constellation, so the printable view matches what's on
  // screen instead of zooming out to all of Paris.
  const posterBounds = boundsForPoints(cards);

  // Fetch & paint real CARTO tiles for the user's bbox.
  try {
    const tileCanvas = await fetchParisTiles(14, posterBounds);
    // draw with light desaturation by lowering alpha slightly to keep pins prominent
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.drawImage(tileCanvas, mx, my, mw, mh);
    ctx.restore();
  } catch {
    // Fallback: stylised grid + Seine curve if tile fetch fails entirely.
    ctx.strokeStyle = "#eaeaea";
    ctx.lineWidth = 1;
    for (let i = 1; i < 16; i++) {
      ctx.beginPath();
      ctx.moveTo(mx + (mw * i) / 16, my);
      ctx.lineTo(mx + (mw * i) / 16, my + mh);
      ctx.stroke();
    }
    for (let i = 1; i < 20; i++) {
      ctx.beginPath();
      ctx.moveTo(mx, my + (mh * i) / 20);
      ctx.lineTo(mx + mw, my + (mh * i) / 20);
      ctx.stroke();
    }
    ctx.strokeStyle = "#0a0a0a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mx, my + mh * 0.58);
    ctx.bezierCurveTo(
      mx + mw * 0.28, my + mh * 0.46,
      mx + mw * 0.58, my + mh * 0.7,
      mx + mw, my + mh * 0.52,
    );
    ctx.stroke();
  }

  // Hairline border around the map
  ctx.strokeStyle = "#0a0a0a";
  ctx.lineWidth = 2;
  ctx.strokeRect(mx + 1, my + 1, mw - 2, mh - 2);

  const [[minLat, minLng], [maxLat, maxLng]] = posterBounds;

  const projectPoint = (lat: number, lng: number) => {
    const nx = (lng - minLng) / (maxLng - minLng);
    const ny = 1 - (lat - minLat) / (maxLat - minLat);
    return {
      x: mx + Math.max(0, Math.min(1, nx)) * mw,
      y: my + Math.max(0, Math.min(1, ny)) * mh,
    };
  };

  // Same fan radius as the live Constellation, so coincident pins land
  // in the same relative positions across both surfaces.
  const ordered = fanCoincident(cards).sort((a, b) => a.createdAt - b.createdAt);

  // chronological dashed connector
  if (ordered.length > 1) {
    ctx.strokeStyle = "rgba(10,10,10,0.45)";
    ctx.lineWidth = 1.8;
    ctx.setLineDash([7, 7]);
    ctx.beginPath();
    ordered.forEach((c, i) => {
      const p = projectPoint(c.lat, c.lng);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // dots (two-ring matching the live map pins)
  ordered.forEach((c, i) => {
    const { x, y } = projectPoint(c.lat, c.lng);
    const inner = c.color || "#0a0a0a";
    const outer = c.outerColor || c.color || "#0a0a0a";

    // halo
    ctx.fillStyle = "rgba(10,10,10,0.10)";
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();

    // outer ring
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();

    // inner disc
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(x, y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // number
    ctx.fillStyle = "#0a0a0a";
    ctx.font = "700 14px 'JetBrains Mono', monospace";
    ctx.fillText(`${i + 1}`, x + 14, y - 10);
  });

  // footer
  ctx.fillStyle = "#0a0a0a";
  ctx.font = "900 36px Inter, system-ui, sans-serif";
  ctx.fillText("CREATOR — IDEAS BECOME REAL WITH OTHERS", 96, PH - 60);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png", 0.95);
  });
}

export async function downloadCarnetPoster(
  cards: {
    lat: number;
    lng: number;
    label: string;
    title: string;
    createdAt: number;
    color?: string | null;
    outerColor?: string | null;
  }[],
  email: string,
) {
  const blob = await renderCarnetPoster(cards, email);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `carnet-${email.replace(/[^a-z0-9]/gi, "_")}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

