"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

/**
 * DotField — an infinite dot lattice on a <canvas>, with a signature
 * RIPPLE: call `ripple(x, y)` and a wavefront expands from that point,
 * each dot swelling + brightening as the front passes, then settling.
 *
 * This is the app's motion through-line. The landing page is the field;
 * submitting an idea sends the wave outward. The same gesture can be
 * reused anywhere the grid should "respond".
 *
 * Calm by default (a single static draw, no idle animation) so the
 * surface stays quiet and legible until something happens. Honours
 * prefers-reduced-motion (ripple becomes a no-op).
 */

export interface DotFieldHandle {
  /** Emit a wave from a viewport coordinate. */
  ripple: (x: number, y: number) => void;
}

const SPACING = 28;      // lattice pitch (px)
const DOT_R = 1.15;      // base dot radius (px)
const BASE_ALPHA = 0.13; // resting dot opacity
const WAVE_SPEED = 0.95; // wavefront px per ms
const WAVE_WIDTH = 110;  // band thickness the wave influences (px)
const WAVE_AMP = 2.4;    // peak added scale at the wavefront
const WAVE_ALPHA = 0.55; // peak added opacity at the wavefront

export const DotField = forwardRef<DotFieldHandle, { color?: string; className?: string }>(
  function DotField({ color = "17,17,17", className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const triggerRef = useRef<(x: number, y: number) => void>(() => {});

    useImperativeHandle(ref, () => ({ ripple: (x, y) => triggerRef.current(x, y) }), []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      let w = 0;
      let h = 0;
      let raf: number | null = null;
      let wave: { x: number; y: number; start: number } | null = null;

      function drawStatic() {
        if (!ctx) return;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = `rgba(${color},${BASE_ALPHA})`;
        for (let y = SPACING / 2; y < h; y += SPACING) {
          for (let x = SPACING / 2; x < w; x += SPACING) {
            ctx.beginPath();
            ctx.arc(x, y, DOT_R, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      function frame(now: number) {
        if (!ctx || !wave) { raf = null; return; }
        const t = now - wave.start;
        const radius = t * WAVE_SPEED;
        const maxDist = Math.hypot(
          Math.max(wave.x, w - wave.x),
          Math.max(wave.y, h - wave.y),
        );
        ctx.clearRect(0, 0, w, h);
        for (let y = SPACING / 2; y < h; y += SPACING) {
          for (let x = SPACING / 2; x < w; x += SPACING) {
            const d = Math.hypot(x - wave.x, y - wave.y);
            const off = Math.abs(d - radius);
            // Smooth cosine falloff across the band; ahead of the front
            // gets nothing.
            const infl = off < WAVE_WIDTH ? Math.cos((off / WAVE_WIDTH) * (Math.PI / 2)) : 0;
            const scale = 1 + infl * WAVE_AMP;
            const alpha = BASE_ALPHA + infl * WAVE_ALPHA;
            ctx.fillStyle = `rgba(${color},${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, DOT_R * scale, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        if (radius > maxDist + WAVE_WIDTH) {
          wave = null;
          drawStatic();
          raf = null;
          return;
        }
        raf = requestAnimationFrame(frame);
      }

      function resize() {
        if (!ctx) return;
        w = canvas!.clientWidth;
        h = canvas!.clientHeight;
        canvas!.width = Math.floor(w * dpr);
        canvas!.height = Math.floor(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawStatic();
      }

      triggerRef.current = (x: number, y: number) => {
        if (reduced) return;
        wave = { x, y, start: performance.now() };
        if (raf == null) raf = requestAnimationFrame(frame);
      };

      resize();
      window.addEventListener("resize", resize);
      return () => {
        window.removeEventListener("resize", resize);
        if (raf != null) cancelAnimationFrame(raf);
      };
    }, [color]);

    return (
      <canvas
        ref={canvasRef}
        className={className}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    );
  },
);
