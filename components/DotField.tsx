"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

/**
 * DotField — an infinite dot lattice on a <canvas> that breathes.
 *
 * Instead of a single wavefront racing out from one point, the whole
 * field shimmers ambiently: a few slow, drifting sine layers interfere
 * into soft regions of brighter/larger dots that emerge, merge and
 * equalise — no centre, no origin. It is calm and continuous, like
 * weather over the grid.
 *
 * `ripple()` injects a brief surge of energy (the field momentarily
 * intensifies, then settles); `setThinking(true)` holds it at an
 * elevated, more active level for the duration of an async wait. Both
 * keep the no-origin character — they change how hard the field
 * breathes, not where from.
 *
 * Honours prefers-reduced-motion (renders one static frame, no loop)
 * and pauses while the tab is hidden.
 */

export interface DotFieldHandle {
  /** Inject a short surge of energy into the field. */
  ripple: (x?: number, y?: number) => void;
  /** Hold the field at an elevated, more active level while `on`. */
  setThinking: (on: boolean, x?: number, y?: number) => void;
}

const SPACING = 28;       // lattice pitch (px)
const DOT_R = 1.15;       // base dot radius (px)
const BASE_ALPHA = 0.10;  // resting dot opacity (trough of the breath)
const ALPHA_RANGE = 0.26; // added opacity at a field crest
const SCALE_RANGE = 0.9;  // added radius scale at a field crest

export const DotField = forwardRef<DotFieldHandle, { color?: string; className?: string }>(
  function DotField({ color = "17,17,17", className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rippleRef = useRef<(x?: number, y?: number) => void>(() => {});
    const thinkRef = useRef<(on: boolean, x?: number, y?: number) => void>(() => {});

    useImperativeHandle(ref, () => ({
      ripple: (x, y) => rippleRef.current(x, y),
      setThinking: (on, x, y) => thinkRef.current(on, x, y),
    }), []);

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

      // Energy drives how hard the field breathes (contrast + drift
      // speed). 1 = calm idle; thinking sustains it higher; a ripple is a
      // decaying spike on top. All eased so transitions feel organic.
      let energy = 1;
      let pulse = 0;
      let thinking = false;

      /**
       * Field value at a point: a few drifting directional sine layers,
       * summed and normalised to 0..1. Incommensurate frequencies so the
       * pattern never visibly repeats; no radial/centre term so there is
       * no single origin. `speed` scales the temporal drift with energy.
       */
      function fieldAt(x: number, y: number, t: number): number {
        const v =
          Math.sin(x * 0.0017 + t * 0.00022) +
          Math.sin(y * 0.0021 - t * 0.00018) +
          Math.sin((x * 0.0009 + y * 0.0013) + t * 0.00026) +
          Math.sin((x * 0.0014 - y * 0.0008) - t * 0.00020);
        return (v / 4) * 0.5 + 0.5; // -> 0..1
      }

      function drawField(t: number) {
        if (!ctx) return;
        // Contrast widens with energy so "thinking" reads as a livelier
        // field; alpha/scale stay clamped to sane ranges.
        const contrast = Math.min(1.9, 0.85 + (energy - 1) * 0.7);
        ctx.clearRect(0, 0, w, h);
        for (let y = SPACING / 2; y < h; y += SPACING) {
          for (let x = SPACING / 2; x < w; x += SPACING) {
            const f = fieldAt(x, y, t);
            const m = Math.max(0, Math.min(1, (f - 0.5) * contrast + 0.5));
            const alpha = BASE_ALPHA + m * ALPHA_RANGE;
            const scale = 1 + m * SCALE_RANGE;
            ctx.fillStyle = `rgba(${color},${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, DOT_R * scale, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Drift clock that runs faster while the field is energised, so the
      // regions move more urgently during a wait without ever resetting.
      let driftT = 0;
      let lastNow = performance.now();

      function frame(now: number) {
        if (!ctx) { raf = null; return; }
        const dt = Math.min(64, now - lastNow);
        lastNow = now;

        pulse *= 0.94; // decay the ripple surge
        const target = (thinking ? 2.0 : 1.0) + pulse;
        energy += (target - energy) * 0.05;

        driftT += dt * (0.6 + energy * 0.55);
        drawField(driftT);

        // Keep looping while anything is happening; idle still breathes,
        // so the loop only stops under reduced-motion.
        raf = requestAnimationFrame(frame);
      }

      function drawStaticOnce() {
        drawField(0);
      }

      function resize() {
        if (!ctx) return;
        w = canvas!.clientWidth;
        h = canvas!.clientHeight;
        canvas!.width = Math.floor(w * dpr);
        canvas!.height = Math.floor(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (reduced) drawStaticOnce();
      }

      function start() {
        if (reduced || raf != null) return;
        lastNow = performance.now();
        raf = requestAnimationFrame(frame);
      }
      function stop() {
        if (raf != null) { cancelAnimationFrame(raf); raf = null; }
      }

      rippleRef.current = () => {
        if (reduced) return;
        pulse = Math.max(pulse, 2.2);
        start();
      };
      thinkRef.current = (on: boolean) => {
        if (reduced) return;
        thinking = on;
        start();
      };

      const onVisibility = () => {
        if (document.hidden) stop();
        else if (!reduced) start();
      };

      resize();
      start(); // idle breathing
      window.addEventListener("resize", resize);
      document.addEventListener("visibilitychange", onVisibility);
      return () => {
        window.removeEventListener("resize", resize);
        document.removeEventListener("visibilitychange", onVisibility);
        stop();
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
